"use client";

import { isIOSBrowser } from "@/systems/ambient/lib/platform";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * Must match `--glass-runway` in app/globals.css.
 */
const RUNWAY_PX = 96;

/**
 * GlassRunway — gives iOS 26 Safari something to composite behind its chrome.
 *
 * On a page that cannot scroll, Safari sits at scrollY = 0 forever. In that
 * state its Liquid Glass status bar has no composited page pixels to sample,
 * so it falls back to the flat root background-color — which is exactly the
 * "weird tinted band behind the status bar" symptom, and it is why neither
 * `viewport-fit=cover` nor `100dvh` fixes it on their own. It also means a
 * full-bleed background-image or video never shows through up there.
 *
 * The fix is to make scroll non-zero: add a top runway to the document and
 * scroll to it. The body padding and the scroll offset cancel out, so nothing
 * moves visually, but Safari now has real content to put behind the chrome.
 *
 * Deliberately narrow in scope:
 *   • iOS only — no other browser needs it, and it would be dead weight.
 *   • Only while the page is otherwise unscrollable. Pages that already scroll
 *     have non-zero scroll available on their own, and adding a runway there
 *     would fight scroll restoration and `#hash` anchors.
 */
export function GlassRunway() {
  const pathname = usePathname();
  // Whether the runway is currently installed. Tracked in a ref (not state)
  // because `sync` has to subtract it back out when re-measuring.
  const applied = useRef(false);

  const sync = useCallback(() => {
    const root = document.documentElement;
    // scrollHeight includes the runway once it's installed, so take it back
    // off to measure the page's own height.
    const contentHeight = root.scrollHeight - (applied.current ? RUNWAY_PX : 0);
    const needed = contentHeight <= window.innerHeight + 1;
    if (needed === applied.current) return;

    applied.current = needed;
    root.classList.toggle("has-glass-runway", needed);

    // Instant, not smooth: these are layout corrections, not navigations.
    if (needed) {
      // Scroll onto the runway so the offset cancels the padding. Only from
      // the very top — anywhere else the page already has the non-zero scroll
      // the runway exists to create, and moving it would fight the reader.
      if (window.scrollY < RUNWAY_PX) {
        window.scrollTo({ top: RUNWAY_PX, behavior: "instant" as ScrollBehavior });
      }
    } else {
      // Taking the runway away shifts the content up by RUNWAY_PX and the
      // browser does not adjust scrollY to match, so without this the page is
      // left sitting RUNWAY_PX too far down. This happens for real: a page can
      // start out short enough to need the runway and outgrow it as data loads.
      window.scrollTo({
        top: Math.max(0, window.scrollY - RUNWAY_PX),
        behavior: "instant" as ScrollBehavior,
      });
    }
  }, []);

  useEffect(() => {
    if (!isIOSBrowser()) return;

    sync();

    // Content height changes as data loads (weather, music, images), so keep
    // measuring rather than deciding once on mount.
    const observer = new ResizeObserver(sync);
    observer.observe(document.body);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      document.documentElement.classList.remove("has-glass-runway");
      applied.current = false;
    };
  }, [sync]);

  // Re-measure on navigation: the next route may not need the runway.
  useEffect(() => {
    if (!isIOSBrowser()) return;
    sync();
  }, [pathname, sync]);

  return null;
}
