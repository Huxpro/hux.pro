"use client";

import { useEffect, useRef } from "react";
import { subscribeWindowBodies, type WindowBodies } from "../lib/sky-bodies";
import { useWeather } from "../provider";
import { MoonGlyph, SunGlyph } from "./body-glyph";

// ---------------------------------------------------------------------------
// SkyBodyHints — which way to turn to find the sun or the moon.
//
// Through the sky window the bodies are where they really are, which is most
// of the time not in front of you. A sky with no moon in it and no idea where
// it went is a window that has lost its point. So a body that is off the glass
// (to a side, overhead, behind you) gets a hint at the edge of the screen: its
// own solid glyph and a small chevron pointing past it, sitting on the line
// from the centre of the screen toward the body — turn that way and it comes
// into the window, and the hint lets go of it.
//
// Quiet on purpose: small, faint, no label, no motion of its own beyond
// following the body. The sky is the thing to look at; this only says where.
// Only once the window has fully opened and the bodies have landed (their
// flight in IS the first hint), only for a body that is up — a moon lost in the
// daylight or below the horizon is not one to go looking for — and never for
// one already on screen, clouded or not.
//
// Sixty frames a second from the renderer (lib/sky-bodies.ts) and no React
// render per frame: each hint's element is moved and faded by hand.
// ---------------------------------------------------------------------------

/** How far in from the edges a hint sits, px. The top clears the settle spinner. */
const EDGE = { side: 26, top: 64, bottom: 72 };
/** How far past the glyph the chevron sits, px. */
const CHEVRON_OFFSET = 15;
const HINT_OPACITY = 0.6;

type Body = WindowBodies["sun"];

function place(el: HTMLElement | null, body: Body | null, settled: boolean) {
  if (!el) return;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const show = settled && !!body?.up;
  if (!show || !body) {
    el.style.opacity = "0";
    return;
  }
  const px = body.x * W;
  const py = (1 - body.y) * H;
  // On the glass already: the body is its own hint.
  if (body.ahead > 0 && px >= 0 && px <= W && py >= 0 && py <= H) {
    el.style.opacity = "0";
    return;
  }
  const cx = W / 2;
  const cy = H / 2;
  const dx = px - cx;
  const dy = py - cy;
  const reachX = Math.abs(dx) > 1e-3 ? (W / 2 - EDGE.side) / Math.abs(dx) : Infinity;
  const reachY =
    Math.abs(dy) > 1e-3
      ? (dy < 0 ? H / 2 - EDGE.top : H / 2 - EDGE.bottom) / Math.abs(dy)
      : Infinity;
  const t = Math.min(reachX, reachY);
  const x = cx + dx * t;
  const y = cy + dy * t;
  const angle = Math.atan2(dy, dx);
  el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  el.style.opacity = String(HINT_OPACITY);
  const chevron = el.querySelector<HTMLElement>("[data-chevron]");
  if (chevron) {
    const ox = Math.cos(angle) * CHEVRON_OFFSET;
    const oy = Math.sin(angle) * CHEVRON_OFFSET;
    chevron.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px) rotate(${angle}rad)`;
  }
}

function Hint({
  hintRef,
  children,
}: {
  hintRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={hintRef}
      className="absolute left-0 top-0 opacity-0 transition-opacity duration-500"
      style={{ willChange: "transform, opacity" }}
    >
      {/* Centred on the point the hint stands for. */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex h-5 w-5 items-center justify-center">
          {children}
          <span data-chevron="" className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 8 8" className="h-2.5 w-2.5" aria-hidden>
              <path d="M2 1.2 L5.6 4 L2 6.8 Z" className="fill-foreground/85" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export function SkyBodyHints() {
  const { scene } = useWeather();
  const sunRef = useRef<HTMLDivElement | null>(null);
  const moonRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () =>
      subscribeWindowBodies((bodies) => {
        place(sunRef.current, bodies?.sun ?? null, !!bodies?.settled);
        place(moonRef.current, bodies?.moon ?? null, !!bodies?.settled);
      }),
    []
  );

  return (
    <div aria-hidden="true" className="ink-bare pointer-events-none fixed inset-0 z-30">
      <Hint hintRef={sunRef}>
        <SunGlyph className="h-3.5 w-3.5" />
      </Hint>
      <Hint hintRef={moonRef}>
        <MoonGlyph
          phase={scene.moon.phase}
          mirror={scene.hemisphere === -1}
          className="h-3.5 w-3.5"
        />
      </Hint>
    </div>
  );
}
