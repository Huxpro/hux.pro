"use client";

import { attachmentSetFor, useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import { getAttachmentImage, type Commit, type Media } from "@/lib/log";
import { LOG } from "@/lib/log-client";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommand } from "@/systems/command";
import { ExternalLink, Image as ImageIcon, Play, Presentation } from "lucide-react";
import { useEffect, useState } from "react";
import type { AskDoc } from "../lib/corpus";
import { askPlatformNow } from "../lib/config";
import { loadAskSearch } from "../lib/search";
import { askStrings } from "../strings";

// =============================================================================
// Cards: what the agent found, shown as the things they are.
//
// A conversation used to end in a list of page titles. A talk is more than
// its title: it has a cover, a recording, a deck. So the docs a turn
// presents (the `present` tool) and the ones its answer links to come back
// as cards, a strip under the answer:
//
//   work       its commit from /works (lib/log-client, the same records the
//              theater's albums read): the cover the contact strip shows, the
//              venue and year, and a button per attachment (watch, slides,
//              photos, link) that opens it the way /works does, through
//              systems/attachments.
//   post       its first picture (the index's `cover`), date and description.
//   conviction, influence, era, language
//              the line that says what it is.
//
// The card itself is a link to the exact spot (the doc's href, see
// lib/use-hash-landing.ts); Ask's link handler follows it. Opening media
// from the center (the palette, above everything) moves Ask to the side
// first, so the stage is not under it.
// =============================================================================

let loadedDocs: Map<string, AskDoc> | null = null;

/** The index's docs, once loaded (the agent's tools load it; a conversation
 *  reopened from the history loads it here). */
