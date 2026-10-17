// =============================================================================
// The intent tree: what a model writes into an artifact when it first makes it,
// and the one state everything after is a change to.
//
// A strong model, generating an experience, writes beside the code its reading
// of it: the things, and on each a few intents. An intent is a closed set of
// kinds, each kind carrying what it means in the picture (`realize`), the
// model's belief over the kinds (`p`), whether to ask a person when unsure, and
// how a gesture reaches it. Everything after is a shortcut through this tree:
//
//   code       computes from it (reintent's decide, the host's realize)
//   a person   resolves (a pick, an answer, a drag that lands on a kind)
//   a model    infers again (a learned kind, a new thing, a whole new tree),
//              routed to a weak or a strong one by what the event needs
//
// Provenance is kept on everything: who wrote a node, a kind, a drawing, a pick.
//
// The tree is the middle of two bindings, both written by the model with it:
//
//   words → tree   spans of the prompt, each bound to a thing, one of its
//                  intents, and the kind those words say (`Tree.spans`)
//   tree → view    the semantic paths each intent drives in the picture
//                  (`Intent.view`, `Node.view`)
//
// So a person can edit in any of the three: the words (a span rewritten or
// deleted, a sentence added: words.ts reads the edit into events), the tree
// (a pick), or the picture (a drag). Each lands in the tree; the other two
// follow from it, or say where they no longer agree.
// =============================================================================

export type Pt = readonly [number, number];
export type Text = { zh: string; en: string };

/** Who wrote something, and after what. */
export interface By {
  /** "model:strong" · "model:weak" · "model:recorded" (a stand-in) · "person" · "code" */
  who: string;
  /** The model id, when a real one wrote it. */
  model?: string;
  /** The event it answered, in words. */
  event?: string;
}

export interface Kind {
  label: Text;
  aka?: readonly string[];
  /** What it means in the picture: the host reads the fields it knows (at, scale, open, over…). */
  realize: Record<string, unknown>;
  /** Learned after an event (not in the tree as first written), and from whom. */
  learned?: By;
  /** How the prompt says it, when its words follow a pick ("大得离谱"); default: the label. */
  words?: string;
}

/** How a gesture on the picture reaches an intent. */
export interface Gesture {
  /** The semantic path dragged (a prefix: "man[bedside]" takes "man[bedside].body"). */
  path: string;
  /** The realize field the gesture sets: a point ("at") or a number along an axis. */
  field: string;
  /** For a number: the scene x where it is 0 and where it is `max`. */
  axis?: { x0: number; x1: number; max?: number };
  /** For a point: scale by depth, from (y0, s0) to (y1, s1), for the preview and a learned kind. */
  depth?: readonly [number, number, number, number];
}

export interface Intent {
  label: Text;
  /** Words that name the intent ("帽子", "门开得多快"). */
  aka: readonly string[];
  /** Kinds in order: an ordered intent's "more" moves right, "less" left. */
  kinds: Record<string, Kind>;
  /** The model's belief over the kinds. */
  p: Record<string, number>;
  /** When the model is unsure: ask the person, or pick and offer the rest. */
  resolve: "ask" | "switch";
  ordered?: boolean;
  /** Words for "further along" and "back" on an ordered intent (default: bigger / smaller). */
  more?: readonly string[];
  less?: readonly string[];
  gesture?: Gesture;
  /** The semantic paths it drives in the picture ("man.hat", "wardrobe.door.right", "beat.door"). */
  view?: readonly string[];
  /** A person's pick, and how it was made. */
  pick?: string;
  from?: "dragged" | "said" | "answered" | "switched" | "worded" | "carried";
}

/** A drawing a model wrote for a thing (a lazy effect), and the values it was written under. */
export interface Drawing {
  svg: string;
  under: Record<string, string>;
  by: By;
}

