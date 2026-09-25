"use client";

import { useEffect } from "react";
import { useEmbeddedWindow } from "../lib/use-embedded";

// =============================================================================
// OsChrome — what only the top document draws
//
// Wraps the dock, the window layer, the palette, the devtool and the rest of
// the OS in the root layout. In a page shrunk into a window (lib/embed.ts)
// it renders none of them — the CSS in globals.css has hidden them from the
// first frame, and this unmounts them once hydrated — and forwards the two
// keys that summon the OS to the document that owns it, so ⌘K pressed while
// reading in a window opens the one palette rather than nothing.
// =============================================================================

export function OsChrome({ children }: { children: React.ReactNode }) {
  const embedded = useEmbeddedWindow();
  if (embedded) return <ForwardSystemKeys />;
  return <div className="os-chrome">{children}</div>;
}

function isField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
  );
}

function ForwardSystemKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const palette = (e.metaKey || e.ctrlKey) && e.key === "k";
      const slash = e.key === "/" && !isField(e.target);
      if (!palette && !slash) return;
      let top: Window | null = null;
      try {
        top = window.top;
        void top?.document; // throws when the top is not ours
      } catch {
        return;
      }
      if (!top || top === window) return;
      // Ahead of this document's own palette listener, which has nothing to
      // open here.
      e.preventDefault();
      e.stopImmediatePropagation();
      top.focus();
      // The top's own constructor: an event from this realm is foreign there.
      const TopKeyboardEvent = (top as Window & typeof globalThis).KeyboardEvent;
      top.document.dispatchEvent(
        new TopKeyboardEvent("keydown", {
          key: e.key,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          bubbles: true,
        }),
      );
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  return null;
}
