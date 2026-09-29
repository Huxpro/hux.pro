"use client";

import { useMemo } from "react";
import { commitBadge } from "@/components/magic-link";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// =============================================================================
// ProjectLogo — the work's mark, as a tile.
//
// The same icon the work's `<Badge>` wears in the About's prose
// (docs/system-about.md, "What it wears"), resolved by the same function
// (`commitBadge`): the official icon of the site that stands for it,
// snapshotted into content/badge-icons.json. A project is one thing
// wherever it is named, so its chip in a sentence and its entry on /works
// must never disagree about what it looks like.
//
// What differs is only the size, and so the shape: at a word's height the
// badge is a rounded glyph; at two lines' height it is a tile, and a tile
// that size on a home screen is a rounded square with a hairline, so that
// is what it is here. A home-screen icon fills it; a favicon sits on a
// white plate, the way a home screen shows one (a black mark — Lynx's cat
// — still reads in the dark).
//
// A work whose site has no icon (the Flash years, a studio long gone)
// wears its letter instead: mono, on the page's own wash — the quiet
// wordmark-on-grey the site's own app icon is (docs/app-icon.md), rather
// than the badge's era colour, which at this size would be the loudest
// thing on the page and say the least.
// =============================================================================

const TILE = "relative block shrink-0 overflow-hidden rounded-[24%] select-none";

/** A hairline over the tile, so a white plate keeps its edge on a light
 *  page. Over the picture rather than a border around it, because an inset
 *  shadow on an `<img>` paints under the pixels. */
const HAIRLINE =
  "pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-border";

export function ProjectLogo({
  commitId,
  locale,
  className,
  monogramClassName = "text-sm",
}: {
  commitId: string;
  locale: Locale;
  /** The tile's size (`size-10`) and anything else from the caller. */
  className?: string;
  /** The letter's size, which scales with the tile's. */
  monogramClassName?: string;
}) {
  const icon = useMemo(
    () => commitBadge(commitId, locale)?.icon ?? null,
    [commitId, locale],
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
    <span
      aria-hidden
      className={cn(TILE, "grid place-items-center bg-muted", className)}
    >
      <span
        className={cn(
          "font-mono leading-none text-muted-foreground",
          monogramClassName,
        )}
      >
        {icon?.type === "monogram" ? icon.letter : "·"}
      </span>
      <span className={HAIRLINE} />
    </span>
  );
}