export interface Node {
  id: string;
  label: Text;
  aka: readonly string[];
  /** The words this thing came from; a reprompt adds to them. */
  prompt: string;
  intents: Record<string, Intent>;
  /** Added by a model after an event. */
  learned?: By;
  /** Which library thing draws it ("man", "wardrobe"…); absent: its own drawing. */
  draws?: string;
  /** Its own drawings (a learned thing): newest first; none yet while one is being written. */
  drawings?: Drawing[];
  /** The semantic path it is in the picture ("man", "lamp"); default: what it fills, or its id. */
  view?: string;
  /**
   * A library thing's slot it is drawn in ("man.hat"): it replaces what the
   * library drew there, and rides with it (in every place he stands). The path
   * stays; what is at it is new.
   */
  fills?: string;
}

/**
 * A span of the prompt, bound to the tree: these words are about this thing,
 * this intent of it, and say this kind. The words are the model's evidence for
 * its belief; a person's edit to them is an event (words.ts).
 */
export interface Span {
  id: string;
  /** Offsets into Tree.prompt. */
  from: number;
  to: number;
  node: string;
  intent?: string;
  /** The kind the words say; absent: they name the thing (or the intent), not a kind of it. */
  kind?: string;
  /** Who bound it: the model that wrote the tree, or a person's edit. */
  by?: string;
  /** Reworded, and no kind reads the new words yet. */
  unread?: boolean;
}

/** One beat of a dream told as a tree (the dream player's): which node it is. */
export interface Phase {
  node: string;
}

export interface Tree {
  /** Stable: the experience it belongs to. */
  scene: string;
  title: Text;
  /** The words it was made from, as they stand now (a person may edit them). */
  prompt: string;
  /** The words bound to the tree (in order, not overlapping). */
  spans?: Span[];
  /** Who wrote it first. */
  by: By;
  nodes: Node[];
  /** A dream in beats (the player's); absent for an experience with its own code for time. */
  phases?: Phase[];
}

/** What the tree is seen in: not the tree. Changing it recomputes; it decides nothing. */
export interface Context {
  /** Everything said, in order: a model reads it all. */
  prompts: string[];
  /** The viewer's own leanings ("gentler"): a layer of preferences that is never the author's. */
  viewer: Record<string, string>;
}

export interface Version {
  /** This version's id, and the one it was made from (a remix's parent). */
  id: string;
  parent: string | null;
  by: string;
  note?: string;
}

export interface State {
  tree: Tree;
  ctx: Context;
  version: Version;
}

export const key = (node: string, intent: string) => `${intent}|${node}`;
export const nodeOf = (tree: Tree, id: string) => tree.nodes.find((n) => n.id === id);
export const intentOf = (tree: Tree, node: string, intent: string) => nodeOf(tree, node)?.intents[intent];

// -----------------------------------------------------------------------------
// Actions and the reducer
// -----------------------------------------------------------------------------

export type Action =
  | { type: "decide"; node: string; intent: string; kind: string; from: NonNullable<Intent["from"]> }
  | { type: "forget"; node: string; intent: string }
  /** A model's new tree, reconciled: a person's picks kept wherever they still mean something. */
  | { type: "replace"; tree: Tree }
  /** A whole new tree (a new dream): nothing carried over. */
  | { type: "load"; tree: Tree; version?: Version }
  | { type: "draw"; node: string; drawing: Drawing }
  | { type: "context"; ctx: Partial<Context> }
  /** The words, edited (or rewritten to follow the tree): the prompt and its spans. */
  | { type: "words"; prompt: string; spans: Span[] }
  /** A model's belief, revised (the words it rested on are gone). */
  | { type: "believe"; node: string; intent: string; p: Record<string, number> }
  /** A thing taken out (a learned one whose words were deleted). */
  | { type: "remove"; node: string }
  /** Words just edited, bound to what the event landed on (if the words are still as they were). */
  | { type: "bind"; prompt: string; span?: string; from: number; to: number; node: string; intent?: string; kind?: string };

