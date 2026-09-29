"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { subscribeWindowBodies, type WindowBodies } from "../lib/sky-bodies";
import { sunEventOf } from "../lib/phase";
import { useAmbientTime, useWeather } from "../provider";
import { MoonGlyph, SunEventGlyph, SunGlyph } from "./body-glyph";

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
// Except the sun through a sunrise or a sunset: then its hint is the event's
// glyph and points at `sun.light` — the sun, or the horizon under it once it
// has set. See "The Sky Window" in docs/system-ambient.md.
//
// Sixty frames a second from the renderer (lib/sky-bodies.ts) and no React
// render per frame: each hint's element is moved and faded by hand.
// ---------------------------------------------------------------------------

/** How far in from the edges a hint sits, px. The top clears the settle spinner. */
const EDGE = { side: 26, top: 64, bottom: 72 };
/** How far past the glyph the chevron sits, px. */
const CHEVRON_OFFSET = 15;
const HINT_OPACITY = 0.6;

type Body = Omit<WindowBodies["sun"], "light">;

/** The viewport, measured on resize rather than read sixty times a second. */
const viewport = { w: 0, h: 0 };

/**
 * One hint's element and what was last written to it, so a frame that would
 * write the same position, angle or opacity again writes nothing.
 */
interface Placed {
  el: HTMLElement;
  chevron: HTMLElement | null;
  transform: string;
  chevronTransform: string;
  opacity: string;
}

function placed(el: HTMLElement): Placed {
  return {
    el,
    chevron: el.querySelector<HTMLElement>("[data-chevron]"),
    transform: "",
    chevronTransform: "",
    opacity: "0",
  };
}

function setOpacity(hint: Placed, opacity: string) {
  if (hint.opacity === opacity) return;
  hint.opacity = opacity;
  hint.el.style.opacity = opacity;
}

function place(hint: Placed | null, body: Body | null, settled: boolean) {
  if (!hint) return;
  const { w: W, h: H } = viewport;
  if (!settled || !body?.up) return setOpacity(hint, "0");
  const px = body.x * W;
  const py = (1 - body.y) * H;
  // On the glass already: the body is its own hint.
  if (body.ahead > 0 && px >= 0 && px <= W && py >= 0 && py <= H) return setOpacity(hint, "0");
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
  const transform = `translate3d(${(cx + dx * t).toFixed(1)}px, ${(cy + dy * t).toFixed(1)}px, 0)`;
  if (transform !== hint.transform) {
    hint.transform = transform;
    hint.el.style.transform = transform;
  }
  setOpacity(hint, String(HINT_OPACITY));
  if (hint.chevron) {
    const angle = Math.atan2(dy, dx);
    const ox = (Math.cos(angle) * CHEVRON_OFFSET).toFixed(1);
    const oy = (Math.sin(angle) * CHEVRON_OFFSET).toFixed(1);
    const chevronTransform = `translate(${ox}px, ${oy}px) rotate(${angle.toFixed(3)}rad)`;
    if (chevronTransform !== hint.chevronTransform) {
      hint.chevronTransform = chevronTransform;
      hint.chevron.style.transform = chevronTransform;
    }
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
  const { phase } = useAmbientTime();
  const event = sunEventOf(phase);
  // What the sun's hint points at: the body, or through a sun event its light.
  // Read by the frame listener, which is subscribed once.
  const sunTarget = useEffectEvent((sun: WindowBodies["sun"]) => (event ? sun.light : sun));
  const sunRef = useRef<HTMLDivElement | null>(null);
  const moonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const measure = () => {
      viewport.w = window.innerWidth;
      viewport.h = window.innerHeight;
    };
    measure();
    window.addEventListener("resize", measure);
    const sun = sunRef.current ? placed(sunRef.current) : null;
    const moon = moonRef.current ? placed(moonRef.current) : null;
    const stop = subscribeWindowBodies((bodies) => {
      place(sun, bodies ? sunTarget(bodies.sun) : null, !!bodies?.settled);
      place(moon, bodies?.moon ?? null, !!bodies?.settled);
    });
    return () => {
      stop();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div aria-hidden="true" className="ink-bare pointer-events-none fixed inset-0 z-30">
      <Hint hintRef={sunRef}>
        {event ? (
          <SunEventGlyph event={event} />
        ) : (
          <SunGlyph className="h-3.5 w-3.5" />
        )}
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
