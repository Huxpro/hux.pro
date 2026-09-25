"use client";

import type { AppLink } from "@/lib/app-icon-core";
import { useEffect, useRef } from "react";
import { PAGE_FRAME_NAME } from "../lib/embed";

// =============================================================================
// PageFrame — a route of this site, shrunk into a window (`runtime: "page"`)
//
// A same-origin frame, named so the document inside knows it is a page in a
// window (lib/embed.ts) and draws none of the OS around itself. Links inside
// navigate inside: the Writing window browses writing, the way a window does.
//
// Same origin is what makes the way back cheap. Expanding reads where the
// frame has got to — not where it started — and sends the top document there
// (`pageFrameLocation`). The frames are kept in a map by window id for that,
// rather than threaded through the menu.
// =============================================================================

const frames = new Map<string, HTMLIFrameElement>();

/**
 * Where a page window currently is (path + query + hash), falling back to the
 * route it opened at when the frame cannot be read.
 */
export function pageFrameLocation(app: AppLink): string {
  try {
    const loc = frames.get(app.id)?.contentWindow?.location;
    if (loc && loc.origin === window.location.origin) {
      return `${loc.pathname}${loc.search}${loc.hash}`;
    }
  } catch {
    /* navigated off-origin: the opening route is the honest answer */
  }
  return app.url;
}

export function PageFrame({ app }: { app: AppLink }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    frames.set(app.id, el);
    return () => {
      if (frames.get(app.id) === el) frames.delete(app.id);
    };
  }, [app.id]);

  return (
    <iframe
      ref={ref}
      name={PAGE_FRAME_NAME}
      src={app.url}
      title={app.title}
      // Ours, same-origin, and a whole page: it needs its fullscreen for
      // decks and its clipboard for "copy link", and no sandbox.
      allow="fullscreen; clipboard-write; autoplay"
      className="absolute inset-0 h-full w-full border-0 bg-background"
    />
  );
}