const mapIntent = (tree: Tree, node: string, intent: string, f: (i: Intent) => Intent): Tree => ({
  ...tree,
  nodes: tree.nodes.map((n) => (n.id !== node || !n.intents[intent] ? n : { ...n, intents: { ...n.intents, [intent]: f(n.intents[intent]) } })),
});

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "decide":
      return { ...s, tree: mapIntent(s.tree, a.node, a.intent, (i) => ({ ...i, pick: a.kind, from: a.from })) };
    case "forget":
      return { ...s, tree: mapIntent(s.tree, a.node, a.intent, (i) => ({ ...i, pick: undefined, from: undefined })) };
    case "replace":
      return { ...s, tree: rebase(a.tree, s.tree) };
    case "load":
      return { ...s, tree: a.tree, version: a.version ?? s.version };
    case "draw":
      return {
        ...s,
        tree: { ...s.tree, nodes: s.tree.nodes.map((n) => (n.id !== a.node ? n : { ...n, drawings: [a.drawing, ...(n.drawings ?? [])] })) },
      };
    case "context":
      return { ...s, ctx: { ...s.ctx, ...a.ctx } };
    case "words":
      return { ...s, tree: { ...s.tree, prompt: a.prompt, spans: a.spans } };
    case "believe":
      return { ...s, tree: mapIntent(s.tree, a.node, a.intent, (i) => ({ ...i, p: a.p })) };
    case "bind": {
      if (s.tree.prompt !== a.prompt) return s;
      const spans = s.tree.spans ?? [];
      const bound: Span = { id: a.span ?? `b${a.from}-${a.to}`, from: a.from, to: a.to, node: a.node, intent: a.intent, kind: a.kind, by: "person" };
      const next = spans.some((x) => x.id === a.span) ? spans.map((x) => (x.id === a.span ? { ...x, ...bound, unread: false } : x)) : [...spans.filter((x) => x.to <= a.from || x.from >= a.to), bound].sort((x, y) => x.from - y.from);
      return { ...s, tree: { ...s.tree, spans: next } };
    }
    case "remove":
      return { ...s, tree: { ...s.tree, nodes: s.tree.nodes.filter((n) => n.id !== a.node), spans: s.tree.spans?.filter((x) => x.node !== a.node) } };
  }
}

/**
 * `next` (a tree just written: a model's answer, or the code's tree after a
 * regeneration), with what `prev` had that `next` does not say otherwise: a
 * person's picks (by key, wherever the intent and kind still exist), kinds and
 * things learned since, drawings written. React's reconciliation, by key.
 */
export function rebase(next: Tree, prev: Tree): Tree {
  const nodes = next.nodes.map((n) => {
    const old = prev.nodes.find((o) => o.id === n.id);
    if (!old) return n;
    const intents: Record<string, Intent> = { ...n.intents };
    for (const [k, i] of Object.entries(n.intents)) {
      const was = old.intents[k];
      if (!was) continue;
      const kinds = { ...i.kinds };
      const p = { ...i.p };
      for (const [kid, kd] of Object.entries(was.kinds))
        if (kd.learned && !kinds[kid]) {
          kinds[kid] = kd;
          p[kid] = was.p[kid] ?? 0.5;
        }
      const pick = i.pick ?? (was.pick && kinds[was.pick] ? was.pick : undefined);
      intents[k] = { ...i, kinds, p, pick, from: i.pick ? i.from : pick ? was.from : undefined };
    }
    for (const [k, i] of Object.entries(old.intents)) if (!intents[k] && Object.values(i.kinds).some((x) => x.learned)) intents[k] = i;
    return { ...n, intents, drawings: n.drawings ?? old.drawings };
  });
  for (const o of prev.nodes) if (o.learned && !nodes.some((n) => n.id === o.id)) nodes.push(o);
  return { ...next, nodes };
}

/** A tree with every person's pick taken off: what the model and code would say. */
export function unpicked(tree: Tree): Tree {
  return { ...tree, nodes: tree.nodes.map((n) => ({ ...n, intents: Object.fromEntries(Object.entries(n.intents).map(([k, i]) => [k, { ...i, pick: undefined, from: undefined }])) })) };
}

