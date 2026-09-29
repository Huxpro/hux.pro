"use client";

import { animate } from "motion";

// ---------------------------------------------------------------------------
// Widget flip — the Motion take on a widget opening its page.
//
// The view-transition morph (widget-morph.ts) animates *pictures*: the card's
// snapshot and the page's, captured by the browser, scaled inside one group.
// This animates the page itself. Nothing is captured and no view transition
// runs (the router's is skipped before it captures anything), so there is no
// frozen frame while the route loads and what arrives is live, laid-out DOM.
//
// One spring, `p` from 0 to 1, drives a rectangle from the card's box to the
// page's: the viewport on a phone, the page's column (`main`, 680px) on a
// wider screen — a shape the page actually has, which is what the morph could
// not offer a desktop. Two things wear that rectangle in turn:
//
//   before the route commits   a frame: the card's glass and a copy of the
//                              card, over the home, which fades back
//   after                      the page's own `main`, FLIP'd — scaled by the
//                              rectangle's width over its own, moved to the
//                              rectangle, clipped to its height and corners,
//                              on the same glass
//
// so the card becomes a window and the page is found inside it, on the same
// curve, whenever in the spring the route happens to land. Once the spring
// has settled and the page is there, the glass fades and the page is just the
// page. A route slower than the spring leaves the frame at the page's shape
// — a launch screen — and the page appears under it.
//
// The home fades rather than staying behind, because it cannot stay: the
// route replaces it. That, and the absence of any gesture, is the price of
// not changing how pages are routed; the overlay prototype pays the other
// price.
// ---------------------------------------------------------------------------

/** The page column's width, as `--page-col` sets it. */
const PAGE_COL = 680;

/** Closer to UIKit's app launch than to a sheet: quick, a hair of give. */
const SPRING = { type: "spring", visualDuration: 0.45, bounce: 0.1 } as const;

/** A route that never lands must not hold the frame up. */
const GIVE_UP_MS = 8000;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpBox(a: Box, b: Box, t: number): Box {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
  };
}

/** Where the page will be, before it exists to measure. */
function estimateTarget(): Box {
  const vw = window.innerWidth;
  const w = Math.min(vw, PAGE_COL);
  return { x: (vw - w) / 2, y: 0, w, h: window.innerHeight };
}

/**
 * Grow `card` into the page the router is about to commit. Called as the
 * navigation starts; resolves once the page stands on its own.
 */
