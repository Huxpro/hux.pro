"use client";

import { flipOpen } from "./widget-flip";

// ---------------------------------------------------------------------------
// Widget morph — a widget opens into its page the way an iOS widget opens its
// app: the card grows into the screen and the page is what it grows into.
// Leaving the page is not the same flight backwards: the page fades out
// quickly over what it leaves for, the home screen already in place.
//
// The open is one View Transition name, `widget-morph`, worn by two different
// elements across the navigation:
//
//   old: the tapped card  →  new: the page's `:root` (the viewport)
//
// so the browser draws one group moving from the card's box to the screen,
// with the card's snapshot giving way to the page's inside it. The home
// screen is the `root` group behind it and leans in as the card opens
// (globals.css, "Widget Morph").
//
// Which element wears the name is decided by CSS: while
// `html[data-widget-morph]` is set, the element marked `data-morph-source`
// wears it, and when no such element is on the page, `:root` does. The card
// is marked on the tap and is gone once the page commits.
//
// `html[data-widget-morph]` is the phase: `open` while the card grows, and
// `opened` resting on the page it opened. From `opened`, `:root` wears the
// name on both sides of whatever transition comes next, and the page's
// snapshot fades out over the new state — home, a page onward, the solar
// theme's recolour of the same page. Going home is that quick fade, not a
// shrink back into the card: a page folding into a card that is still
// rendering read as noise, where a fade reads as leaving.
//
// The open never waits on the network. `next-view-transitions` starts the
// transition on the tap and resolves its update only once the route has
// committed, and until then the browser holds the page frozen — a second or
// more for a route that has not been fetched. So an open is given a budget
// (`LAUNCH_BUDGET_MS`): a page that commits inside it is what the card grows
// into; one that does not gets a launch screen in its place, the way an iOS
// app that is not ready opens onto its launch screen. The card grows into
// that at once, and the page renders onto it when it lands.
//
// Only on a one-column grid (`fillsScreenWidth`): a card that is a quarter of
// a desktop's screen opens its page at a quarter scale into a window the page
// does not have, and that reads as noise, not as the card opening. Wider
// grids get the crossfade.
//
// The whole thing is behind the devtool's Widgets › Open morph
// (`WIDGET_MORPH_DEFAULT`): off, `WidgetShell` never arms, so the wrapper
// below is never installed and nothing here runs; `everywhere` lifts the
// one-column limit, to compare.
//
// Phases end when the transition does. The transitions themselves are started
// by `next-view-transitions` (links, the router) and by the browser's own
// back button handling in that library, so there is no transition object to
// hold; `document.startViewTransition` is wrapped once, here, to hear about
// each one and settle the phase on its `finished`.
// ---------------------------------------------------------------------------

const ATTR = "data-widget-morph";
export const MORPH_SOURCE_ATTR = "data-morph-source";

type Phase = "idle" | "open" | "opened" | "flip" | "flipping";

interface MorphState {
  phase: Phase;
  /** The pathname the card opened. `opened` holds only while on it. */
  path: string | null;
}

const state: MorphState = { phase: "idle", path: null };

/**
 * How long an open waits for its page before growing into a launch screen
 * instead. The page is frozen for this long, so it is a press, not a load.
 */
const LAUNCH_BUDGET_MS = 120;

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
 * Whether `card` spans the screen the way a phone's one-column grid does —
 * the only layout the morph reads in. Measured, not a breakpoint, because
 * what it depends on is the ratio itself:
 *
 *   390×844    card 88% of the width: the page arrives at 88% scale, its
 *              title where the card's title was (21px in, both), body text
 *              at 13px, and the growth is mostly downward, as on iOS.
 *   1440×900   card 23% × 26%: the page arrives at a quarter scale with
 *              4px text, its title 82px into the card against the card's
 *              21px, and grows into a full-screen window whose edge the
 *              page does not have (it is a 680px column on the wallpaper).
 *
 * A tablet or a phone on its side has a grid of two or three columns and is
 * the desktop case, only milder (43% → 6.5px text, the titles apart).
 */
export function fillsScreenWidth(card: HTMLElement): boolean {
  return card.getBoundingClientRect().width >= window.innerWidth * 0.8;
}

/**
 * The Motion take (widget-flip.ts): mark `card` to open the next navigation
 * by growing into the live page, with no view transition at all. The router
 * still calls `startViewTransition`; the wrapper skips it before it captures
 * anything and hands the card to the flip instead.
 */
export function armWidgetFlip(card: HTMLElement, href: string) {
  if (!supported()) return;
  const path = internalPath(href);
  if (!path || path === window.location.pathname) return;
  installHook();
  reset();
  armedEl = card;
  state.path = path;
  setPhase("flip");
  armTimer = window.setTimeout(() => {
    if (state.phase === "flip" && armedEl === card) reset();
  }, 1500);
}

