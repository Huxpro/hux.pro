"use client";

// ---------------------------------------------------------------------------
// Widget morph — a widget opens into its page the way an iOS widget opens its
// app: the card grows into the screen and the page is what it grows into, and
// going back home shrinks the page into the card it came from.
//
// It is one View Transition name, `widget-morph`, worn by two different
// elements across the navigation:
//
//   open    old: the tapped card   →  new: the page's `:root` (the viewport)
//   close   old: the page's `:root` →  new: the card, back on the home grid
//
// so the browser draws one group moving between the card's box and the
// screen, with the card's snapshot and the page's crossfading inside it. The
// home screen is the `root` group on the other side of it: it recedes behind
// an opening card and comes forward under a closing one (globals.css,
// "Widget Morph").
//
// Which element wears the name is decided by CSS, not per-navigation code:
// while `html[data-widget-morph]` is set, the element marked
// `data-morph-source` wears it, and when no such element is on the page,
// `:root` does. The card is marked on the tap and is gone once the page
// commits; on the way back, the card marks itself when the home grid mounts.
// That is what lets the close run from anything that goes home — the λhux
// link, ⌘K, the browser's back button — without any of them knowing.
//
// `html[data-widget-morph]` is the phase: `open` while the card grows,
// `opened` resting on the page it opened (primed to close), `close` while it
// shrinks back. Only `open` and `close` carry keyframes, so a view transition
// that is neither — the solar theme's crossfade, a link onward from the page —
// meets a plain crossfade of the renamed root, the same as the `root` one.
//
// Phases end when the transition does. The transitions themselves are started
// by `next-view-transitions` (links, the router) and by the browser's own
// back button handling in that library, so there is no transition object to
// hold; `document.startViewTransition` is wrapped once, here, to hear about
// each one and settle the phase on its `finished`.
// ---------------------------------------------------------------------------

const ATTR = "data-widget-morph";
export const MORPH_SOURCE_ATTR = "data-morph-source";

type Phase = "idle" | "open" | "opened" | "close";

interface MorphState {
  phase: Phase;
  /** Which card: its `morphKey`, the same on every mount of the home grid. */
  key: string | null;
  /** The pathname the card opened. Close is offered only from here. */
  path: string | null;
}

const state: MorphState = { phase: "idle", key: null, path: null };

/** An armed open that no transition picked up (the link was intercepted). */
let armTimer: number | undefined;
/** The card marked for an open, cleared if the open never happens. */
let armedEl: HTMLElement | null = null;

function setPhase(phase: Phase) {
  state.phase = phase;
  const root = document.documentElement;
  if (phase === "idle") root.removeAttribute(ATTR);
  else root.setAttribute(ATTR, phase);
}

function reset() {
  window.clearTimeout(armTimer);
  armedEl?.removeAttribute(MORPH_SOURCE_ATTR);
  armedEl = null;
  state.key = null;
  state.path = null;
  setPhase("idle");
}

function supported() {
  return (
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Pathname of an in-site `href`, or null for anything that leaves the site. */
function internalPath(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

/**
 * Mark `card` as the shape the next navigation opens from. Called on the
 * tap, before the router starts its view transition — the old state is
 * captured a frame later, so the mark is in place by then.
 */
export function armWidgetMorph(card: HTMLElement, key: string, href: string) {
  if (!supported()) return;
  const path = internalPath(href);
  // Same page (a hash on home) is not an open.
  if (!path || path === window.location.pathname) return;
  installHook();
  reset();
  armedEl = card;
  card.setAttribute(MORPH_SOURCE_ATTR, "");
  state.key = key;
  state.path = path;
  setPhase("open");
  // The tap may never become a navigation — an attachment opens in a sheet,
  // a modified click opens a tab. Nothing then should keep the mark.
  armTimer = window.setTimeout(() => {
    if (state.phase === "open" && armedEl === card) reset();
  }, 1500);
}

/**
 * Called by a card as it mounts on the home grid: if it is the card the
 * current page was opened from, it becomes the shape the page closes into.
 * Returns whether it did. A card off-screen (home restored scrolled away
 * from it) declines, and the page just crossfades home instead of flying
 * somewhere nobody is looking.
 */
export function claimWidgetMorph(card: HTMLElement, key: string): boolean {
  // Only inside a transition: a home reached some other way (a plain link, a
  // reload of history) has nothing to close, and a mark left on the card
  // would ride into the next unrelated transition.
  if (state.phase !== "opened" || state.key !== key || inFlight === 0) {
    return false;
  }
  const r = card.getBoundingClientRect();
  if (r.bottom <= 0 || r.top >= window.innerHeight) return false;
  card.setAttribute(MORPH_SOURCE_ATTR, "");
  armedEl = card;
  setPhase("close");
  return true;
}

let installed = false;
/** View transitions started and not yet finished. */
let inFlight = 0;

function installHook() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const start = document.startViewTransition.bind(document);
  document.startViewTransition = ((arg?: unknown) => {
    const transition = start(arg as ViewTransitionUpdateCallback);
    inFlight++;
    transition.finished.finally(() => inFlight--);
    const phase = state.phase;
    if (phase === "open") {
      window.clearTimeout(armTimer);
      transition.finished.finally(() => {
        if (state.phase !== "open") return;
        armedEl?.removeAttribute(MORPH_SOURCE_ATTR);
        armedEl = null;
        // Landed where the card said it would: stay primed to close there.
        if (window.location.pathname === state.path) setPhase("opened");
        else reset();
      });
    } else if (phase === "opened") {
      transition.finished.finally(() => {
        // Went home (closed, or crossfaded because the card declined) or
        // onward: either way the page it opened is behind us. A transition
        // that stays on the page (the theme) keeps it primed.
        if (window.location.pathname !== state.path) reset();
      });
    }
    return transition;
  }) as typeof document.startViewTransition;
}
