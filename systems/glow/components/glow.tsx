"use client";

import { cn } from "@/lib/utils";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { BEZEL_LAYER_ATTRIBUTE } from "vitre";
import { GLOW_CSS_STOPS } from "../lib/palette";
import {
  glowSupported,
  registerGlow,
  wakeGlow,
  type GlowInstance,
  type GlowUniforms,
} from "../lib/renderer";
import { glowTuning } from "../lib/tuning";

// =============================================================================
// <Glow> — the site's one light, on the edge of whatever it is placed in.
//
//   <div className="relative rounded-2xl">       ← the host; the glow reads
//     …                                              its radius
//     <Glow active={listening} shape="line" level={meter.level} />
//   </div>
//
// Two shapes of the same light (lib/shader.ts):
//
//   ring   the whole edge — the About's screen, a badge's halo, a card
//   line   one edge, from the centre out — the bottom of a field listening,
//          the top of a window loading (`edge="top"`)
//
// and two states on top of either:
//
//   level       energy 0–1, a number or a getter sampled every frame (a
//               voice meter: see systems/voice). Reach, brightness and — for
//               a line — how wide it spreads all follow it. Without one the
//               glow rests at 0.45.
//   processing  the light gathers into one short beam that travels: along
//               the bottom and back for a line (thinking, transcribing,
//               loading), around the whole edge for a ring.
//
// It sits `absolute` over its host (which must be `relative`), `bleed` px
// past each side for the halo, and takes no pointer. `fixed` puts it over the
// viewport instead. Nothing is drawn — and nothing costs a frame — while it
// is off and settled, or scrolled off screen. Without WebGL it is a still CSS
// ring in the same colours.
// =============================================================================

export type GlowShape = "ring" | "line";

export interface GlowProps {
  /** On: the light sweeps in and stays. Off: it sweeps out and stops. */
  active: boolean;
  shape?: GlowShape;
  /** Which edge a line runs along. A loading bar sits on top. */
  edge?: "bottom" | "top";
  /** Energy, 0–1: a number, or a getter read every frame. Rest is 0.45. */
  level?: number | (() => number);
  /** Low / mid / high energy, 0–1 each, read every frame — a voice's bands. */
  bands?: () => readonly [number, number, number];
  /** Gather into a travelling beam (thinking, transcribing, loading). */
  processing?: boolean;
  /** How far the light reaches in from the edge, CSS px. Sized to the host
   *  when omitted. */
  reach?: number;
  /** Halo room past each side of the host, CSS px. 0 draws inside only. */
  bleed?: number;
  /** The host's corner radius, px. Read from the host when omitted. */
  radius?: number;
  /** 0–1, the whole effect. The devtool's site-wide strength multiplies it. */
  strength?: number;
  /** Over the viewport rather than the host. */
  fixed?: boolean;
  /** Mark it a vitre bezel layer (absolute rather than fixed in container
   *  scroll). For a `fixed` glow inside the bezel. */
  layer?: boolean;
  /** Seconds to arrive / to leave. */
  inDuration?: number;
  outDuration?: number;
  className?: string;
  style?: CSSProperties;
  /** Called when the light has fully left. */
  onDone?: () => void;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const REST = 0.45;
const REST_BANDS = [1, 1, 1] as const;

function follow(prev: number, target: number, dt: number, tau: number) {
  return prev + (target - prev) * (1 - Math.exp(-dt / Math.max(0.001, tau)));
}

/** The reach a host of this size gets when none is given. */
function defaultReach(shape: GlowShape, w: number, h: number, screen: boolean) {
  const short = Math.min(w, h);
  // A line hugs the edge: it rises into a field, it does not fill it.
  if (shape === "line") return Math.min(14, Math.max(5, h * 0.22));
  // A screen's ring is 16–34px deep; an element's scales down to a hairline.
  return Math.min(38, Math.max(screen ? 18 : 3, short * 0.038));
}

export function Glow({
  active,
  shape = "ring",
  edge = "bottom",
  level,
  bands,
  processing = false,
  reach,
  bleed = 0,
  radius,
  strength = 1,
  fixed = false,
  layer = false,
  inDuration,
  outDuration,
  className,
  style,
  onDone,
}: GlowProps) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  // Everything the frame loop reads lives in a ref: it outlives renders, and
  // a prop change must not restart the animation.
  const props = useRef({
    active, shape, edge, level, bands, processing, reach, bleed, radius, strength,
    inDuration, outDuration, onDone,
  });
  useLayoutEffect(() => {
    props.current = {
      active, shape, edge, level, bands, processing, reach, bleed, radius, strength,
      inDuration, outDuration, onDone,
    };
  });

