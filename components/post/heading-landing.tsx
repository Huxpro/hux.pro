"use client";

import { useHashLanding } from "@/lib/use-hash-landing";

/** Below the reading bar, with a line of the text above in view. */
const HEADROOM = 96;

/** A heading of this post (they take their ids in the browser,
 *  components/heading-link.tsx, from their text), or a row of the PL chart
 *  (which opens itself, components/languages/language-index.tsx). */
function headingFor(id: string): HTMLElement | null {
  const el = document.getElementById(id);
  return el && (/^H[1-3]$/.test(el.tagName) || el.dataset.language) ? el : null;
}

/**
 * A post's headings as permalinks: `/writing/<slug>/<lang>#<heading>`
 * travels to that heading on arrival, and again for a link into the post
 * already open (Ask's sources link to the heading a passage sits under).
 * The browser's own jump cannot do it: the ids only exist after mount.
 */
export function HeadingLanding() {
  useHashLanding({ resolve: headingFor, markAttr: "data-hash-target", headroom: HEADROOM });
  return null;
}
