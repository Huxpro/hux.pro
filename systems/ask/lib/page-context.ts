"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AskDoc } from "./corpus";
import { loadedAskSearch, type AskSearch } from "./search";
import { contextsOf, type AskContext, type AskUIMessage } from "./tools";

// =============================================================================
// What the reader has open: the page under Ask, read the way they are
// reading it, so a question about "this" is about the right thing.
//
//   /writing/<slug>/<lang>   the post, at the section in view (the last
//                            heading above the reading line)
//   /writing/pl-chart/...    the languages whose rows are open, else the post
//   /prompt                  the entry open (nearest the middle of the
//                            screen when several are)
//   /works                   the commit open, else the one the address
//                            points at
//
// Anywhere else, nothing. It follows the page live (scrolling, opening an
// entry, a link travelling) for the tag over the composer; the text it sends
// is read from the index at the moment of sending (`contextText`).
// =============================================================================

/** Where the reader's eye is: a third of the way down. */
const READING_LINE = 0.33;

/** What a context's text is cut at: a section, not a whole post (the agent
 *  can `read` the rest). */
const MAX_CONTEXT_TEXT = 4000;

export interface PageContext {
  doc: AskDoc;
  heading?: string;
  anchor?: string;
}

/** Same thing, same place: the tag need not change. */
export function sameContext(a: PageContext | null, b: PageContext | null) {
  return a?.doc.id === b?.doc.id && a?.anchor === b?.anchor;
}

function docByHref(docs: Map<string, AskDoc>, href: string, lang?: string): AskDoc | null {
  let fallback: AskDoc | null = null;
  for (const doc of docs.values()) {
    if (decodeURI(doc.href) !== decodeURI(href)) continue;
    if (!lang || doc.lang === lang) return doc;
    fallback ??= doc;
  }
  return fallback;
}

/** Of these elements, the one nearest the middle of the screen. */
function nearestMiddle(els: Element[]): Element | null {
  const mid = window.innerHeight / 2;
  let best: Element | null = null;
  let distance = Infinity;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    const d = Math.abs((r.top + r.bottom) / 2 - mid);
    if (d < distance) {
      distance = d;
      best = el;
    }
  }
  return best;
}

/** The page's context as it is on screen now. */
export function readPageContext(pathname: string, docs: Map<string, AskDoc>): PageContext | null {
  const post = /^\/writing\/([^/]+)\/(en|zh)\/?$/.exec(pathname);
  if (post) {
    const [, slug, lang] = post;
    if (slug === "pl-chart") {
      const open = [...document.querySelectorAll("[data-language]")].filter((el) =>
        el.querySelector('[aria-expanded="true"]'),
      );
      const row = nearestMiddle(open);
      const doc = row && docs.get(`language:${row.id}:${lang}`);
      if (doc) return { doc };
    }
    const doc = docs.get(`post:${slug}:${lang}`) ?? docs.get(`post:${slug}:${lang === "en" ? "zh" : "en"}`);
    if (!doc) return null;
    // The section: the last heading above the reading line.
    const line = window.innerHeight * READING_LINE;
    let heading: Element | null = null;
    for (const el of document.querySelectorAll("[data-heading-link][id]")) {
      if (el.getBoundingClientRect().top <= line) heading = el;
      else break;
    }
    return heading
      ? { doc, heading: heading.textContent?.trim() || undefined, anchor: heading.id }
      : { doc };
  }

  if (pathname === "/prompt") {
    const entry = nearestMiddle([...document.querySelectorAll(".prompt-item[data-expanded][id]")]);
    const doc = entry && docByHref(docs, `/prompt#${encodeURIComponent(entry.id)}`);
    return doc ? { doc } : null;
  }

  if (pathname === "/works" || pathname.startsWith("/works/")) {
    const open = [...document.querySelectorAll("[data-rail-row]")].filter((row) =>
      row.querySelector("[data-expanded]"),
    );
    const row = nearestMiddle(open);
    const hash = row?.id ?? window.location.hash.slice(1);
    const doc = /^[0-9a-f]{7}$/.test(hash) ? docByHref(docs, `/works#${hash}`) : null;
    return doc ? { doc } : null;
  }

  return null;
}

/** The context as it goes with a question: what it is, and its text. */
export function contextText(context: PageContext, site: AskSearch): AskContext {
  const { doc, heading, anchor } = context;
  return {
    kind: "page",
    doc: doc.id,
    title: doc.title,
    href: anchor ? `${doc.href}#${anchor}` : doc.href,
    ...(heading ? { heading } : {}),
    text: site.textOf(doc.id, anchor, MAX_CONTEXT_TEXT),
  };
}

/**
 * What goes with a question: the page's context, unless the conversation
 * was last asked about this same spot (the model has it already).
 */
export function contextsToSend(page: PageContext | null, messages: readonly AskUIMessage[]): AskContext[] {
  const site = loadedAskSearch();
  if (!page || !site) return [];
  const next = contextText(page, site);
  for (let i = messages.length - 1; i >= 0; i--) {
    const sent = messages[i].role === "user" ? contextsOf(messages[i]).find((c) => c.kind === "page") : undefined;
    if (sent) return sent.href === next.href ? [] : [next];
  }
  return [next];
}

/** The same, read off the page now: for a question handed over from
 *  elsewhere (the palette's field), with no tag to show first. */
export function contextsNow(messages: readonly AskUIMessage[]): AskContext[] {
  const site = loadedAskSearch();
  return site ? contextsToSend(readPageContext(window.location.pathname, site.docs), messages) : [];
}

/**
 * The page's context, following the page: a route change, scrolling (a new
 * section), an entry opening or closing, a link travelling.
 */
export function usePageContext(docs: Map<string, AskDoc> | null): PageContext | null {
  const pathname = usePathname();
  const [context, setContext] = useState<PageContext | null>(null);

  useEffect(() => {
    if (!docs) return;
    let frame = 0;
    let timer = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = readPageContext(pathname, docs);
        setContext((last) => (sameContext(last, next) ? last : next));
      });
    };
    // Scrolling asks at most every 200ms: a section is read for longer.
    const onScroll = () => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        update();
      }, 200);
    };
    update();
    // The page may still be rendering on a route change.
    const settle = window.setTimeout(update, 600);
    const opened = new MutationObserver(update);
    opened.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-expanded", "aria-expanded"],
    });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("hashchange", update);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      clearTimeout(settle);
      opened.disconnect();
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("hashchange", update);
    };
  }, [pathname, docs]);

  return docs ? context : null;
}