  const inst = useRef<(GlowInstance & { hostRadius: number; wake: () => void }) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    if (!glowSupported()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the GPU said no: nothing to render into
      setFallback(true);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const epoch = performance.now();
    const m = {
      reveal: 0,
      from: 0,
      target: 0,
      changedAt: 0,
      surgeAt: -Infinity,
      scan: 0, // processing blend, 0–1
      scanT: 0,
      level: REST,
    };

    const readRadius = () => {
      const host = fixed ? null : box.parentElement;
      if (!host) return 0;
      const r = parseFloat(getComputedStyle(host).borderTopLeftRadius);
      return Number.isFinite(r) ? r : 0;
    };

    const instance: GlowInstance & { hostRadius: number; wake: () => void } = {
      canvas,
      visible: true,
      hostRadius: readRadius(),
      wake: () => wakeGlow(instance),
      frame: (now, dt) => {
        const p = props.current;
        const target = p.active ? 1 : 0;
        if (target !== m.target) {
          m.from = m.reveal;
          m.target = target;
          m.changedAt = now;
          if (target) m.surgeAt = now;
        }
        const arriving = m.target > m.from;
        const dur = 1000 * (arriving ? (p.inDuration ?? (fixed ? 1.1 : 0.6)) : (p.outDuration ?? (fixed ? 0.52 : 0.35)));
        const k = Math.min(1, (now - m.changedAt) / dur);
        m.reveal = m.from + (m.target - m.from) * (arriving ? easeOut(k) : easeInOut(k));
        if (m.target === 0 && k >= 1) {
          p.onDone?.();
          return null;
        }
        const surgeMs = fixed ? 900 : 600;
        const surge = Math.max(0, 1 - (now - m.surgeAt) / surgeMs) ** 2 * m.target;

        // Energy.
        const raw = typeof p.level === "function" ? p.level() : p.level;
        const lvl = raw == null ? REST : Math.max(0, Math.min(1, raw));
        m.level = typeof p.level === "function" ? lvl : follow(m.level, lvl, dt, 0.25);
        const b = p.bands ? p.bands() : REST_BANDS;

        // Processing: a short beam travelling, blended in and out.
        m.scan = follow(m.scan, p.processing ? 1 : 0, dt, 0.35);
        if (p.processing) m.scanT += dt;
        else if (m.scan < 0.001) m.scanT = 0;
        const blend = m.scan * m.scan * (3 - 2 * m.scan);

        const still = reduced.matches;
        let focus = 0;
        let focusAt = 0.25;
        if (p.shape === "line") {
          // The bottom arc, spreading with the voice.
          const rest = 0.085 + 0.07 * m.level;
          const period = 1.1;
          const u = (m.scanT / period) % 2;
          const pass = still ? 0 : u < 1 ? easeInOut(u) * 2 - 1 : 1 - easeInOut(u - 1) * 2;
          focus = rest + (0.045 - rest) * blend;
          focusAt = 0.25 + 0.085 * pass * blend;
        } else if (blend > 0.001) {
          // A comet around the whole ring.
          focus = 0.5 + (0.075 - 0.5) * blend;
          focusAt = 0.25 + (still ? 0 : m.scanT * 0.45);
        }

        const w = canvas.clientWidth - 2 * (p.bleed ?? 0);
        const h = canvas.clientHeight - 2 * (p.bleed ?? 0);
        const area = canvas.clientWidth * canvas.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const hold =
          still && k >= 1 && surge === 0 && typeof p.level !== "function" && !p.bands && m.scan < 0.001;
        return {
          // A large glow is soft and costly: half the device ratio. A small
          // one needs every pixel for its core line.
          scale: area > 160_000 ? dpr * 0.5 : dpr,
          time: still ? 0 : (now - epoch) / 1000,
          reveal: m.reveal,
          surge,
          radius: p.radius ?? instance.hostRadius,
          width: p.reach ?? defaultReach(p.shape, w, h, fixed),
          bleed: p.bleed ?? 0,
          dark: document.documentElement.classList.contains("dark") ? 1 : 0,
          strength: p.strength * glowTuning().strength,
          level: Math.max(m.level, 0.55 * blend),
          bands: b,
          focus,
          focusAt,
          line: p.shape === "line" ? 1 : 0,
          flip: p.edge === "top" ? -1 : 1,
          hold,
        } satisfies GlowUniforms;
      },
    };
    inst.current = instance;
    const unregister = registerGlow(instance);

    const resize = new ResizeObserver(() => {
      instance.hostRadius = readRadius();
      instance.held = false;
    });
    resize.observe(canvas);
    if (!fixed && box.parentElement) resize.observe(box.parentElement);

    let io: IntersectionObserver | null = null;
    if (!fixed && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) instance.visible = e.isIntersecting;
        },
        { rootMargin: "128px" },
      );
      io.observe(box);
    }
    if (props.current.active) instance.wake();
    return () => {
      unregister();
      resize.disconnect();
      io?.disconnect();
      inst.current = null;
    };
  }, [fixed]);

  // Turning on (or a change of state while on) wakes the instance; the frame
  // loop takes it from there, including the way out.
  useEffect(() => {
    inst.current?.wake();
  }, [active, processing, shape]);

  const box: CSSProperties = fixed
    ? { ...style }
    : { inset: -bleed, ...style };

  // A span, shown as a block: a glow goes inside a word (a badge in a
  // paragraph) as readily as inside a card, and a div there is invalid.
  if (fallback) {
    return (
      <span
        ref={boxRef}
        aria-hidden
        {...(layer ? { [BEZEL_LAYER_ATTRIBUTE]: "" } : {})}
        className={cn(
          "glow-fallback pointer-events-none block transition-opacity duration-500",
          fixed ? "fixed inset-0" : "absolute",
          shape === "line" && "glow-fallback-line",
          active ? "opacity-100" : "opacity-0",
          className,
        )}
        style={{
          ...box,
          borderRadius: radius,
          ["--glow-stops" as string]: GLOW_CSS_STOPS,
          opacity: active ? strength : 0,
        }}
      />
    );
  }

  return (
    <span
      ref={boxRef}
      aria-hidden
      {...(layer ? { [BEZEL_LAYER_ATTRIBUTE]: "" } : {})}
      className={cn("pointer-events-none block", fixed ? "fixed inset-0" : "absolute", className)}
      style={box}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </span>
  );
}
