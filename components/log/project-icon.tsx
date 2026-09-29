"use client";

import { useMemo } from "react";
import { resolveMagicLink } from "@/components/magic-link/resolve";
import type { Locale } from "@/lib/i18n";
import { localize, type Commit } from "@/lib/log";
import { cn } from "@/lib/utils";

// =============================================================================
// ProjectIcon — a project's logo, as an app icon.
//
// The same icon the project's `<Badge commit=…>` wears in the About's prose
// (docs/system-about.md, "What it wears"), resolved by the same function:
// the official icon of the site that stands for it, snapshotted into
// content/badge-icons.json. A project is one thing wherever it is named, so
// its chip in a sentence and its row on /works must never disagree about
// what it looks like.
//
// What differs is only the size, and so the shape: at a word's height the
// badge is a rounded glyph; at two lines' height it is a tile, and a tile of
// that size on a home screen is a rounded square with a hairline, so that is
// what it is here. A home-screen icon fills it; a favicon sits on a white
// plate, the way a home screen shows one (a black mark — Lynx's cat — still
// reads in the dark).
//
// A project whose site has no icon wears its letter instead: mono, on the
// page's own wash — the same quiet wordmark-on-grey the site's own app icon
// is (docs/app-icon.md), rather than the badge's era colour, which at this
// size would be the loudest thing on the page and would say the least.
// =============================================================================

const TILE = "relative block shrink-0 overflow-hidden rounded-[24%] select-none";

/** A hairline over the tile, so a white plate keeps its edge on a light
 *  page. Over the picture rather than a border around it, because an
 *  inset shadow on an `<img>` paints under the pixels. */
const HAIRLINE =
  "pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-border";

export function ProjectIcon({
  commit,
  locale,
  className,
}: {
  commit: Commit;
  locale: Locale;
  /** The tile's size (`size-10`) and anything else from the row. */
  className?: string;
}) {
  const icon = useMemo(
    () => resolveMagicLink({ commit: commit.id }, locale)?.icon ?? null,
    [commit, locale],
  );

  if (icon?.type === "image") {
    return (
      <span aria-hidden className={cn(TILE, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a snapshotted icon at 40px; next/image would only add a wrapper */}
        <img
          src={icon.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(
            "size-full",
            icon.fill ? "object-cover" : "bg-white object-contain p-[16%]",
          )}
        />
        <span className={HAIRLINE} />
      </span>
    );
  }

  return (
    <span aria-hidden className={cn(TILE, "grid place-items-center bg-muted", className)}>
      <span className="font-mono text-[15px] leading-none text-muted-foreground">
        {localize(commit.title, locale).trim().charAt(0).toUpperCase()}
      </span>
      <span className={HAIRLINE} />
    </span>
  );
}
