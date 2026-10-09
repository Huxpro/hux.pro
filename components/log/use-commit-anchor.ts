"use client";

/**
 * Commit permalinks: `/works#<hash>`.
 *
 * Every row has carried `id={hash}` since the timeline was written, so the
 * anchors existed; nothing pointed at them and nothing happened on arrival.
 * A commit is the page's unit, and it should be linkable. "the Lynx talk"
 * had no address, and following a link from elsewhere on the site dropped
 * you at the top of a 25-row log to find it yourself.
 *
 * This is both halves: land on `#hash` and the page travels to that row and
 * marks it; click a row's hash and the URL becomes that permalink without a
 * navigation.
 *
 * The travel is the site's (lib/use-hash-landing.ts): through `vitre`,
 * eased, cancelled by the reader's hand, marked on arrival.
 */

import { useCallback } from "react";
import { useHashLanding } from "@/lib/use-hash-landing";

/** Marks the row that was just travelled to; `globals.css` styles it and
 *  owns how long the mark stays up (`commit-target-wash`). */
const TARGET_ATTR = "data-commit-target";

/** Distance from the top of the viewport the row comes to rest at, clearing
 *  the pinned bar (`top-4`, WorksToolbar) with room to read the row above it. */
const HEADROOM = 120;

/** A commit hash is 7 hex characters (see `computeCommitHash`). */
function rowFor(hash: string): HTMLElement | null {
  const id = hash.replace(/^#/, "");
  if (!/^[0-9a-f]{7}$/.test(id)) return null;
  const el = document.getElementById(id);
  return el?.hasAttribute("data-rail-row") ? (el as HTMLElement) : null;
}

/**
 * Wires arrival and returns the click handler a row's hash uses to become the
 * page's address.
 */
export function useCommitAnchor(): (hash: string) => void {
  const travelTo = useHashLanding({ resolve: rowFor, markAttr: TARGET_ATTR, headroom: HEADROOM });

  return useCallback(
    (hash: string) => {
      const el = rowFor(hash);
      if (!el) return;
      // `pushState`, so the permalink is in the URL bar and in history without
      // a route change, and without firing `hashchange`, which would send the
      // travel through a second time.
      window.history.pushState(null, "", `#${hash}`);
      travelTo(el);
    },
    [travelTo],
  );
}
