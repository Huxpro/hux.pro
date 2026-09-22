"use client";

import { useEffect, useState } from "react";

// =============================================================================
// Solid-during-transition
//
// iOS Safari does not keep `backdrop-filter` in step with a view transition.
// For a frame or more the bar is only its translucent fill — the page behind
// it is sharp — and the blur arrives late. So for the whole transition the
// bar paints as the opaque glass base (the same colour tinted and clear are
// mixed from), and glass comes back only after the transition has finished
// and the new page has painted.
//
// The attribute is set on the DOM *before* `startViewTransition` captures the
// outgoing page, and React state mirrors it so the navigation re-render does
// not strip it. No `flushSync`: that re-render lands in the middle of
// next-view-transitions' finish handshake and the transition never settles,
// which left the bar solid for good.
// =============================================================================

type StartViewTransition = (
  callback: () => void | Promise<void>
) => ViewTransition;

const TAB_SELECTOR = "[data-liquid-tabs]";

function paintSolid(on: boolean) {
  document.querySelectorAll(TAB_SELECTOR).forEach((el) => {
    if (on) el.setAttribute("data-tab-solid", "");
    else el.removeAttribute("data-tab-solid");
  });
}

/**
 * True while a `document.startViewTransition` is in flight (plus two frames
 * after it finishes, so the restored blur samples a settled page).
 * Patches `startViewTransition` only while `active`.
 */
export function useTransitionSolid(active: boolean): boolean {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    if (!active) return;
    const doc = document as Document & {
      startViewTransition?: StartViewTransition;
    };
    const original = doc.startViewTransition;
    if (!original) return;

    let alive = true;
    let token = 0;

    const restore = (mine: number) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!alive || mine !== token) return;
          paintSolid(false);
          setSolid(false);
        });
      });
    };

    const wrapped: StartViewTransition = (callback) => {
      const mine = ++token;
      // Synchronous, so the outgoing snapshot is already opaque.
      paintSolid(true);
      setSolid(true);
      const vt = original.call(document, callback);
      const safety = window.setTimeout(() => restore(mine), 2000);
      vt.finished.finally(() => {
        window.clearTimeout(safety);
        restore(mine);
      });
      return vt;
    };

    doc.startViewTransition = wrapped;
    return () => {
      alive = false;
      token += 1;
      if (doc.startViewTransition === wrapped) {
        doc.startViewTransition = original;
      }
      paintSolid(false);
      setSolid(false);
    };
  }, [active]);

  return solid;
}
