"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { embeddedOS, embeddedScope, inScope } from "../lib/os";
import { useEmbeddedWindow } from "../lib/use-embedded";

// =============================================================================
// OsChrome — what only the top document draws
//
// Wraps the dock, the window layer, the palette, the devtool and the rest of
// the OS in the root layout. In a page shrunk into a window (lib/embed.ts)
// it renders none of them — the CSS in globals.css has hidden them from the
// first frame, and this unmounts them once hydrated — and holds the page to
// its section instead (`EmbeddedPage`).
// =============================================================================

export function OsChrome({ children }: { children: React.ReactNode }) {
  const embedded = useEmbeddedWindow();
  if (embedded) return <EmbeddedPage />;
  return <div className="os-chrome">{children}</div>;
}

function isField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
  );
}

/**
 * A page in a window keeps to its section (lib/os.ts). Three doors out, each
 * handed to the top document:
 *
 *   keys    ⌘K and `/` summon the OS; the top's palette opens.
 *   links   a click on a link past the section is taken before the page's
 *           router sees it, and the top navigates there instead. The window
 *           stays where it was.
 *   code    anything that navigates without a link (a widget's router.push)
 *           is caught on arrival: the top goes there, the window goes back.
 */
function EmbeddedPage() {
  const pathname = usePathname();
  const router = useRouter();
  const lastInScope = useRef<string | null>(null);

  // Keys.
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

  // Links. In the capture phase on the window, ahead of React's listener at
  // the root, so a Next <Link> never starts its client navigation.
  useEffect(() => {
    const scope = embeddedScope();
    if (!scope) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // a new tab is the browser's
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      // Off-site links are the page's to open however it likes. A link to
      // this site is ours whatever its target: /works marks its writing links
      // `_blank` and then routes them in place itself.
      if (url.origin !== window.location.origin) return;
      // A file (the poster a lightbox opens) is content, not a place to go.
      if (/\.[a-z0-9]+$/i.test(url.pathname)) return;
      if (inScope(url.pathname, scope)) return;
      const os = embeddedOS();
      if (!os) return;
      e.preventDefault();
      e.stopPropagation();
      os.navigate(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  // Code. The backstop: whatever got here without a link goes to the top, and
  // the window returns to the last place in its section it was.
  useEffect(() => {
    const scope = embeddedScope();
    if (!scope) return;
    const here = `${pathname}${window.location.search}${window.location.hash}`;
    if (inScope(pathname, scope)) {
      lastInScope.current = here;
      return;
    }
    embeddedOS()?.navigate(here);
    router.replace(lastInScope.current ?? scope);
  }, [pathname, router]);

  return null;
}