export function useAskDocs(): Map<string, AskDoc> | null {
  const [docs, setDocs] = useState(loadedDocs);
  useEffect(() => {
    if (docs) return;
    let live = true;
    loadAskSearch()
      .then((site) => {
        loadedDocs = site.docs;
        if (live) setDocs(site.docs);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [docs]);
  return docs;
}

function decoded(href: string): string {
  try {
    return decodeURI(href);
  } catch {
    return href;
  }
}

const byHref = new WeakMap<Map<string, AskDoc>, Map<string, AskDoc[]>>();

/** The doc a link on this site points at: the exact href, or for a passage
 *  (`#heading`) its post. In the reader's language when there are both. */
export function docForHref(docs: Map<string, AskDoc>, href: string, locale: Locale): AskDoc | null {
  let index = byHref.get(docs);
  if (!index) {
    index = new Map();
    for (const doc of docs.values()) {
      const key = decoded(doc.href);
      const list = index.get(key) ?? [];
      list.push(doc);
      index.set(key, list);
    }
    byHref.set(docs, index);
  }
  // Compared decoded: a model writes `/prompt#自然` as often as the
  // index's `/prompt#%E8%87%AA%E7%84%B6`.
  const key = decoded(href);
  const found = index.get(key) ?? index.get(key.split("#")[0]) ?? [];
  return found.find((d) => d.lang === locale) ?? found[0] ?? null;
}

function commitOf(doc: AskDoc): Commit | null {
  if (doc.kind !== "work") return null;
  const id = doc.id.split(":")[1];
  return LOG.commits.find((c) => c.id === id) ?? null;
}

/** What a media item is called on its button. */
function actionOf(media: Media, s: ReturnType<typeof askStrings>) {
  switch (media.kind) {
    case "video":
      return { icon: Play, label: s.watch };
    case "slides":
      return { icon: Presentation, label: s.slides };
    case "image":
      return { icon: ImageIcon, label: s.photos };
    case "link":
      return { icon: ExternalLink, label: s.link };
    default:
      return null;
  }
}

function yearOf(date?: string) {
  return date?.slice(0, 4);
}

function DocCard({ doc }: { doc: AskDoc }) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const attachments = useOptionalAttachments();
  const { askPlacement, moveAsk } = useCommand();

  const commit = commitOf(doc);
  const set: AttachmentSet | null = commit ? attachmentSetFor(commit, locale) : null;
  // One button per kind of attachment, the first of each: a talk's
  // recording and its deck, not every link it carries.
  const actions: { index: number; icon: typeof Play; label: string }[] = [];
  const kinds = new Set<string>();
  set?.items.forEach((media, index) => {
    const action = actionOf(media, s);
    if (!action || kinds.has(media.kind)) return;
    kinds.add(media.kind);
    actions.push({ index, ...action });
  });
  const [broken, setBroken] = useState(false);
  const cover = broken
    ? null
    : (doc.cover ??
      set?.items.map((m) => getAttachmentImage(m, locale)).find((src): src is string => !!src) ??
      null);
  const playable = set?.items.findIndex((m) => m.kind === "video") ?? -1;

  const open = (index: number) => {
    if (!set || !attachments) return;
    // The palette sits above the stage; the side leaves it in view.
    if (askPlacement === "center" && askPlatformNow() === "desk") moveAsk("side");
    // The keyboard goes with the eye: left on this button, Escape would be
    // the panel's (it closes Ask) rather than the stage's.
    (document.activeElement as HTMLElement | null)?.blur();
    attachments.open(set, index);
  };

  const eyebrow = [
    s.kinds[commit?.type ?? doc.kind] ?? s.kinds[doc.kind],
    set?.subtitle,
    yearOf(doc.date),
  ]
    .filter(Boolean)
    .join(" · ");
  const line = commit ? undefined : doc.summary;

  return (
    <div
      data-ask-card={doc.kind}
      className={cn(
        "group/card relative flex w-56 shrink-0 snap-start flex-col overflow-hidden rounded-xl",
        "border border-border/50 bg-muted/30 transition-colors hover:bg-muted/60",
      )}
    >
      {cover && (
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- covers come from anywhere (the site, YouTube, OG images) */}
          <img
            src={cover}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
          {playable >= 0 && (
            <button
              type="button"
              aria-label={`${s.watch}: ${doc.title}`}
              onClick={() => open(playable)}
              className={cn(
                "pressable absolute inset-0 z-10 m-auto flex size-10 items-center justify-center rounded-full",
                "bg-black/55 text-white backdrop-blur-sm transition-transform hover:scale-105",
              )}
            >
              <Play className="size-4 translate-x-px fill-current" />
            </button>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="truncate font-mono text-[11px] text-muted-foreground">{eyebrow}</span>
        {/* The whole card is this link (the stretched `after`); the buttons
            sit above it. */}
        <a
          href={doc.href}
          className="line-clamp-2 text-sm font-medium leading-snug text-foreground after:absolute after:inset-0"
        >
          {doc.title}
        </a>
        {line && <p className="line-clamp-2 text-xs text-muted-foreground">{line}</p>}
        {actions.length > 0 && (
          <div className="relative z-10 mt-auto flex flex-wrap gap-1 pt-1.5">
            {actions.map(({ index, icon: Icon, label }) => (
              <button
                key={index}
                type="button"
                onClick={() => open(index)}
                className={cn(
                  "pressable inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs",
                  "bg-background/60 text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One card per thing: a post or a talk is a doc per language, and the
 *  reader's language stands for both. */
function distinct(docs: readonly AskDoc[], locale: Locale): AskDoc[] {
  const out = new Map<string, AskDoc>();
  for (const doc of docs) {
    const thing = doc.id.replace(/:(en|zh)$/, "");
    const held = out.get(thing);
    if (!held || (held.lang !== locale && doc.lang === locale)) out.set(thing, doc);
  }
  return [...out.values()];
}

/** A strip of cards for these docs, in order. */
export function AskCards({ docs: all, className }: { docs: readonly AskDoc[]; className?: string }) {
  const { locale } = useLocale();
  const docs = distinct(all, locale);
  if (!docs.length) return null;
  return (
    <div
      data-ask-cards=""
      className={cn(
        // Bleeds to the conversation's edges so a card can scroll past them.
        "-mx-4 flex snap-x scroll-px-4 items-start gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]",
        className,
      )}
    >
      {docs.map((doc) => (
        <DocCard key={doc.id} doc={doc} />
      ))}
    </div>
  );
}
