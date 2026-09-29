"use client";

import { useEffect } from "react";

// =============================================================================
// Material ripple — Android's touch feedback, for the whole site.
//
// In the Material skin, pressing anything pressable draws Compose's ripple:
// a circle of the element's content colour at the pressed state layer's 10%,
// born at the finger, growing and drifting to the element's centre until it
// covers it, and fading once the press is over. The numbers are Compose's
// own (androidx.compose.material.ripple, `RippleAnimation`):
//
//   start radius   30% of the element's longer side
//   end radius     half its diagonal + 10dp (a bounded ripple overshoots
//                  the corners so they fill as fast as the middle)
//   radius         225ms, FastOutSlowIn
//   centre         225ms, linear, from the touch point to the centre
//   fade in        75ms, linear
//   fade out       150ms, linear — never before the expansion is done, so a
//                  quick tap still draws the whole wave
//
// A finger waits out the tap timeout (100ms, `ViewConfiguration`) before it
// ripples, as a clickable inside a scrolling container does on Android: a
// press that turns into a scroll never flashes. A key (Enter / Space) ripples
// from the centre.
//
// One delegated listener, no per-component wiring: the target is the
// innermost pressable under the pointer, and the wave is drawn in a layer on
// <body> that follows the element's box (and its corner radius) while it
// lives, so nothing is inserted into React's tree and no component had to
// agree to be rippled. The layer is gone the moment the element stops being
// the thing under the finger — a sheet opened by the tap covers it, or it
// unmounts — so a wave never paints over what the tap opened.
//
// What does not ripple: inline text links (Compose's link text has no
// indication), a surface the size of the screen, anything disabled or under
// `data-no-ripple`, and the home grid while it is being edited (a widget
// there is picked up, not pressed).
// =============================================================================

const TARGETS = [
  "button",
  "a[href]",
  "summary",
  "label[for]",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  "[data-ripple]",
  ".widget-surface",
].join(",");

/** Where a press never ripples, whatever it lands on. */
const EXCLUDED = "[data-no-ripple], [data-widget-grid][data-editing]";

/** Pressable by role but not a control: the grid's sortable wrapper (dnd-kit
 *  gives it `role="button"` for the keyboard) — the card inside is the
 *  target, or nothing is. */
const NOT_A_CONTROL = '[aria-roledescription="sortable"]';

const TAP_TIMEOUT_MS = 100;
const TOUCH_SLOP_PX = 8;
const FADE_IN_MS = 75;
const RADIUS_MS = 225;
const FADE_OUT_MS = 150;
const BOUNDED_EXTRA_RADIUS_PX = 10;
const PRESSED_ALPHA = 0.1;
const FAST_OUT_SLOW_IN = "cubic-bezier(0.4, 0, 0.2, 1)";

interface Wave {
  target: HTMLElement;
  host: HTMLDivElement;
  /** Resolves when the wave has finished growing; the fade waits for it. */
  grown: Promise<unknown>;
  released: boolean;
}

interface Pending {
  target: HTMLElement;
  x: number;
  y: number;
  timer: number;
}

const live = new Set<Wave>();
let frame = 0;

