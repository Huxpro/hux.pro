// The shapes of sem: what a node declares, and what a snapshot reports.
//
// Every coordinate a snapshot reports is in viewport CSS pixels, whatever drew
// the thing: a DOM box, an SVG path, a Canvas 2D circle, a WebGL mesh. A node
// whose own numbers are local to some element (a canvas that is not at the
// viewport's origin) names that element as its `space`, and the layer moves
// them into the viewport.

/** A rectangle: left, top, width, height. */
export type Rect = { x: number; y: number; w: number; h: number };

/** Where a thing is. Small on purpose: enough to see it, hit it and lay it out. */
export type Shape =
  | { rect: [x: number, y: number, w: number, h: number] }
  | { circle: [cx: number, cy: number, r: number] }
  /** A closed outline, as x0, y0, x1, y1, ... */
  | { poly: number[] };

/** What draws the thing. It never changes what the node means. */
export type Backend = "dom" | "svg" | "canvas2d" | "webgl" | "none";

/** A knob: a value someone may want to turn, with what it is in. */
export type Param = {
  value: number | string | boolean;
  unit?: string;
  range?: [number, number];
  note?: string;
};

/**
 * How one node depends on another. Open-ended; these are the ones the
 * dreams use: `aligns-with` (they must agree on a place), `drives` (this one's
 * state moves that one), `reveals`, `avoids` (they must not overlap).
 */
export type Link = { rel: string; to: string };

/** A rule the scene keeps. `check` makes it executable; `text` says it to a person. */
export type Invariant = {
  id: string;
  text: string;
  /** True when kept. A string is a failure with the reason. */
  check?: (s: Snapshot) => boolean | string;
};

/** Where in the source a node lives: a file and the names in it, never line numbers (they drift). */
export type Source = { file: string; symbols?: string[] };

/**
 * A node: one thing a person could name and might want changed. A thousand
 * particles are one node (a population: `count` and `item`), not a thousand.
 *
 * Everything live is a function the layer calls only when somebody looks:
 * nothing is pushed per frame, so an uninspected node costs nothing.
 */
export interface SemNode {
  /** Stable across regenerations: the code may be rewritten, the id stays. */
  id: string;
  /** Open vocabulary: scene, field, agent, text, control, effect, surface... */
  kind: string;
  /** How people refer to it, in any language. */
  names?: string[];
  /** One sentence: why it exists, what it is for. */
  intent: string;
  parent?: string;
  backend: Backend;
  /** Stacking among siblings for `at()`; higher is on top. */
  z?: number;

  /** The element the shapes below are local to (default: the viewport). */
  space?: Element | (() => Element | null | undefined);
  /** Where it is now; null when it is not on screen. */
  measure?: () => Shape | null;
  /** False when it is there but not seen (faded out, behind a fold). */
  visible?: () => boolean;
  /** Anything worth knowing about it now. Keep it JSON. */
  state?: () => Record<string, unknown>;
  /** A population: how many, and where the i-th one is. */
  count?: () => number;
  item?: (i: number) => Shape | null;

  params?: Record<string, Param>;
  source?: Source;
  links?: Link[];
  invariants?: Invariant[];
  /** Ids this node has had before, so an old reference still finds it. */
  renamedFrom?: string[];
}

/** One node, as it was when the snapshot was taken. JSON throughout. */
export interface NodeSnapshot {
  id: string;
  kind: string;
  backend: Backend;
  intent: string;
  parent?: string;
  names?: string[];
  /** In viewport CSS px; null when it is not on screen. */
  shape: Shape | null;
  bounds: Rect | null;
  visible: boolean;
  state?: Record<string, unknown>;
  count?: number;
  params?: Record<string, Param>;
  links?: Link[];
  source?: Source;
}

export interface Snapshot {
  /** performance.now() when taken, ms. */
  t: number;
  viewport: { w: number; h: number; dpr: number };
  nodes: Record<string, NodeSnapshot>;
  /** Tree order: parents before children, siblings as registered. */
  order: string[];
}

export interface CheckResult {
  /** The node that declared the rule. */
  node: string;
  id: string;
  text: string;
  ok: boolean;
  reason?: string;
}

/** Everything needed to regenerate one node without breaking what it touches. */
export interface Selection {
  node: NodeSnapshot;
  ancestors: NodeSnapshot[];
  children: string[];
  /** Nodes it links to, and nodes that link to it. */
  linked: { rel: string; direction: "out" | "in"; node: NodeSnapshot }[];
  /** The rules declared on it or on its ancestors, and whether they hold now. */
  checks: CheckResult[];
}
