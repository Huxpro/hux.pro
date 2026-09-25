import type { AppLink } from "@/lib/app-icon-core";
import { isEmbeddedWindow, PAGE_FRAME_NAME } from "./embed";
import type { OpenAppOptions } from "./types";

// =============================================================================
// The OS bridge — what a page in a window may ask of the document around it
//
// A page window is a whole page of this site, and a whole page can do
// anything the site can: navigate anywhere, open videos, open windows. Left
// alone, a page shrunk into a window was a second site running inside the
// first — follow the right links and the window held the home page, or a
// palette, or a theater of its own. So a page window is *scoped*: it holds
// one section (the frame's name says which), and everything that leaves the
// section is not the window's to do. It is handed to the top document — the
// OS — through this bridge, which the top publishes on `window.__huxOS`:
//
//   navigate   a link out of the section: the top goes there
//   openApp    a window (the in-app browser a link card opens, say)
//   openVideo  the theater — one player, the top's, whatever asked for it
//   openMedia
//
// Same origin is what makes this a function call rather than a protocol.
// =============================================================================

/** What the top document offers the pages in its windows. */
export interface HuxOS {
  navigate: (href: string) => void;
  openApp: (app: AppLink, opts?: OpenAppOptions) => void;
  openUrl: (url: string, opts?: { title?: string; id?: string }) => void;
  openBundleUrl: (url: string, opts?: { title?: string; flavor?: "react" | "vue" }) => void;
  /** Loosely typed: the theater's inputs, passed through untouched. */
  openVideo: (input: unknown) => void;
  openMedia: (media: unknown, meta: unknown) => void;
}

declare global {
  interface Window {
    __huxOS?: HuxOS;
  }
}

/**
 * The OS to hand things to, when this document is a page in a window; null
 * in the top document (which *is* the OS) and anywhere the top is not ours.
 */
export function embeddedOS(): HuxOS | null {
  if (typeof window === "undefined" || !isEmbeddedWindow()) return null;
  try {
    return window.top?.__huxOS ?? null;
  } catch {
    return null;
  }
}

/** The frame name for a page window scoped to `scope` (e.g. `/writing`). */
export function pageFrameName(scope: string): string {
  return `${PAGE_FRAME_NAME}|${scope}`;
}

/** The section this page window may move within, from its frame's name. */
export function embeddedScope(): string | null {
  if (typeof window === "undefined" || !isEmbeddedWindow()) return null;
  const [, scope] = window.name.split("|");
  return scope || null;
}

/** Whether `path` is inside `scope` — the section itself or anything under it. */
export function inScope(path: string, scope: string): boolean {
  const p = path.split(/[?#]/)[0];
  return p === scope || p.startsWith(`${scope}/`);
}
