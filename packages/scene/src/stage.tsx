"use client";

// =============================================================================
// <Stage>: one scene, one clock, one registry, one svg.
//
//   children   the scene, as SVG (retained). Semantic components inside.
//   canvas     <Draw>s, painted every frame over the svg (immediate).
//   html       atmosphere and UI over both (lids, haze, words). Not measured.
//
// It also opens the scene to the outside as window.__scene (api.ts): the
// manifest, a snapshot with every thing's box, hit tests, stills, overrides
// and the verifier. The lab's inspector drives a running scene through it.
// =============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type SVGProps,
} from "react";
import { installApi, type Still } from "./api";
import { Clock } from "./clock";
import { sceneToClient } from "./measure";
import { Registry, type DrawFn } from "./registry";
import { useOwner } from "./semantic";

interface StageCtx {
  registry: Registry;
  clock: Clock;
}

const StageContext = createContext<StageCtx | null>(null);

function useStage(): StageCtx {
  const s = useContext(StageContext);
  if (!s) throw new Error("scene: this must be inside a <Stage>.");
  return s;
}

export function useRegistry(): Registry {
  return useStage().registry;
}

/** The scene's time, in seconds. The component re-renders every frame. */
export function useTime(): number {
  const { clock } = useStage();
  return useSyncExternalStore(clock.subscribe, clock.now, clock.now);
}

/** Run a side effect every frame (sound, haptics), with the scene's time. Never draw from here. */
export function useFrame(fn: (t: number, dt: number) => void): void {
  const { clock } = useStage();
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  useEffect(() => clock.onFrame((t, dt) => ref.current(t, dt)), [clock]);
}

/** The clock's reading, without re-rendering every frame (for event handlers). */
export function useNow(): () => number {
  return useStage().clock.now;
}

/** Is a switch on (one the inspector can flip)? */
export function useFlag(name: string): boolean {
  const registry = useRegistry();
  useSyncExternalStore(registry.subscribe, registry.getVersion, registry.getVersion);
  return registry.flags.has(name);
}

export interface StageProps {
  /** The scene's own units: the frame it is designed in. */
  width: number;
  height: number;
  /** A part of the frame to show instead of all of it (a card, a crop). */
  viewBox?: string;
  /** Fill the screen and crop (slice), or show it all (meet). */
  fit?: "slice" | "meet";
  /** Named moments: what an inspector, a thumbnail or a sentence can go to. */
  stills?: readonly Still[];
  /** Move the scene's state to a still (name) or back to play (null). Time is held at t. */
  onStill?: (name: string | null, t: number) => void;
  /** Attributes for the root svg; a function of time for what moves (a filter, a jolt). */
  svg?: SvgAttrs | ((t: number) => SvgAttrs);
  /** <Draw>s that belong to no svg thing. A <Draw> can also sit inside its owner. */
  canvas?: ReactNode;
  html?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

type SvgAttrs = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children" | "ref">;

const FILL: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" };

export function Stage({ width, height, viewBox, fit = "slice", stills = [], onStill, svg, canvas, html, className, style, children }: StageProps) {
  const [ctx] = useState<StageCtx>(() => ({ registry: new Registry(), clock: new Clock() }));
  const svgRef = useRef<SVGSVGElement>(null);
  const onStillRef = useRef(onStill);
  const stillsRef = useRef(stills);
  useLayoutEffect(() => {
    onStillRef.current = onStill;
    stillsRef.current = stills;
  });

  useEffect(() => ctx.clock.start(), [ctx]);
  useEffect(
    () =>
      installApi({
        svg: () => svgRef.current,
        registry: ctx.registry,
        clock: ctx.clock,
        stills: () => stillsRef.current,
        onStill: (name, t) => onStillRef.current?.(name, t),
      }),
    [ctx],
  );

  return (
    <StageContext.Provider value={ctx}>
      <div className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
        <SvgRoot svgRef={svgRef} viewBox={viewBox ?? `0 0 ${width} ${height}`} fit={fit} svg={svg}>
          {children}
        </SvgRoot>
        <CanvasLayer svg={svgRef}>{canvas}</CanvasLayer>
        {html}
      </div>
    </StageContext.Provider>
  );
}

function SvgRoot({ svgRef, viewBox, fit, svg, children }: {
  svgRef: RefObject<SVGSVGElement | null>;
  viewBox: string;
  fit: "slice" | "meet";
  svg: StageProps["svg"];
  children: ReactNode;
}) {
  // Re-renders every frame for the root's own attributes; the children are
  // the same elements, so React leaves them to their own subscriptions.
  const t = useTime();
  const attrs = typeof svg === "function" ? svg(t) : svg;
  return (
    <svg ref={svgRef} viewBox={viewBox} preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true" {...attrs} style={{ ...FILL, ...attrs?.style }}>
      {children}
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Immediate mode: a canvas over the svg, in the svg's own coordinates.
// -----------------------------------------------------------------------------

function CanvasLayer({ svg, children }: { svg: RefObject<SVGSVGElement | null>; children: ReactNode }) {
  const { registry, clock } = useStage();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(
    () =>
      clock.onFrame((t) => {
        const c = ref.current;
        const s = svg.current;
        if (!c || !s) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round(s.clientWidth * dpr);
        const h = Math.round(s.clientHeight * dpr);
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const g = c.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, w, h);
        const [a, b, cc, d, e, f] = sceneToClient(s);
        for (const draw of registry.draws) {
          g.save();
          g.setTransform(a * dpr, b * dpr, cc * dpr, d * dpr, e * dpr, f * dpr);
          draw.fn(g, t);
          g.restore();
        }
      }),
    [clock, registry, svg],
  );
  return (
    <>
      <canvas ref={ref} aria-hidden="true" style={{ ...FILL, pointerEvents: "none" }} />
      {children}
    </>
  );
}

/**
 * A drawing in immediate mode, owned by a semantic path. Put it inside the
 * thing it belongs to and name the part (<Draw part="beam">), or give the
 * whole path. The function is free: any canvas calls, in scene units. It is
 * run each frame on the stage's canvas, and once more through a colouring
 * context to be measured.
 */
export function Draw({ path, part, fn }: { path?: string; part?: string; fn: DrawFn }) {
  const registry = useRegistry();
  const owner = useOwner();
  const resolved = path ?? (owner ? (part ? `${owner.path}.${part}` : owner.path) : null);
  if (!resolved) throw new Error("scene: <Draw> needs a path, or to be inside a semantic component.");
  const handle = useRef<ReturnType<Registry["addDraw"]> | null>(null);
  useLayoutEffect(() => {
    handle.current = registry.addDraw(resolved, fn);
    return () => handle.current?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the function is swapped below without re-registering
  }, [registry, resolved]);
  useLayoutEffect(() => {
    handle.current?.set(fn);
  });
  return null;
}
