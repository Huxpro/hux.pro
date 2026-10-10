// The layer: a registry of nodes, read on demand.
//
// Nodes are declared next to the code that draws them (`layer.node({...})`,
// which hands back its own disposer). Nothing is measured until somebody asks:
// `snapshot()` calls each node's `measure` / `state` once, and everything else
// (`outline`, `at`, `select`, `check`) reads a snapshot. So a scene that
// nobody inspects pays for a Map of declarations and nothing per frame.

import { bounds, contains, expand, formatShape, translate } from "./geometry";
import type { CheckResult, NodeSnapshot, Selection, SemNode, Shape, Snapshot } from "./types";

export interface Layer {
  /** Declare a node. Returns its disposer. A second node with the same id replaces the first. */
  node(decl: SemNode): () => void;
  get(id: string): SemNode | undefined;
  ids(): string[];
  snapshot(opts?: { root?: string }): Snapshot;
  /** The scene as a short text tree: one line per node, then the rules. */
  outline(snap?: Snapshot): string;
  /**
   * What is under a point, topmost first. A population's member is `id#i`.
   * `slop` lets a finger find a member within that many px; the nearest wins.
   */
  at(x: number, y: number, snap?: Snapshot, options?: { slop?: number }): string[];
  /** Everything needed to regenerate one node. Finds it by an old id too. */
  select(id: string, snap?: Snapshot): Selection | null;
  /** Run every node's rules against a snapshot. */
  check(snap?: Snapshot): CheckResult[];
  /** Hear about nodes coming and going. */
  subscribe(fn: () => void): () => void;
}

export interface LayerOptions {
  /** The viewport, for tests without a window. */
  viewport?: () => { w: number; h: number; dpr: number };
  now?: () => number;
}

const defaultViewport = () => {
  const g = globalThis as { innerWidth?: number; innerHeight?: number; devicePixelRatio?: number };
  return { w: g.innerWidth ?? 0, h: g.innerHeight ?? 0, dpr: g.devicePixelRatio ?? 1 };
};

/** At most this many members of a population are hit-tested by `at()`. */
const AT_ITEM_LIMIT = 20000;

