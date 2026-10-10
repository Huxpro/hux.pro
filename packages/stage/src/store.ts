// The host: one per stage. It owns the clock, the machine, every node's
// state and last output, and the frame: step, frame, draw, then the DOM
// anchors. It is also what tells sem where everything is, so the inspector,
// the rules and `outline()` read what was actually drawn.

import { bounds, sem, type Invariant, type Layer, type SemNode, type Shape } from "sem";
import { isRef, type Anchor, type When } from "./bind";
import type { Ctx, KindDef, Layout, Point, Rng, Time } from "./kind";
import { createMachine, type Machine, type MachineConfig } from "./machine";

/** The props every placed node takes, besides its kind's own. */
export interface NodeProps {
  /** Stable, unique in the scene, named for what it is. */
  id: string;
  names?: string[];
  /** Overrides the kind's intent for this one. */
  intent?: string;
  /** The phases it is in; all of them when left out. */
  shown?: When[];
  parent?: string;
}

type AnyKind = KindDef<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface NodeRec {
  id: string;
  def: AnyKind;
  order: number;
  props: () => Record<string, unknown> & NodeProps;
  state: unknown;
  out: unknown;
  rng: Rng;
  ready: boolean;
}

interface AnchorRec {
  el: HTMLElement;
  anchor: Extract<Anchor, { below: string }>;
}

export interface StageOptions {
  id: string;
  machine: MachineConfig;
  seed?: number;
  layer?: Layer;
}

/** A small, fast, seeded generator (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Whether a `shown` list includes this moment. */
export function isShown(shown: When[] | undefined, phase: string, since: (p: string) => number): boolean {
  if (!shown) return true;
  return shown.some((w) => (typeof w === "string" ? w === phase : w.phase === phase && since(phase) >= w.delay));
}

export class Stage {
  readonly id: string;
  readonly layer: Layer;
  private machine: Machine;
  private config: MachineConfig;
  private seed: number;
  private nodes = new Map<string, NodeRec>();
  private anchors = new Set<AnchorRec>();
  private refs: Record<string, unknown> = {};
  private listeners = new Set<() => void>();
  private orderCounter = 0;
  private now = 0;
  private dt = 0;
  private pointer: Point | null = null;
  private layoutNow: Layout = { w: 0, h: 0, dpr: 1, center: { x: 0, y: 0 }, vmin: () => 0 };
  /** Overrides set from the inspector or the console, by node id and prop: tier-one edits, live. */
  private overrides = new Map<string, Record<string, unknown>>();

  constructor({ id, machine, seed = 1, layer = sem }: StageOptions) {
    this.id = id;
    this.layer = layer;
    this.config = machine;
    this.seed = seed;
    this.machine = createMachine(machine);
  }

  // --- React's side --------------------------------------------------------

  /** Render order: parents and earlier siblings first. Called during render. */
  nextOrder = () => this.orderCounter++;

  phase = () => this.machine.phase();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /** Seconds since `phase` began, for DOM nodes deciding their delays. */
  since = (phase: string) => this.machine.since(phase, this.now);

  add(id: string, def: AnyKind, order: number, props: NodeRec["props"]): () => void {
    const rec: NodeRec = { id, def, order, props, state: undefined, out: null, rng: seeded(this.seed ^ hash(id)), ready: false };
    this.nodes.set(id, rec);
    const disposeSem = this.layer.node(this.semNode(rec));
    return () => {
      if (this.nodes.get(id) === rec) this.nodes.delete(id);
      disposeSem();
    };
  }

  anchor(el: HTMLElement, anchor: Anchor): () => void {
    if (!("below" in anchor)) return () => {};
    const rec = { el, anchor };
    this.anchors.add(rec);
    return () => this.anchors.delete(rec);
  }

  /** Start over: the clock, the machine, every node's state. */
  reset() {
    this.machine = createMachine(this.config);
    this.now = 0;
    this.refs = {};
    for (const rec of this.nodes.values()) {
      rec.ready = false;
      rec.out = null;
      rec.rng = seeded(this.seed ^ hash(rec.id));
    }
    this.emitPhase();
  }

  setPointer(p: Point | null) {
    this.pointer = p;
  }

  /** A press: offered to the shown nodes, topmost (latest in the scene) first. */
  pointerDown(p: Point) {
    for (const rec of this.ordered().reverse()) {
      if (!rec.ready || rec.out === null || !rec.def.pointerDown) continue;
      if (rec.def.pointerDown(rec.state, rec.out, p, this.ctx(rec))) return true;
    }
    return false;
  }

  pointerUp() {
    for (const rec of this.ordered()) {
      if (rec.ready && rec.out !== null) rec.def.pointerUp?.(rec.state, rec.out, this.ctx(rec));
    }
  }

  /** A live override of one prop: what a slider in the inspector, or "slower", does without a model. */
  set(nodeId: string, prop: string, value: unknown) {
    this.overrides.set(nodeId, { ...this.overrides.get(nodeId), [prop]: value });
  }

  // --- the frame -----------------------------------------------------------