function isMaterial() {
  return document.documentElement.dataset.skin === "material";
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function findTarget(from: EventTarget | null): HTMLElement | null {
  if (!(from instanceof Element)) return null;
  const target = from.closest<HTMLElement>(TARGETS);
  if (!target || target.matches(NOT_A_CONTROL) || target.closest(EXCLUDED))
    return null;
  if (
    target.matches(":disabled") ||
    target.getAttribute("aria-disabled") === "true"
  )
    return null;
  const style = getComputedStyle(target);
  if (style.display === "inline" || style.display === "contents") return null;
  const r = target.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  if (r.width * r.height > window.innerWidth * window.innerHeight * 0.5)
    return null;
  return target;
}

/** The content colour at full opacity: a role's `on-` colour, whatever alpha
 *  the text happens to carry (Compose replaces the alpha, it does not
 *  multiply it). */
function opaque(color: string) {
  const stripped = `rgb(from ${color} r g b)`;
  return CSS.supports("color", stripped) ? stripped : color;
}

/** The layer takes the element's box and its corner — every frame, since a
 *  Material button's corner is its state (the play button squares off
 *  under the finger). */
function place(host: HTMLDivElement, target: HTMLElement, r: DOMRect) {
  host.style.left = `${r.left}px`;
  host.style.top = `${r.top}px`;
  host.style.width = `${r.width}px`;
  host.style.height = `${r.height}px`;
  host.style.borderRadius = getComputedStyle(target).borderRadius;
}

/** A widget card's content colour is its container's `on-` role, which the
 *  card's own `color` (the page's ink, for the Glass skin) does not carry. */
function contentColor(target: HTMLElement, style: CSSStyleDeclaration) {
  if (target.matches("[data-widget-shell]")) {
    const role = style.getPropertyValue("--md-on-container").trim();
    if (role) return role;
  }
  return style.color;
}

function press(target: HTMLElement, x: number | null, y: number | null): Wave {
  const r = target.getBoundingClientRect();
  const style = getComputedStyle(target);
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.materialRipple = "";
  Object.assign(host.style, {
    position: "fixed",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "2147483000",
    contain: "strict",
  });
  place(host, target, r);

  const end = Math.hypot(r.width, r.height) / 2 + BOUNDED_EXTRA_RADIUS_PX;
  const start = Math.max(r.width, r.height) * 0.3;
  const cx = r.width / 2;
  const cy = r.height / 2;
  const px = x === null ? cx : x - r.left;
  const py = y === null ? cy : y - r.top;

  const circle = document.createElement("div");
  Object.assign(circle.style, {
    position: "absolute",
    left: `${-end}px`,
    top: `${-end}px`,
    width: `${end * 2}px`,
    height: `${end * 2}px`,
    borderRadius: "50%",
    background: opaque(contentColor(target, style)),
    opacity: "0",
    translate: `${cx}px ${cy}px`,
  });
  host.append(circle);
  document.body.append(host);

  // With animations removed, Android shows the pressed layer flat.
  const still = reducedMotion();
  const anims = [
    circle.animate([{ opacity: 0 }, { opacity: PRESSED_ALPHA }], {
      duration: still ? 0 : FADE_IN_MS,
      easing: "linear",
      fill: "forwards",
    }),
    circle.animate(
      [{ scale: `${still ? 1 : start / end}` }, { scale: "1" }],
      { duration: still ? 0 : RADIUS_MS, easing: FAST_OUT_SLOW_IN, fill: "forwards" },
    ),
    circle.animate(
      [{ translate: `${still ? cx : px}px ${still ? cy : py}px` }, { translate: `${cx}px ${cy}px` }],
      { duration: still ? 0 : RADIUS_MS, easing: "linear", fill: "forwards" },
    ),
  ];

  const wave: Wave = {
    target,
    host,
    grown: Promise.all(anims.map((a) => a.finished)).catch(() => {}),
    released: false,
  };
  live.add(wave);
  if (!frame) frame = requestAnimationFrame(follow);
  return wave;
}

function release(wave: Wave, quick = false) {
  if (wave.released) return;
  wave.released = true;
  const fade = () => {
    const circle = wave.host.firstElementChild as HTMLElement | null;
    const out = circle?.animate([{ opacity: PRESSED_ALPHA }, { opacity: 0 }], {
      duration: quick ? FADE_IN_MS : FADE_OUT_MS,
      easing: "linear",
      fill: "forwards",
    });
    const done = () => {
      live.delete(wave);
      wave.host.remove();
    };
    if (out) out.finished.then(done, done);
    else done();
  };
  if (quick) fade();
  else wave.grown.then(fade);
}

/** Keep each layer on its element's box; drop it when the element is no
 *  longer what the finger is on. */
function follow() {
  frame = 0;
  const dragging = document.documentElement.classList.contains("dragging");
  for (const wave of live) {
    const { target, host } = wave;
    if (!target.isConnected) {
      live.delete(wave);
      host.remove();
      continue;
    }
    const r = target.getBoundingClientRect();
    place(host, target, r);
    if (wave.released) continue;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const covered = hit !== null && !target.contains(hit) && !hit.contains(target);
    if (covered || dragging || target.closest(EXCLUDED)) release(wave, true);
  }
  if (live.size) frame = requestAnimationFrame(follow);
}

export function MaterialRipple() {
  useEffect(() => {
    const waves = new Map<number, Wave>();
    const pending = new Map<number, Pending>();
    let keyWave: Wave | null = null;

    const settle = (id: number) => {
      const p = pending.get(id);
      if (p) {
        window.clearTimeout(p.timer);
        pending.delete(id);
      }
      return p;
    };

    const onDown = (e: PointerEvent) => {
      if (!isMaterial() || !e.isPrimary || e.button !== 0) return;
      const target = findTarget(e.target);
      if (!target) return;
      if (e.pointerType === "mouse") {
        waves.set(e.pointerId, press(target, e.clientX, e.clientY));
        return;
      }
      const timer = window.setTimeout(() => {
        pending.delete(e.pointerId);
        waves.set(e.pointerId, press(target, e.clientX, e.clientY));
      }, TAP_TIMEOUT_MS);
      pending.set(e.pointerId, { target, x: e.clientX, y: e.clientY, timer });
    };

    const onMove = (e: PointerEvent) => {
      const p = pending.get(e.pointerId);
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > TOUCH_SLOP_PX) {
        settle(e.pointerId);
        return;
      }
      // Sliding off the element cancels the press, as it does on Android.
      const wave = waves.get(e.pointerId);
      if (!wave) return;
      const r = wave.target.getBoundingClientRect();
      const out =
        e.clientX < r.left - TOUCH_SLOP_PX ||
        e.clientX > r.right + TOUCH_SLOP_PX ||
        e.clientY < r.top - TOUCH_SLOP_PX ||
        e.clientY > r.bottom + TOUCH_SLOP_PX;
      if (out) {
        waves.delete(e.pointerId);
        release(wave);
      }
    };

    const onUp = (e: PointerEvent) => {
      // A tap shorter than the timeout still ripples: pressed and released
      // on the same frame, the whole wave drawn before it fades.
      const p = settle(e.pointerId);
      if (p) waves.set(e.pointerId, press(p.target, p.x, p.y));
      const wave = waves.get(e.pointerId);
      if (!wave) return;
      waves.delete(e.pointerId);
      release(wave);
    };

    const onCancel = (e: PointerEvent) => {
      settle(e.pointerId);
      const wave = waves.get(e.pointerId);
      if (!wave) return;
      waves.delete(e.pointerId);
      release(wave, true);
    };

    // A scroll that starts inside the tap timeout was never a press.
    const onScroll = () => {
      for (const id of [...pending.keys()]) settle(id);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
      if (!isMaterial() || keyWave) return;
      const target = findTarget(document.activeElement);
      if (!target || target !== document.activeElement) return;
      if (!target.matches(":focus-visible")) return;
      keyWave = press(target, null, null);
    };
    const onKeyUp = () => {
      if (!keyWave) return;
      release(keyWave);
      keyWave = null;
    };

    const opts = { capture: true, passive: true } as const;
    document.addEventListener("pointerdown", onDown, opts);
    document.addEventListener("pointermove", onMove, opts);
    document.addEventListener("pointerup", onUp, opts);
    document.addEventListener("pointercancel", onCancel, opts);
    document.addEventListener("scroll", onScroll, opts);
    document.addEventListener("keydown", onKeyDown, opts);
    document.addEventListener("keyup", onKeyUp, opts);
    window.addEventListener("blur", onKeyUp);
    return () => {
      document.removeEventListener("pointerdown", onDown, opts);
      document.removeEventListener("pointermove", onMove, opts);
      document.removeEventListener("pointerup", onUp, opts);
      document.removeEventListener("pointercancel", onCancel, opts);
      document.removeEventListener("scroll", onScroll, opts);
      document.removeEventListener("keydown", onKeyDown, opts);
      document.removeEventListener("keyup", onKeyUp, opts);
      window.removeEventListener("blur", onKeyUp);
      for (const p of pending.values()) window.clearTimeout(p.timer);
    };
  }, []);

  return null;
}
