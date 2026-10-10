// React on top: a scene is a tree of placed kinds and DOM words, with its
// phases and rules. React renders it when the phase changes, a few times a
// run; the host does every frame. Nothing here draws.

import { Moon, Sun } from "lucide-react";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useSemDevtools, useSemElement } from "sem";
import type { Anchor, Ref, Rule, When, Words } from "./bind";
import type { KindDef, Layout } from "./kind";
import type { MachineConfig } from "./machine";
import { Stage as Host, type NodeProps } from "./store";

const HostContext = createContext<{ host: Host; again: () => void; ink: string } | null>(null);
const EnvContext = createContext<{ locale: keyof Words; wake: () => void }>({ locale: "en", wake: () => {} });

const subscribeNever = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNever, () => true, () => false);

function useHost() {
  const value = useContext(HostContext);
  if (!value) throw new Error("a stage node must be inside <Stage>");
  return value;
}

/** What the app gives every stage: the language, and how to wake (leave). */
export function StageProvider({ locale, onWake, children }: { locale: keyof Words; onWake: () => void; children: ReactNode }) {
  return <EnvContext.Provider value={{ locale, wake: onWake }}>{children}</EnvContext.Provider>;
}

function usePhase(host: Host) {
  return useSyncExternalStore(host.subscribe, host.phase, host.phase);
}

export interface StageProps {
  id: string;
  intent: string;
  names?: string[];
  /** What a screen reader hears of the canvas. */
  label: Words;
  machine: MachineConfig;
  rules?: Rule[];
  background: string;
  /** The words' colour, as "r, g, b". */
  ink?: string;
  seed?: number;
  children: ReactNode;
}

/**
 * The stage: a full-screen canvas over the site's chrome, the loop, the
 * input, the machine. Esc wakes; Enter and Space press the middle.
 */
export function Stage({ id, intent, names, label, machine, rules = [], background, ink = "255, 255, 255", seed = 1, children }: StageProps) {
  const env = useContext(EnvContext);
  const mounted = useMounted();
  const [host] = useState(() => new Host({ id, machine, seed }));
  const [run, setRun] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useSemDevtools(host.layer);
  // With ?sem or ?inspect, the host is on window.__stage: `__stage.set("light", "approach", 2.4)` is a live edit.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("sem") && !params.has("inspect")) return;
    const g = globalThis as { __stage?: Host };
    g.__stage = host;
    return () => {
      if (g.__stage === host) delete g.__stage;
    };
  }, [host]);
  const intentRef = useRef({ intent, names, rules });
  useEffect(() => {
    const { intent, names, rules } = intentRef.current;
    return host.layer.node(host.sceneNode(intent, names, rules.map((r) => r(id))));
  }, [host, id]);

  // The loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    let layout: Layout;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout = { w, h, dpr, center: { x: w / 2, y: h / 2 }, vmin: (pct) => (Math.min(w, h) * pct) / 100 };
    };
    resize();
    window.addEventListener("resize", resize);
    let last = performance.now();
    let raf = 0;
    const frame = (stamp: number) => {
      raf = requestAnimationFrame(frame);
      host.tick(g, layout, (stamp - last) / 1000, background);
      last = stamp;
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [host, mounted, background]);

  const again = useCallback(() => {
    host.reset();
    setRun((r) => r + 1);
  }, [host]);

  useEffect(() => {
    const middle = () => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") env.wake();
      else if ((e.key === "Enter" || e.key === " ") && !e.repeat) host.pointerDown(middle());
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") host.pointerUp();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [host, env]);

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9000] touch-none select-none overflow-hidden overscroll-none"
      style={{ background, WebkitTouchCallout: "none" } as CSSProperties}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        host.setPointer({ x: e.clientX, y: e.clientY });
        host.pointerDown({ x: e.clientX, y: e.clientY });
      }}
      onPointerMove={(e) => host.setPointer({ x: e.clientX, y: e.clientY })}
      onPointerUp={() => host.pointerUp()}
      onPointerCancel={() => host.pointerUp()}
      onPointerLeave={() => host.setPointer(null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} role="img" aria-label={label[env.locale]} className="absolute inset-0 h-full w-full" />
      <HostContext.Provider value={{ host, again, ink }}>
        <Fragment key={run}>{children}</Fragment>
      </HostContext.Provider>
    </div>,
    document.body,
  );
}

/** A prop a scene may give as a literal, or as `ref(event)`. */
export type Bound<P> = { [K in keyof P]: P[K] | Ref };

/** A kind, as a component a scene places: `<Light id="light" approach={1.8} />`. */
export function kind<P extends object, S, O>(def: KindDef<P, S, O>) {
  function Placed(props: Bound<P> & NodeProps): null {
    const { host } = useHost();
    const [order] = useState(host.nextOrder);
    const latest = useRef(props);
    useLayoutEffect(() => {
      latest.current = props;
    });
    const id = props.id;
    useLayoutEffect(
      () => host.add(id, def as KindDef<never, never, never>, order, () => latest.current as never),
      [host, id, order],
    );
    return null;
  }
  Placed.displayName = def.name;
  return Object.assign(Placed, { def });
}