  /** One frame: time passes, the machine moves, every shown node steps and frames, then draws. */
  tick(g: CanvasRenderingContext2D, layout: Layout, dt: number, background: string) {
    this.layoutNow = layout;
    this.dt = Math.min(dt, 1 / 20);
    this.now += this.dt;
    if (this.machine.tick(this.now)) this.onPhase();

    const live: NodeRec[] = [];
    for (const rec of this.ordered()) {
      const ctx = this.ctx(rec);
      const props = this.resolve(rec);
      if (!rec.ready) {
        rec.state = rec.def.init?.(props, ctx);
        rec.ready = true;
      }
      if (!isShown(props.shown, this.machine.phase(), this.since)) {
        rec.out = null;
        continue;
      }
      rec.def.step?.(rec.state, props, ctx);
      rec.out = rec.def.frame(rec.state, props, ctx);
      live.push(rec);
    }

    g.fillStyle = background;
    g.fillRect(0, 0, layout.w, layout.h);
    for (const rec of live) rec.def.draw?.(g, rec.out, this.resolve(rec), this.ctx(rec));

    // DOM nodes anchored to drawn ones follow them, without a React render.
    for (const { el, anchor } of this.anchors) {
      const target = this.nodes.get(anchor.below);
      const shape = target?.out != null ? (target.def.anchor ?? target.def.measure)?.(target.out, target.state, this.ctx(target)) : null;
      if (shape) el.style.top = `${Math.round(bounds(shape).y + bounds(shape).h + anchor.gap)}px`;
    }
  }

  // --- internals -----------------------------------------------------------

  private ordered() {
    return [...this.nodes.values()].sort((a, b) => a.order - b.order);
  }

  /** Props as the kind sees them: refs read from the events that set them, live overrides on top. */
  private resolve(rec: NodeRec) {
    const raw = rec.props();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) out[k] = isRef(v) ? this.refs[v.$ref] : v;
    return Object.assign(out, this.overrides.get(rec.id)) as Record<string, unknown> & NodeProps;
  }

  private ctx(rec: NodeRec): Ctx {
    const time: Time = { now: this.now, dt: this.dt, phase: this.machine.phase(), since: this.since };
    return {
      t: time,
      layout: this.layoutNow,
      rng: rec.rng,
      pointer: this.pointer,
      out: <O>(id: string) => (this.nodes.get(id)?.out ?? null) as O | null,
      emit: (event, payload) => {
        this.refs[event] = payload;
        if (this.machine.send(event, this.now)) this.onPhase();
      },
    };
  }

  private onPhase() {
    const phase = this.machine.phase();
    for (const rec of this.ordered()) {
      if (rec.ready) rec.def.enter?.(rec.state, this.resolve(rec), phase, this.ctx(rec));
    }
    this.emitPhase();
  }

  private emitPhase() {
    this.listeners.forEach((fn) => fn());
  }

  /** What sem knows of a node: read from the host's own record, so it is what was drawn. */
  private semNode(rec: NodeRec): SemNode {
    const { def } = rec;
    const props = () => this.resolve(rec);
    const shape = () => (rec.ready && rec.out !== null && def.measure ? def.measure(rec.out, rec.state, this.ctx(rec)) : null);
    const node: SemNode = {
      id: `${this.id}/${rec.id}`,
      kind: def.kind,
      intent: def.intent,
      backend: def.backend ?? "canvas2d",
      measure: shape,
      state: () => ({
        ...(rec.ready && rec.out !== null ? def.inspect?.(rec.state, rec.out, this.ctx(rec)) : {}),
      }),
      ...(def.count ? { count: () => (rec.ready && rec.out !== null ? def.count!(rec.state, rec.out) : 0) } : {}),
      ...(def.item ? { item: (i: number) => (rec.ready && rec.out !== null ? def.item!(rec.state, rec.out, i) : null) } : {}),
      ...(def.itemName ? { itemName: def.itemName } : {}),
      source: { file: def.source ?? "", symbols: [def.name] },
    };
    const stageId = this.id;
    // Fields read from the scene's latest props: they may change on a re-render.
    Object.defineProperties(node, {
      parent: { get: () => (props().parent ? `${stageId}/${props().parent}` : stageId), enumerable: true },
      names: { get: () => props().names ?? def.names, enumerable: true },
      intent: { get: () => props().intent ?? def.intent, enumerable: true },
      params: {
        get: () =>
          def.params
            ? Object.fromEntries(
                Object.entries(def.params).map(([k, spec]) => [k, { ...(spec as object), value: props()[k] as never }]),
              )
            : undefined,
        enumerable: true,
      },
      links: {
        // A prop that names another node (`on="globe"`) is a link; the parent is not.
        get: () => {
          const { parent, ...rest } = rec.props();
          const named = Object.values(rest).filter(
            (v): v is string => typeof v === "string" && v !== parent && v !== rec.id && this.nodes.has(v),
          );
          return [...new Set(named)].map((to) => ({ rel: "uses", to: `${stageId}/${to}` }));
        },
        enumerable: true,
      },
    });
    return node;
  }

  /** The scene's own node: its phase, its time, and the rules. */
  sceneNode(intent: string, names: string[] | undefined, rules: Invariant[]): SemNode {
    return {
      id: this.id,
      kind: "scene",
      intent,
      ...(names ? { names } : {}),
      backend: "none",
      measure: (): Shape => ({ rect: [0, 0, this.layoutNow.w, this.layoutNow.h] }),
      state: () => ({ phase: this.machine.phase(), t: Math.round(this.now * 100) / 100 }),
      invariants: rules,
    };
  }
}