/**
 * Mark `card` as the shape the next navigation opens from. Called on the
 * tap, before the router starts its view transition — the old state is
 * captured a frame later, so the mark is in place by then.
 */
export function armWidgetMorph(card: HTMLElement, href: string) {
  if (!supported()) return;
  const path = internalPath(href);
  // Same page (a hash on home) is not an open.
  if (!path || path === window.location.pathname) return;
  installHook();
  reset();
  armedEl = card;
  card.setAttribute(MORPH_SOURCE_ATTR, "");
  state.path = path;
  setPhase("open");
  // The tap may never become a navigation — an attachment opens in a sheet,
  // a modified click opens a tab. Nothing then should keep the mark.
  armTimer = window.setTimeout(() => {
    if (state.phase === "open" && armedEl === card) reset();
  }, 1500);
}

/**
 * The open's update, raced against the budget. `arg` is whatever the router
 * handed `startViewTransition` — a callback, or `{ update }`. Hands the
 * route's own commit to `open.landing`, which the open waits on before it
 * calls itself done: with a launch screen up, the transition ends before the
 * page lands.
 */
function budgeted(
  arg: unknown,
  open: { landing: Promise<unknown> | null },
): ViewTransitionUpdateCallback {
  const update =
    typeof arg === "function"
      ? (arg as () => unknown)
      : (arg as { update?: () => unknown } | undefined)?.update;
  return () => {
    let landed = false;
    const page = Promise.resolve(update?.()).finally(() => {
      landed = true;
    });
    // A route that never commits (a failed fetch) must not hold the screen.
    const landing = Promise.race([page, wait(LAUNCH_GIVE_UP_MS)]);
    open.landing = landing;
    const budget = wait(LAUNCH_BUDGET_MS).then(() => {
      if (!landed) showLaunch(landing);
    });
    return Promise.race([page, budget]);
  };
}

const LAUNCH_GIVE_UP_MS = 8000;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Stand a launch screen in for a page that is still loading: the home screen
 * with its content hidden, which is the wallpaper and the chrome the page
 * will have too. The card lets go of the name (the old state is already
 * captured), so `:root` wears it and the card grows into that bare ground;
 * the page then renders onto the same ground when it commits, and the home
 * it replaces goes with it. Given up on, the home comes back.
 */
function showLaunch(page: Promise<unknown>) {
  armedEl?.removeAttribute(MORPH_SOURCE_ATTR);
  const home = armedEl?.closest("main");
  if (!home) return;
  // Opacity, not visibility: a descendant can make itself visible again.
  home.style.opacity = "0";
  home.style.pointerEvents = "none";
  page.finally(() => {
    if (!home.isConnected) return;
    home.style.opacity = "";
    home.style.pointerEvents = "";
  });
}

let installed = false;

function installHook() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const start = document.startViewTransition.bind(document);
  // A back swipe the browser has already animated (iOS Safari's edge swipe)
  // has already taken the page away: fading it out again over home would
  // flash it back. Capture, so this runs before the router's own popstate
  // listener starts its transition.
  window.addEventListener(
    "popstate",
    (e) => {
      if (e.hasUAVisualTransition && state.phase === "opened") reset();
    },
    { capture: true },
  );
  document.startViewTransition = ((arg?: unknown) => {
    if (state.phase === "flip" && armedEl) {
      // Skipped before the old state is captured: the update still runs,
      // the page is never frozen, and nothing is drawn but the flip.
      const skipped = start(arg as ViewTransitionUpdateCallback);
      skipped.skipTransition();
      skipped.ready.catch(() => {});
      window.clearTimeout(armTimer);
      const card = armedEl;
      armedEl = null;
      setPhase("flipping");
      flipOpen(card).finally(() => {
        if (state.phase !== "flipping") return;
        if (window.location.pathname === state.path) setPhase("opened");
        else reset();
      });
      return skipped;
    }
    const open = { landing: null as Promise<unknown> | null };
    const transition = start(
      (state.phase === "open"
        ? budgeted(arg, open)
        : arg) as ViewTransitionUpdateCallback,
    );
    const phase = state.phase;
    if (phase === "open") {
      window.clearTimeout(armTimer);
      transition.finished.finally(() => open.landing).finally(() => {
        if (state.phase !== "open") return;
        armedEl?.removeAttribute(MORPH_SOURCE_ATTR);
        armedEl = null;
        // Landed where the card said it would: leaving it will fade.
        if (window.location.pathname === state.path) setPhase("opened");
        else reset();
      });
    } else if (phase === "opened") {
      transition.finished.finally(() => {
        // Went home or onward: the page it opened is behind us. A
        // transition that stays on the page (the theme) keeps the phase.
        if (window.location.pathname !== state.path) reset();
      });
    }
    return transition;
  }) as typeof document.startViewTransition;
}