/** Whether `shown` includes this phase, and after how long. */
function showing(shown: When[] | undefined, phase: string): { on: boolean; delay: number } {
  if (!shown) return { on: true, delay: 0 };
  for (const w of shown) {
    if (typeof w === "string" ? w === phase : w.phase === phase) return { on: true, delay: typeof w === "string" ? 0 : w.delay };
  }
  return { on: false, delay: 0 };
}

const VARIANTS = {
  caption: { font: "var(--font-mono)", size: 11, tracking: "0.2em", alpha: 0.4 },
  hint: { font: "var(--font-mono)", size: 11, tracking: "0.2em", alpha: 0.55 },
  line: { font: "var(--font-serif)", size: 20, tracking: "normal", alpha: 0.85 },
} as const;

/** Words on the stage: DOM text, placed by an anchor, in some phases. */
export function Text({
  id,
  names,
  intent,
  anchor,
  shown,
  variant = "line",
  color,
  children,
}: {
  id: string;
  names?: string[];
  intent?: string;
  anchor: Anchor;
  shown?: When[];
  variant?: keyof typeof VARIANTS;
  /** "r, g, b"; the stage's ink when left out. */
  color?: string;
  children: Words;
}) {
  const { host, ink } = useHost();
  const { locale } = useContext(EnvContext);
  const { on, delay } = showing(shown, usePhase(host));
  const v = VARIANTS[variant];
  const semRef = useSemElement<HTMLSpanElement>({
    id: `${host.id}/${id}`,
    parent: host.id,
    kind: "text",
    names: names ?? [children.en, children.zh],
    intent: intent ?? "words on the stage",
    ...("below" in anchor ? { links: [{ rel: "below", to: `${host.id}/${anchor.below}` }] } : {}),
  });
  const anchorKey = JSON.stringify(anchor);
  const placeRef = useCallback(
    (el: HTMLParagraphElement | null) => (el ? host.anchor(el, JSON.parse(anchorKey)) : undefined),
    [host, anchorKey],
  );
  const position: CSSProperties =
    "top" in anchor
      ? { top: `calc(env(safe-area-inset-top) + ${anchor.top}px)` }
      : "bottom" in anchor
        ? { bottom: `calc(env(safe-area-inset-bottom) + ${anchor.bottom}px)` }
        : { top: "50%" };
  return (
    <p
      ref={placeRef}
      className="pointer-events-none absolute inset-x-0 px-6 text-center"
      style={{
        ...position,
        fontFamily: v.font,
        fontSize: v.size,
        letterSpacing: v.tracking,
        color: `rgba(${color ?? ink}, ${v.alpha})`,
        opacity: on ? 1 : 0,
        filter: on || variant !== "line" ? "blur(0)" : "blur(6px)",
        transition: "opacity 1.2s ease-out, filter 1.4s ease-out",
        transitionDelay: on ? `${delay}s` : "0s",
      }}
    >
      <span ref={semRef}>{children[locale]}</span>
    </p>
  );
}

/** The way out: a moon to dream again and a sun to wake, 44px each. */
export function WayOut({ shown, label }: { shown?: When[]; label: { again: Words; wake: Words } }) {
  const { host, again, ink } = useHost();
  const env = useContext(EnvContext);
  const { on, delay } = showing(shown, usePhase(host));
  const againRef = useSemElement<HTMLButtonElement>({
    id: `${host.id}/again`,
    parent: host.id,
    kind: "control",
    names: ["again", "moon", label.again.zh],
    intent: "Dream it again, from the start.",
  });
  const wakeRef = useSemElement<HTMLButtonElement>({
    id: `${host.id}/wake`,
    parent: host.id,
    kind: "control",
    names: ["wake", "sun", label.wake.zh],
    intent: "Leave the dream for the home screen.",
  });
  const button: CSSProperties = { padding: 14, color: `rgba(${ink}, 0.35)` };
  return (
    <nav
      className="absolute inset-x-0 flex justify-center gap-4"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 6px)",
        opacity: on ? 1 : 0,
        pointerEvents: on ? "auto" : "none",
        transition: "opacity 1s",
        transitionDelay: on ? `${delay}s` : "0s",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button ref={againRef} type="button" aria-label={label.again[env.locale]} style={button} onClick={again}>
        <Moon className="size-4" strokeWidth={1.5} />
      </button>
      <button ref={wakeRef} type="button" aria-label={label.wake[env.locale]} style={button} onClick={env.wake}>
        <Sun className="size-4" strokeWidth={1.5} />
      </button>
    </nav>
  );
}