// -----------------------------------------------------------------------------
// The tree as text: what is saved, what a model is shown, what a diff is of.
// -----------------------------------------------------------------------------

const pct = (v: number) => String(Math.round(v * 100)).padStart(2, "0");

export function toXml(s: { tree: Tree; ctx?: Context }): string {
  const t = s.tree;
  const out = [`<scene of="${t.scene}" by="${t.by.who}"${s.ctx?.prompts.length ? ` said="${s.ctx.prompts.length}"` : ""}>`];
  if (t.phases?.length) out.push(`  <phases>${t.phases.map((p) => p.node).join(" → ")}</phases>`);
  if (t.spans?.length) {
    // The words, with what each bound span is about: the model's evidence, in place.
    let at = 0;
    let words = "";
    for (const sp of t.spans) {
      words += t.prompt.slice(at, sp.from) + `[${t.prompt.slice(sp.from, sp.to)}](${sp.node}${sp.intent ? `.${sp.intent}` : ""}${sp.kind ? `=${sp.kind}` : ""})`;
      at = sp.to;
    }
    out.push(`  <words>${words + t.prompt.slice(at)}</words>`);
  }
  for (const n of t.nodes) {
    const draw = n.drawings?.length ? ` drawn-by="${n.drawings[0].by.who}"` : n.learned && !n.draws ? ` drawing="pending"` : "";
    out.push(`  <${n.id}${n.learned ? ` learned-from="${n.learned.who}"` : ""}${n.draws ? ` draws="${n.draws}"` : ""}${draw} prompt="${n.prompt}">`);
    for (const [k, i] of Object.entries(n.intents)) {
      const kinds = Object.entries(i.kinds).map(([id, kd]) => (kd.learned ? `${id}*` : id)).join(" ");
      const p = Object.entries(i.p)
        .sort((a, b) => b[1] - a[1])
        .map(([id, v]) => `${id} .${pct(v)}`)
        .join(", ");
      out.push(`    <${k} kinds="${kinds}"${i.pick ? ` pick="${i.pick}" from="${i.from}"` : ""} p="${p}" />`);
    }
    out.push(`  </${n.id}>`);
  }
  out.push("</scene>");
  return out.join("\n");
}

export function lineDiff(a: string, b: string): { added: string[]; removed: string[] } {
  const A = new Set(a.split("\n"));
  const B = new Set(b.split("\n"));
  return { added: [...B].filter((l) => !A.has(l)), removed: [...A].filter((l) => !B.has(l)) };
}

/** What one tree changes over another, in a person's terms: picks made, kinds and things learned, drawings. */
export interface Change {
  kind: "pick" | "learned-kind" | "learned-node" | "drawing" | "unpick";
  node: string;
  intent?: string;
  value?: string;
  by?: string;
}

export function changes(base: Tree, tree: Tree): Change[] {
  const out: Change[] = [];
  for (const n of tree.nodes) {
    const b = base.nodes.find((x) => x.id === n.id);
    if (!b) {
      out.push({ kind: "learned-node", node: n.id, by: n.learned?.who });
      if (n.drawings?.length) out.push({ kind: "drawing", node: n.id, by: n.drawings[0].by.who });
    }
    for (const [k, i] of Object.entries(n.intents)) {
      const bi = b?.intents[k];
      for (const [kid, kd] of Object.entries(i.kinds)) if (kd.learned && !bi?.kinds[kid]) out.push({ kind: "learned-kind", node: n.id, intent: k, value: kid, by: kd.learned.who });
      if (i.pick && i.pick !== bi?.pick) out.push({ kind: "pick", node: n.id, intent: k, value: i.pick, by: i.from });
      if (!i.pick && bi?.pick) out.push({ kind: "unpick", node: n.id, intent: k });
    }
  }
  return out;
}