export function createLayer(options: LayerOptions = {}): Layer {
  const viewport = options.viewport ?? defaultViewport;
  const now = options.now ?? (() => globalThis.performance?.now() ?? Date.now());
  const nodes = new Map<string, SemNode>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());

  const resolve = (id: string): string | undefined => {
    if (nodes.has(id)) return id;
    for (const [key, decl] of nodes) if (decl.renamedFrom?.includes(id)) return key;
    return undefined;
  };

  /** The offset of a node's own space from the viewport's origin. */
  const origin = (decl: SemNode): [number, number] => {
    const space = typeof decl.space === "function" ? decl.space() : decl.space;
    if (!space) return [0, 0];
    const r = space.getBoundingClientRect();
    return [r.left, r.top];
  };

  const call = <T>(fn: (() => T) | undefined, fallback: T): T => {
    if (!fn) return fallback;
    try {
      return fn();
    } catch {
      return fallback;
    }
  };

  /** Parents before children; siblings in the order they were declared. */
  const treeOrder = (root?: string): string[] => {
    const children = new Map<string | undefined, string[]>();
    for (const [id, decl] of nodes) {
      const parent = decl.parent && nodes.has(decl.parent) ? decl.parent : undefined;
      const list = children.get(parent) ?? [];
      list.push(id);
      children.set(parent, list);
    }
    const out: string[] = [];
    const walk = (id: string) => {
      out.push(id);
      for (const child of children.get(id) ?? []) walk(child);
    };
    if (root) {
      if (nodes.has(root)) walk(root);
    } else {
      for (const id of children.get(undefined) ?? []) walk(id);
    }
    return out;
  };

  const layer: Layer = {
    node(decl) {
      nodes.set(decl.id, decl);
      emit();
      return () => {
        // Only remove what this call put there: a newer node with the same id stays.
        if (nodes.get(decl.id) === decl) {
          nodes.delete(decl.id);
          emit();
        }
      };
    },

    get: (id) => {
      const key = resolve(id);
      return key ? nodes.get(key) : undefined;
    },

    ids: () => [...nodes.keys()],

    snapshot(opts = {}) {
      const order = treeOrder(opts.root);
      const out: Record<string, NodeSnapshot> = {};
      for (const id of order) {
        const decl = nodes.get(id)!;
        const local = call(decl.measure, null as Shape | null);
        const [dx, dy] = local ? origin(decl) : [0, 0];
        const shape = local ? translate(local, dx, dy) : null;
        const visible = shape !== null && call(decl.visible, true);
        out[id] = {
          id,
          kind: decl.kind,
          backend: decl.backend,
          intent: decl.intent,
          ...(decl.parent ? { parent: decl.parent } : {}),
          ...(decl.names ? { names: decl.names } : {}),
          shape,
          bounds: shape ? bounds(shape) : null,
          visible,
          ...(decl.state ? { state: call(decl.state, {}) } : {}),
          ...(decl.count ? { count: call(decl.count, 0) } : {}),
          ...(decl.params ? { params: decl.params } : {}),
          ...(decl.links ? { links: decl.links } : {}),
          ...(decl.source ? { source: decl.source } : {}),
          ...(decl.edit ? { edit: decl.edit } : {}),
        };
      }
      return { t: now(), viewport: viewport(), nodes: out, order };
    },

    outline(snap = layer.snapshot()) {
      const lines: string[] = [];
      const depth = (id: string): number => {
        const parent = snap.nodes[id]?.parent;
        return parent && snap.nodes[parent] ? depth(parent) + 1 : 0;
      };
      const { w, h } = snap.viewport;
      for (const id of snap.order) {
        const node = snap.nodes[id];
        const pad = "  ".repeat(depth(id));
        const where = node.shape ? formatShape(node.shape) : "off-screen";
        const facts = [
          ...(node.count !== undefined ? [`count=${node.count}`] : []),
          ...Object.entries(node.state ?? {}).map(([k, v]) => `${k}=${formatValue(v)}`),
          ...(node.links ?? []).map((l) => `${l.rel}→${l.to}`),
        ];
        const seen = node.shape && !node.visible ? " (hidden)" : "";
        const head = depth(id) === 0 ? ` ${Math.round(w)}×${Math.round(h)}` : "";
        lines.push(`${pad}${id}  ${node.kind}·${node.backend}${head}  ${where}${seen}${facts.length ? "  " + facts.join(" ") : ""}`);
      }
      const results = layer.check(snap);
      if (results.length) {
        lines.push("rules:");
        for (const r of results) lines.push(`  ${r.ok ? "✓" : "✗"} ${r.id}: ${r.text}${r.reason ? ` (${r.reason})` : ""}`);
      }
      return lines.join("\n");
    },

    at(x, y, snap = layer.snapshot(), { slop = 0 } = {}) {
      const hits: { id: string; z: number; member: boolean; depth: number; index: number }[] = [];
      const depthOf = (id: string): number => {
        const parent = snap.nodes[id]?.parent;
        return parent && snap.nodes[parent] ? depthOf(parent) + 1 : 0;
      };
      snap.order.forEach((id, index) => {
        const node = snap.nodes[id];
        if (!node.visible || !node.shape) return;
        const decl = nodes.get(id);
        const z = decl?.z ?? 0;
        const depth = depthOf(id);
        // A population is hit by its members, not by its outline.
        if (decl?.item && node.count !== undefined && node.count <= AT_ITEM_LIMIT) {
          const [dx, dy] = origin(decl);
          let best = -1;
          let bestD = Infinity;
          for (let i = node.count - 1; i >= 0; i--) {
            const item = call(() => decl.item!(i), null);
            if (!item) continue;
            const placed = translate(item, dx, dy);
            if (!contains(expand(placed, slop), x, y)) continue;
            const b = bounds(placed);
            const d = Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y);
            if (d < bestD) {
              bestD = d;
              best = i;
            }
            if (slop === 0) break;
          }
          if (best !== -1) hits.push({ id: `${id}#${best}`, z, member: true, depth: depth + 1, index });
        }
        if (contains(node.shape, x, y)) hits.push({ id, z, member: false, depth, index });
      });
      // A population's member is the most specific thing under a point: it
      // outranks any outline at the same z, a sibling population's included.
      hits.sort((a, b) => b.z - a.z || Number(b.member) - Number(a.member) || b.depth - a.depth || b.index - a.index);
      return hits.map((hit) => hit.id);
    },

    select(id, snap = layer.snapshot()) {
      const [base, which] = id.split("#");
      const key = resolve(base);
      const node = key ? snap.nodes[key] : undefined;
      if (!key || !node) return null;
      const decl = nodes.get(key)!;
      let member: Selection["member"];
      if (which !== undefined && decl.item) {
        const index = Number(which);
        const local = call(() => decl.item!(index), null);
        const [dx, dy] = local ? origin(decl) : [0, 0];
        const name = call(() => decl.itemName?.(index), undefined);
        member = { index, ...(name ? { name } : {}), shape: local ? translate(local, dx, dy) : null };
      }
      const ancestors: NodeSnapshot[] = [];
      for (let p = node.parent; p && snap.nodes[p]; p = snap.nodes[p].parent) ancestors.push(snap.nodes[p]);
      const children = snap.order.filter((other) => snap.nodes[other].parent === key);
      const linked: Selection["linked"] = [];
      for (const l of node.links ?? []) {
        if (snap.nodes[l.to]) linked.push({ rel: l.rel, direction: "out", node: snap.nodes[l.to] });
      }
      for (const other of snap.order) {
        for (const l of snap.nodes[other].links ?? []) {
          if (l.to === key) linked.push({ rel: l.rel, direction: "in", node: snap.nodes[other] });
        }
      }
      const owners = new Set([key, ...ancestors.map((a) => a.id)]);
      const checks = layer.check(snap).filter((r) => owners.has(r.node));
      return { node, ...(member ? { member } : {}), ancestors, children, linked, checks };
    },

    check(snap = layer.snapshot()) {
      const results: CheckResult[] = [];
      for (const id of snap.order) {
        for (const rule of nodes.get(id)?.invariants ?? []) {
          if (!rule.check) {
            results.push({ node: id, id: rule.id, text: rule.text, ok: true, reason: "not executable" });
            continue;
          }
          try {
            const verdict = rule.check(snap);
            results.push(
              verdict === true
                ? { node: id, id: rule.id, text: rule.text, ok: true }
                : { node: id, id: rule.id, text: rule.text, ok: false, ...(typeof verdict === "string" ? { reason: verdict } : {}) },
            );
          } catch (error) {
            results.push({ node: id, id: rule.id, text: rule.text, ok: false, reason: String(error) });
          }
        }
      }
      return results;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return layer;
}

function formatValue(v: unknown): string {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === "string") return v.length > 24 ? JSON.stringify(v.slice(0, 23) + "…") : JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(formatValue).join(",")}]`;
  if (v && typeof v === "object") return "{…}";
  return String(v);
}

/** The layer an app shares: nodes from anywhere on the page land here. */
export const sem = createLayer();
