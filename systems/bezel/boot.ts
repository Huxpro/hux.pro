// =============================================================================
// Bezel — putting the frame on <html>, taking it off, and keeping it there.
//
// The frame is three things on the root element: the `bezel` class with the
// colour and band properties and an inline background, the lock class on iOS
// (see ./page-scroll), and the `theme-color` meta. The boot script in
// app/layout.tsx writes them before first paint when the page loads framed, so
// the first frame is already right. After that <Bezel> owns them: it puts them
// on when the frame turns on and takes them off when it turns off, live.
//
// What is NOT live is the colour. The boot script resolves it once per page
// load, framed or not, and records it on `window`; every frame this page puts
// on uses that colour. See ./tint for why a colour must not move after load.
//
// ## Why the record is on `window`
//
// React owns <html>. When hydration fails — any text the server rendered that
// the client renders differently, React error #418 — React 19 renders the
// whole app again on the client and strips every attribute off <html> first.
// Measured on a Vercel preview on iOS 26.5: `class` and `style` both removed,
// so the frame lost its colour, its lock and its corners. `window` is never
// touched, so the colour and platform live there, and <Bezel> repairs a wipe
// before the next paint.
// =============================================================================

import { BEZEL_BAND_VAR, BEZEL_CLASS, BEZEL_COLOR_VAR } from "./metrics";
import {
  BEZEL_LOCK_CLASS,
  BEZEL_SCROLL_ROOT_ID,
  emitPageScroll,
} from "./page-scroll";

/** Property on `window` the boot script records its decision under. */
export const BEZEL_BOOT_GLOBAL = "__huxBezel";
/** Id of the `theme-color` meta the boot script creates. */
export const BEZEL_THEME_COLOR_ID = "hux-theme-color";

/** What the boot script resolved before first paint. */
export interface BezelBoot {
  /** The frame colour for this page load. */
  color: string;
  /** Whether the page loaded framed. */
  framed: boolean;
  /** The band the page loaded with, px. */
  band: number;
  /** Whether a frame here locks the document (iOS). */
  lock: boolean;
}

/** How a frame is put on the root element. */
export interface BezelFrame {
  color: string;
  band: number;
  lock: boolean;
}

/** The boot script's record, or `null` outside a browser or without one. */
export function readBezelBoot(): BezelBoot | null {
  if (typeof window === "undefined") return null;
  const value = (window as unknown as Record<string, unknown>)[BEZEL_BOOT_GLOBAL];
  if (!value || typeof value !== "object") return null;
  const { color, framed, band, lock } = value as Partial<BezelBoot>;
  if (typeof color !== "string") return null;
  return {
    color,
    framed: framed === true,
    band: typeof band === "number" ? band : 0,
    lock: lock === true,
  };
}

function scrollRoot(): HTMLElement | null {
  return document.getElementById(BEZEL_SCROLL_ROOT_ID);
}

function themeColorMeta(): HTMLMetaElement {
  let meta = document.getElementById(BEZEL_THEME_COLOR_ID) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.id = BEZEL_THEME_COLOR_ID;
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  return meta;
}

/**
 * Show Safari the new chrome colour.
 *
 * Measured on iOS 26.5: Safari takes its chrome colour from the root
 * background at load, but does not look again when that background changes
 * later — a frame turned on live left the status bar and toolbar in the old
 * colour. What it does follow live is `position: fixed` content at the edge of
 * the viewport, from 6px thick. So for a moment the new colour is put there,
 * then taken away. The strips are children of <html>, not <body>, so the lock
 * stylesheet does not make them absolute.
 */
const NUDGE_PX = 8;
const NUDGE_MS = 600;
function nudgeChrome(color: string): void {
  const strips = ["top", "bottom"].map((edge) => {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = `position:fixed;left:0;right:0;${edge}:0;height:${NUDGE_PX}px;background:${color};z-index:2147483647;pointer-events:none`;
    document.documentElement.appendChild(el);
    return el;
  });
  window.setTimeout(() => strips.forEach((el) => el.remove()), NUDGE_MS);
}

function isApplied(root: HTMLElement, frame: BezelFrame): boolean {
  return (
    root.classList.contains(BEZEL_CLASS) &&
    root.classList.contains(BEZEL_LOCK_CLASS) === frame.lock &&
    root.style.getPropertyValue(BEZEL_COLOR_VAR) === frame.color &&
    document.getElementById(BEZEL_THEME_COLOR_ID)?.getAttribute("content") === frame.color
  );
}

/**
 * Put a frame on the root element. Idempotent.
 *
 * When this is what locks the document, the page's scroll position moves from
 * the window into the scroll root, so turning the frame on does not jump the
 * page to the top.
 */
export function applyBezelFrame(root: HTMLElement, frame: BezelFrame): void {
  const framing = !root.classList.contains(BEZEL_CLASS);
  const locking = frame.lock && !root.classList.contains(BEZEL_LOCK_CLASS);
  const top = locking ? window.scrollY : 0;

  root.classList.add(BEZEL_CLASS);
  root.classList.toggle(BEZEL_LOCK_CLASS, frame.lock);
  root.style.setProperty(BEZEL_COLOR_VAR, frame.color);
  root.style.setProperty(BEZEL_BAND_VAR, `${frame.band}px`);
  root.style.backgroundColor = frame.color;
  const meta = themeColorMeta();
  if (meta.content !== frame.color) meta.content = frame.color;

  if (locking) {
    const el = scrollRoot();
    if (el) el.scrollTop = top;
    emitPageScroll();
  }
  if (framing) nudgeChrome(frame.color);
}

/**
 * Take the frame off the root element. Idempotent.
 *
 * The scroll position moves back from the scroll root to the window, and
 * Safari is shown the page's own background again. The `theme-color` meta is
 * left to the host, which knows the page's ground.
 */
export function removeBezelFrame(root: HTMLElement): void {
  const framed = root.classList.contains(BEZEL_CLASS);
  const unlocking = root.classList.contains(BEZEL_LOCK_CLASS);
  const top = unlocking ? (scrollRoot()?.scrollTop ?? 0) : 0;

  root.classList.remove(BEZEL_CLASS, BEZEL_LOCK_CLASS);
  root.style.removeProperty(BEZEL_COLOR_VAR);
  root.style.backgroundColor = "";

  if (unlocking) {
    window.scrollTo(0, top);
    emitPageScroll();
  }
  if (framed) {
    const ground = getComputedStyle(document.body).backgroundColor;
    if (ground && ground !== "transparent" && ground !== "rgba(0, 0, 0, 0)") {
      nudgeChrome(ground);
    }
  }
}

/**
 * Apply a frame now and put it back whenever something removes it, until the
 * returned cleanup runs. The cleanup only stops watching; turning the frame off
 * is `removeBezelFrame`'s job.
 *
 * A mutation observer's callback runs before the next paint, so a wipe is
 * repaired in the same frame it happened in. The repair's own writes trigger
 * the observer once more, find everything in place, and stop.
 */
export function keepBezelFrame(
  root: HTMLElement,
  frame: () => BezelFrame
): () => void {
  const restore = () => {
    const current = frame();
    if (!isApplied(root, current)) applyBezelFrame(root, current);
  };
  restore();
  const observer = new MutationObserver(restore);
  observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
  return () => observer.disconnect();
}