export function flipOpen(card: HTMLElement): Promise<void> {
  const home = card.closest("main");
  const r = card.getBoundingClientRect();
  const from: Box = { x: r.left, y: r.top, w: r.width, h: r.height };
  const cardStyle = getComputedStyle(card);
  const radius = parseFloat(cardStyle.borderTopLeftRadius) || 16;
  // The window's material: the panel glass, a step denser than the card's,
  // and no blur. A 24px backdrop blur on a surface that grows to the screen
  // cost ~13ms of compositing a frame, measured (≈19 with it, ≈5 without,
  // against ≈12 for the plain crossfade); the denser tint carries what the
  // blur did — the home under it fades out in the same breath — and
  // `--glass-sheet` is so near opaque it read as a white flash on a route
  // that landed late.
  const glass = "var(--glass-overlay)";
  let target = estimateTarget();

  // --- The frame: the card, lifted off the grid ----------------------------
  const frame = document.createElement("div");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, {
    position: "fixed",
    left: "0",
    top: "0",
    zIndex: "55",
    overflow: "hidden",
    pointerEvents: "none",
    background: glass,
    willChange: "transform",
  } satisfies Partial<CSSStyleDeclaration>);
  // What the card showed, at its own size, giving way as the frame grows.
  const copy = card.cloneNode(true) as HTMLElement;
  Object.assign(copy.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${r.width}px`,
    height: `${r.height}px`,
    margin: "0",
    border: "0",
    background: "transparent",
    backdropFilter: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  frame.appendChild(copy);
  document.body.appendChild(frame);
  card.style.visibility = "hidden";
  copy.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 140,
    easing: "ease-out",
    fill: "forwards",
  });
  const recede = home?.animate(
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(1.04)" },
    ],
    { duration: 260, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
  );

  // --- The page, once the route commits it ---------------------------------
  let page: HTMLElement | null = null;
  let pageBox: Box | null = null; // main's untransformed box
  let pageScrollY = 0;

  const findPage = () => {
    const main = document.querySelector("main");
    if (!main || main === home || !main.isConnected) return false;
    page = main as HTMLElement;
    const b = page.getBoundingClientRect();
    pageBox = { x: b.left, y: b.top, w: b.width, h: b.height };
    pageScrollY = b.top;
    target = { x: b.left, y: 0, w: b.width, h: window.innerHeight };
    frame.remove();
    // The page's content arrives into the window rather than appearing in
    // it: its blocks fade up while the glass they sit on is already there.
    for (const child of Array.from(page.children)) {
      (child as HTMLElement).animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 160,
        easing: "ease-out",
      });
    }
    Object.assign(page.style, {
      transformOrigin: "0 0",
      background: glass,
      willChange: "transform, clip-path",
    } satisfies Partial<CSSStyleDeclaration>);
    return true;
  };

  let progress = 0;
  const apply = (t: number) => {
    progress = t;
    const box = lerpBox(from, target, t);
    const rad = lerp(radius, 0, Math.min(Math.max(t, 0), 1));
    if (!page || !pageBox) {
      frame.style.width = `${box.w}px`;
      frame.style.height = `${box.h}px`;
      frame.style.transform = `translate(${box.x}px, ${box.y}px)`;
      frame.style.borderRadius = `${rad}px`;
      return;
    }
    // FLIP: the page's viewport-top strip, `target`, scaled into `box`.
    // Origin is main's own top-left, at (pageBox.x, pageScrollY).
    const s = box.w / target.w;
    const lx = target.x - pageBox.x; // target's left, in main's coordinates
    const ly = -pageScrollY; // the viewport's top, in main's coordinates
    const tx = box.x - pageBox.x - s * lx;
    const ty = box.y - pageScrollY - s * ly;
    page.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    const top = Math.max(0, ly);
    const left = lx;
    const right = pageBox.w - (lx + box.w / s);
    const bottom = pageBox.h - (ly + box.h / s);
    page.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${rad / s}px)`;
  };

  apply(0);

  // Found on a frame, not in React: the page is whatever `main` the router
  // commits next, and this module is not in its tree.
  let polling = true;
  const poll = () => {
    if (!polling) return;
    if (findPage()) {
      apply(progress);
      return;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);

  const spring = animate(0, 1, { ...SPRING, onUpdate: apply });

  const landed = new Promise<void>((resolve) => {
    const started = performance.now();
    const wait = () => {
      if (page) return resolve();
      if (performance.now() - started > GIVE_UP_MS) return resolve();
      requestAnimationFrame(wait);
    };
    wait();
  });

  return Promise.resolve(spring)
    .then(() => landed)
    .then(() => {
      polling = false;
      recede?.cancel();
      if (!page) {
        // Never landed: put the home back as it was.
        card.style.visibility = "";
        frame.remove();
        return;
      }
      // If the page came after the spring, it took over a frame that was
      // standing at its shape as a launch screen; either way it is now at
      // rest, on the glass. The glass goes, and the page is just the page.
      const main: HTMLElement = page;
      const glassOut = main.animate(
        [
          { backgroundColor: getComputedStyle(main).backgroundColor },
          { backgroundColor: "transparent" },
        ],
        { duration: 180, easing: "ease-out" },
      );
      Object.assign(main.style, {
        transform: "",
        clipPath: "",
        background: "",
        willChange: "",
        transformOrigin: "",
      } satisfies Partial<CSSStyleDeclaration>);
      return glassOut.finished.then(() => undefined, () => undefined);
    });
}
