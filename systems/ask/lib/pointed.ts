"use client";

import { getAttachmentImage } from "@/lib/log";
import { LOG } from "@/lib/log-client";
import type { Locale } from "@/lib/i18n";
import { docForHref } from "./doc-href";
import type { AskDoc } from "./corpus";
import { readPageContext } from "./page-context";
import type { AskSearch } from "./search";
import type { AskContext } from "./tools";

// =============================================================================
// What the reader pointed at, as a context for the next question
// (./pending-context.ts):
//
//   a selection   the words, under the page and section they are in
//   a drop        a link to something on the site (a commit's hash, an
//                 entry's anchor, a post, a card): that thing, with its text;
//                 a picture: the commit or post it belongs to; plain words:
//                 a quote, as a selection is
// =============================================================================

/** A selection or dropped words past this are cut: a passage, not a page. */
const MAX_QUOTE = 2000;
/** A dropped thing's text, as a page's section is. */
const MAX_ITEM_TEXT = 4000;

/** Words from the page, under the page and section they came from. */
export function quoteContext(text: string, site: AskSearch, source?: Element | null): AskContext {
  let page = readPageContext(window.location.pathname, site.docs);
  const entry = source?.closest("[data-rail-row][id], .prompt-item[id]");
  if (entry) {
    const doc = docForHref(site.docs, `${window.location.pathname}#${encodeURIComponent(entry.id)}`, document.documentElement.lang === "zh" ? "zh" : "en");
    if (doc) page = { doc };
  } else if (source && page?.doc.kind === "post") {
    const heading = [...document.querySelectorAll("[data-heading-link][id]")].filter((el) => el.contains(source) || !!(el.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING)).at(-1);
    page = { doc: page.doc, ...(heading ? { anchor: heading.id, heading: heading.textContent?.trim() } : {}) };
  }
  const title = page?.doc.title ?? document.title.split(/\s[|·–-]\s/)[0];
  const href = page
    ? page.anchor
      ? `${page.doc.href}#${page.anchor}`
      : page.doc.href
    : window.location.pathname;
  return {
    kind: "quote",
    ...(page ? { doc: page.doc.id } : {}),
    title,
    href,
    ...(page?.heading ? { heading: page.heading } : {}),
    text: text.trim().slice(0, MAX_QUOTE),
  };
}

function itemContext(doc: AskDoc, site: AskSearch, anchor?: string): AskContext {
  return {
    kind: "item",
    doc: doc.id,
    title: doc.title,
    href: anchor ? `${doc.href}#${anchor}` : doc.href,
    text: site.textOf(doc.id, anchor, MAX_ITEM_TEXT),
  };
}

/** The commit a picture belongs to (a cover, a still), or the post. */
function docForImage(src: string, site: AskSearch, locale: Locale): AskDoc | null {
  let path = new URL(src, window.location.href);
  if (path.pathname === "/_next/image" && path.searchParams.get("url")) path = new URL(path.searchParams.get("url")!, window.location.href);
  const same = (url?: string | null) => {
    if (!url) return false;
    const u = new URL(url, window.location.href);
    return u.href === path.href;
  };
  for (const commit of LOG.commits) {
    const owns = commit.media?.some(
      (m) => same(getAttachmentImage(m, locale)) || same(m.url) || ("thumbnail" in m && same(m.thumbnail)),
    );
    if (owns) return site.docs.get(`work:${commit.id}:${locale}`) ?? site.docs.get(`work:${commit.id}:${locale === "en" ? "zh" : "en"}`) ?? null;
  }
  for (const doc of site.docs.values()) {
    if (doc.cover && same(doc.cover) && (doc.lang === locale || !site.docs.has(doc.id.replace(/:(en|zh)$/, `:${locale}`)))) return doc;
  }
  return null;
}

/** What was dropped on Ask, or null if it is nothing Ask can take. */
export function droppedContext(data: DataTransfer, site: AskSearch, locale: Locale): AskContext | null {
  const selected = data.getData("application/x-ask-quote");
  if (selected) {
    try {
      const { text, href, title } = JSON.parse(selected);
      const url = new URL(href, window.location.href);
      if (typeof text === "string" && url.origin === window.location.origin) {
        const doc = docForHref(site.docs, `${url.pathname}${url.hash}`, locale);
        return { kind: "quote", title: doc?.title ?? String(title).slice(0, 300), href: `${url.pathname}${url.hash}`, ...(doc ? { doc: doc.id } : {}), text: text.slice(0, MAX_QUOTE) };
      }
    } catch { /* Invalid custom data falls through to the native formats. */ }
  }
  const uri = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .find((line) => line && !line.startsWith("#"));
  const plain = data.getData("text/plain").trim();
  const link = uri || (/^(?:https?:\/\/|\/|#)\S+$/.test(plain) ? plain : "");
  if (link) {
    let url: URL;
    try {
      url = new URL(link, window.location.href);
    } catch {
      return plain ? quoteContext(plain, site) : null;
    }
    // A picture first: an image's address may be on this site too.
    const html = data.getData("text/html");
    if (/<img\b/i.test(html) || /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(url.pathname)) {
      const doc = docForImage(url.href, site, locale);
      if (doc) return itemContext(doc, site);
    }
    if (url.origin === window.location.origin) {
      const href = `${url.pathname}${url.hash}`;
      const doc = docForHref(site.docs, href, locale);
      if (doc) {
        // A post's heading: that section.
        const anchor = doc.kind === "post" && url.hash ? safeDecode(url.hash.slice(1)) : undefined;
        return itemContext(doc, site, anchor);
      }
    }
    return null;
  }
  return plain ? quoteContext(plain, site) : null;
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
