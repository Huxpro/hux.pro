"use client";

import { useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { canShrink, pageApp } from "../lib/builtins";
import { getViewport } from "../lib/geometry";
import type { WindowInstance } from "../lib/types";
import { useOptionalWindows, useWindows } from "../provider";
import { pageFrameLocation } from "./page-frame";

// =============================================================================
// Shrink ⇄ expand — a fullscreen page and a page window are one thing
//
// The site's pages are its fullscreen apps. Shrinking one opens its route in
// a page window that grows out of the whole viewport — so it reads as the
// page itself getting smaller — and takes the top document home, to the
// desktop the window now sits on. Expanding is the reverse: the top document
// goes to wherever the window has got to, and the window closes.
// =============================================================================

/** Shrink the page on screen into a window. `null` where there is none (home). */
export function useShrinkPage(): (() => void) | null {
  const windows = useOptionalWindows();
  const openApp = windows?.openApp;
  const router = useTransitionRouter();
  const pathname = usePathname();

  const shrink = useCallback(() => {
    if (!openApp) return;
    const { search, hash } = window.location;
    const title = document.title.split(" | ")[0] || undefined;
    const { width, height } = getViewport();
    openApp(pageApp(`${pathname}${search}${hash}`, title), {
      origin: { x: 0, y: 0, width, height },
    });
    router.push("/");
  }, [openApp, router, pathname]);

  return openApp && canShrink(pathname) ? shrink : null;
}

/** Make a page window the page again. */
export function useExpandPage(): (win: WindowInstance) => void {
  const { close } = useWindows();
  const router = useTransitionRouter();
  return useCallback(
    (win: WindowInstance) => {
      router.push(pageFrameLocation(win.app));
      close(win.id);
    },
    [close, router],
  );
}
