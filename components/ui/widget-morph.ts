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
// The open never waits on the network. `next-view-transitions` starts the
// transition on the tap and resolves its update only once the route has
// committed, and until then the browser holds the page frozen — a second or
// more for a route that has not been fetched. So an open is given a budget
// (`LAUNCH_BUDGET_MS`): a page that commits inside it is what the card grows
// into; one that does not gets a launch screen in its place, the way an iOS
// app that is not ready opens onto its launch screen. The card grows into
// that at once, and the page renders onto it when it lands.
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
/** View transitions started and not yet finished. */
let inFlight = 0;

function installHook() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const start = document.startViewTransition.bind(document);
  // A back swipe the browser has already animated (iOS Safari's edge swipe)
  // is not closed a second time. Capture, so this runs before the router's
  // own popstate listener starts its transition.
  window.addEventListener(
    "popstate",
    (e) => {
      if (e.hasUAVisualTransition && state.phase === "opened") reset();
    },
    { capture: true },
  );
  document.startViewTransition = ((arg?: unknown) => {
    const open = { landing: null as Promise<unknown> | null };
    const transition = start(
      (state.phase === "open"
        ? budgeted(arg, open)
        : arg) as ViewTransitionUpdateCallback,
    );
    inFlight++;
    transition.finished.finally(() => inFlight--);
    const phase = state.phase;
    if (phase === "open") {
      window.clearTimeout(armTimer);
      transition.finished.finally(() => open.landing).finally(() => {
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
