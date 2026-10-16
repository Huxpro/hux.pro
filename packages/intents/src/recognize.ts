// =============================================================================
// The recognizer: every event's callback.
//
// An event (a drag that ends, a sentence said of a thing, a dream told, an
// answer, a leaning) is read against the tree's own vocabulary: each intent's
// gesture and words, each kind's anchor and words. It answers one of:
//
//   resolve   ① a preset: actions straight to the reducer. No model.
//   ask       more than one reading: a question; the answer resolves.
//   infer     ② no preset can be it: what is needed is handed to a model,
//             weak or strong by the need (router.ts), whose tree comes back.
//   context   it changes what the tree is seen in, not the tree.
// =============================================================================

import type { Value } from "./space";
import { intentOf, key, nodeOf, type Action, type Pt, type Tree } from "./tree";
import { readEdit, readWords, rewrite, wordsOf } from "./words";

export type Event =
  | { type: "drag"; path: string; from: Pt; to: Pt }
  | { type: "say"; text: string; node: string | null }
  | { type: "dream"; text: string }
  | { type: "answer"; node: string; intent: string; kind: string }
  | { type: "lean"; intent: string; kind: string | null }
  /** The prompt, edited (words.ts reads which span it touched, and how). */
  | { type: "words"; prompt: string }
  /** A kind chosen from a span of the words: decided, and the span rewritten to say it. */
  | { type: "choose"; span: string; intent: string; kind: string }
  /** The words follow the tree: these spans rewritten to say the kinds the tree has now. */
  | { type: "follow"; spans: string[] };

export interface Reading {
  node: string;
  intent: string;
  kind: string;
  score: number;
}

/** What a model is asked for, when no preset reads an event. */
export type Need =
  | { kind: "learn-at"; node: string; intent: string; at: Pt }
  | { kind: "learn-value"; node: string; intent: string; field: string; value: number }
  | { kind: "extend"; node: string; intent: string; dir: 1 | -1 }
  | { kind: "new-thing"; noun: string; text: string }
  | { kind: "unknown"; text: string; node: string | null }
  | { kind: "dream"; text: string }
  /** A span's words rewritten, and no kind reads them (dir: further along, back, or neither). */
  | { kind: "reword"; node: string; intent: string | null; text: string; old: string; dir: 1 | -1 | 0 }
  /** A span's words deleted: the belief they were evidence for, again. */
  | { kind: "unsay"; node: string; intent: string; text: string };

/** Where words just edited are to be bound once the event has landed (a span, or a stretch of the prompt). */
export interface Bind {
  prompt: string;
  span?: string;
  from: number;
  to: number;
}

type Common = { pre?: Action[]; bind?: Bind };
export type Recognized =
  | ({ path: "resolve"; actions: Action[]; reading?: Reading } & Common)
  | ({ path: "ask"; readings: Reading[]; text: string } & Common)
  | ({ path: "infer"; need: Need } & Common)
  | ({ path: "context"; actions: Action[] } & Common);

/** How close (scene units) a drop must be to a kind's anchor to be that kind. */
export const DOCK = 70;
/** How close (fraction of the axis) a number must be to a kind's to snap to it. */
export const SNAP = 0.1;

const MORE = ["大一点", "大些", "更大", "再大", "开大", "大点", "bigger", "larger", "wider", "more"];
const LESS = ["小一点", "小些", "更小", "再小", "关小", "小点", "smaller", "less", "narrower"];

/** The gesture an intent answers to, for a dragged path. */
export function gestureFor(tree: Tree, path: string, focus?: string | null) {
  // The node in focus first (a dream's beat on screen): its gesture is the one a drag means.
  const nodes = focus ? [...tree.nodes.filter((n) => n.id === focus), ...tree.nodes.filter((n) => n.id !== focus)] : tree.nodes;
  for (const n of nodes)
    for (const [name, i] of Object.entries(n.intents))
      if (i.gesture && (path === i.gesture.path || path.startsWith(i.gesture.path + ".") || path.startsWith(i.gesture.path + "[")))
        return { node: n.id, intent: name, gesture: i.gesture, kinds: i.kinds };
  return null;
}

/** Where a drag leaves the dragged field: a point moved by the drag, or a number off the axis. */
export function dragValue(tree: Tree, vals: Record<string, Value>, ev: { path: string; from: Pt; to: Pt }, focus?: string | null) {
  const g = gestureFor(tree, ev.path, focus);
  if (!g) return null;
  const cur = g.kinds[vals[key(g.node, g.intent)]?.kind ?? Object.keys(g.kinds)[0]]?.realize ?? {};
  if (g.gesture.axis) {
    const { x0, x1, max = 1 } = g.gesture.axis;
    return { ...g, value: Math.max(0, Math.min(1, (x0 - ev.to[0]) / (x0 - x1))) * max };
  }
  const at = (cur[g.gesture.field] as Pt | undefined) ?? ev.from;
  return { ...g, at: [at[0] + ev.to[0] - ev.from[0], at[1] + ev.to[1] - ev.from[1]] as Pt };
}

/**
 * What an event means, against the tree. `focus` is the node the experience
 * has on screen (a dream's beat): a drag means its gesture, and a sentence said
 * of nothing in particular leans to it.
 */
export function recognize(ev: Event, tree: Tree, vals: Record<string, Value>, focus?: string | null): Recognized {
  if (ev.type === "lean") {
    return { path: "context", actions: [] };
  }
  if (ev.type === "answer") {
    return {
      path: "resolve",
      reading: { node: ev.node, intent: ev.intent, kind: ev.kind, score: 1 },
      actions: [{ type: "decide", node: ev.node, intent: ev.intent, kind: ev.kind, from: "answered" }],
    };
  }
  if (ev.type === "dream") return { path: "infer", need: { kind: "dream", text: ev.text } };
  if (ev.type === "words" || ev.type === "choose" || ev.type === "follow") return recognizeWords(ev, tree, vals, focus);

  if (ev.type === "drag") {
    const d = dragValue(tree, vals, ev, focus);
    if (!d) return { path: "infer", need: { kind: "unknown", text: `drag ${ev.path}`, node: null } };
    let best: { kind: string; d: number } | null = null;
    for (const [kind, k] of Object.entries(d.kinds)) {
      const r = k.realize[d.gesture.field];
      const dist = "at" in d && Array.isArray(r) ? Math.hypot(r[0] - d.at[0], r[1] - d.at[1]) / DOCK : "value" in d && typeof r === "number" ? Math.abs(r - d.value!) / SNAP : Infinity;
      if (!best || dist < best.d) best = { kind, d: dist };
    }
    if (best && best.d <= 1)
      return {
        path: "resolve",
        reading: { node: d.node, intent: d.intent, kind: best.kind, score: 1 - best.d },
        actions: [{ type: "decide", node: d.node, intent: d.intent, kind: best.kind, from: "dragged" }],
      };
    return "at" in d
      ? { path: "infer", need: { kind: "learn-at", node: d.node, intent: d.intent, at: d.at } }
      : { path: "infer", need: { kind: "learn-value", node: d.node, intent: d.intent, field: d.gesture.field, value: d.value! } };
  }

  // A sentence, said of a thing or of the scene.
  const text = ev.text.toLowerCase();
  // An indefinite ("一盏灯", "a lamp") brings in something new: if what it names is not in the tree,
  // no preset can be about it, however many of the other words match one.
  const indefinite = /(一|几)(个|盏|张|把|只|件|扇|位|束|片|条|面)\s*([^\s，。,.]{1,4})|\b(?:a|an)\s+([a-z]+)/.exec(text);
  if (indefinite) {
    const noun = (indefinite[3] ?? indefinite[4] ?? "").trim();
    const known = tree.nodes.some((n) => n.aka.some((w) => noun.includes(w.toLowerCase()) || w.toLowerCase().includes(noun)));
    if (noun && !known) return { path: "infer", need: { kind: "new-thing", noun, text: ev.text } };
  }
  const scope = tree.nodes.filter((n) => !ev.node || n.id === ev.node);
  const readings: Reading[] = [];
  let edge: Need | null = null;
  // Does the sentence name an intent at all? Then only what it names can be read.
  const wordsOf = (i: Tree["nodes"][number]["intents"][string]) => ({ more: i.more ?? MORE, less: i.less ?? LESS });
  const strip = (t: string, ws: readonly string[]) => ws.reduce((x, w) => x.split(w.toLowerCase()).join(" "), t);
  const namedAny = scope.some((n) => Object.values(n.intents).some((i) => i.aka.some((w) => strip(strip(text, MORE), LESS).includes(w.toLowerCase()))));
  for (const n of scope) {
    const named = n.aka.some((w) => text.includes(w.toLowerCase()));
    for (const [name, intent] of Object.entries(n.intents)) {
      const { more: mw, less: lw } = wordsOf(intent);
      const more = mw.some((w) => text.includes(w.toLowerCase()));
      const less = lw.some((w) => text.includes(w.toLowerCase()));
      // The relative words are not also kind words ("大一点" is not the kind "大很多").
      const rest = strip(strip(text, mw), lw);
      const hit = intent.aka.some((w) => rest.includes(w.toLowerCase()));
      const kinds = Object.keys(intent.kinds);
      const byWord = kinds
        .map((k) => ({ k, len: Math.max(0, ...(intent.kinds[k].aka ?? []).filter((w) => rest.includes(w.toLowerCase())).map((w) => w.length)) }))
        .filter((x) => x.len > 0)
        .sort((a, b) => b.len - a.len)[0];
      const relative = intent.ordered && (more || less);
      if (byWord && !relative) readings.push({ node: n.id, intent: name, kind: byWord.k, score: 2 + (hit ? 1 : 0) + (named ? 0.5 : 0) + byWord.len * 0.1 });
      else if (relative && (hit || ev.node || intent.more)) {
        // Named, or said of its thing, or in words only it has ("慢一点" is the pace's).
        const cur = vals[key(n.id, name)]?.kind ?? kinds[0];
        const i = kinds.indexOf(cur) + (more ? 1 : -1);
        if (i >= 0 && i < kinds.length) readings.push({ node: n.id, intent: name, kind: kinds[i], score: 3 + (intent.more ? 1 : 0) + (named ? 0.5 : 0) });
        else edge = { kind: "extend", node: n.id, intent: name, dir: more ? 1 : -1 };
      } else if (relative && !namedAny) {
        // "大一点" said of nothing: every intent that has a bigger (or smaller) is a reading.
        const cur = vals[key(n.id, name)]?.kind ?? kinds[0];
        const i = kinds.indexOf(cur) + (more ? 1 : -1);
        if (i >= 0 && i < kinds.length) readings.push({ node: n.id, intent: name, kind: kinds[i], score: 1 });
      }
    }
  }
  // A thing named in the sentence ("第一幕…") is what it is about; said of nothing in particular, what is on screen is.
  const isNamed = (id: string) => !!tree.nodes.find((n) => n.id === id)?.aka.some((w) => text.includes(w.toLowerCase()));
  const named = readings.filter((r) => isNamed(r.node));
  if (named.length) readings.splice(0, readings.length, ...named);
  else if (focus && !ev.node) for (const r of readings) if (r.node === focus) r.score += 1;
  readings.sort((a, b) => b.score - a.score);
  if (!readings.length) return { path: "infer", need: edge ?? { kind: "unknown", text: ev.text, node: ev.node } };
  const [top, second] = readings;
  if (second && top.score - second.score < 1) return { path: "ask", readings: readings.slice(0, 3), text: ev.text };
  return { path: "resolve", reading: top, actions: [{ type: "decide", node: top.node, intent: top.intent, kind: top.kind, from: "said" }] };
}

// -----------------------------------------------------------------------------
// Events in the words (words.ts): an edit, a pick from a span, the words following.
// -----------------------------------------------------------------------------

function recognizeWords(ev: Extract<Event, { type: "words" | "choose" | "follow" }>, tree: Tree, vals: Record<string, Value>, focus?: string | null): Recognized {
  if (ev.type === "choose") {
    const s = tree.spans?.find((x) => x.id === ev.span);
    const intent = s && intentOf(tree, s.node, ev.intent);
    if (!s || !intent) return { path: "context", actions: [] };
    const actions: Action[] = [{ type: "decide", node: s.node, intent: ev.intent, kind: ev.kind, from: "worded" }];
    // A span that says a kind of this intent now says the chosen one; one that only names the thing or the intent
    // ("换了个地方") stays as it is: the words were vague, the tree holds the choice.
    if (s.intent === ev.intent && s.kind) actions.push({ type: "words", ...rewrite(tree, s.id, wordsOf(intent, ev.kind), { kind: ev.kind, unread: false }) });
    return { path: "resolve", reading: { node: s.node, intent: ev.intent, kind: ev.kind, score: 1 }, actions };
  }
  if (ev.type === "follow") {
    let t = tree;
    for (const id of ev.spans) {
      const s = t.spans?.find((x) => x.id === id);
      const v = s?.intent ? vals[key(s.node, s.intent)] : undefined;
      const intent = s?.intent ? intentOf(t, s.node, s.intent) : undefined;
      if (!s || !v || !intent) continue;
      t = { ...t, ...rewrite(t, id, wordsOf(intent, v.kind), { kind: v.kind, unread: false }) };
    }
    return { path: "context", actions: [{ type: "words", prompt: t.prompt, spans: t.spans ?? [] }] };
  }

  const { spans, edit } = readEdit(tree, ev.prompt);
  const pre: Action[] = [{ type: "words", prompt: ev.prompt, spans }];
  const now: Tree = { ...tree, prompt: ev.prompt, spans };
  if (edit.kind === "none") return { path: "context", actions: [], pre };

  if (edit.kind === "insert") {
    // Words outside every span: a sentence said, read as one, and bound to what it lands on.
    const r = recognize({ type: "say", text: edit.text, node: null }, now, vals, focus);
    return { ...r, pre, bind: { prompt: ev.prompt, from: edit.from, to: edit.to } };
  }

  if (edit.kind === "unsay") {
    const s = edit.span;
    if (!s.intent) {
      // A learned thing whose last words are gone goes with them; the author's things stay.
      const n = nodeOf(tree, s.node);
      if (n?.learned && !spans.some((x) => x.node === s.node)) return { path: "resolve", actions: [{ type: "remove", node: s.node }], pre };
      return { path: "context", actions: [], pre };
    }
    // The words were the evidence: a pick they made goes, and the model believes again without them.
    const i = intentOf(tree, s.node, s.intent);
    if (i?.from === "worded") pre.push({ type: "forget", node: s.node, intent: s.intent });
    return { path: "infer", need: { kind: "unsay", node: s.node, intent: s.intent, text: edit.old }, pre };
  }

  // Reworded.
  const s = edit.span;
  const bind: Bind = { prompt: ev.prompt, span: s.id, from: s.from, to: s.to };
  const settle = (patch: Partial<typeof s>) => ({ type: "words" as const, prompt: ev.prompt, spans: spans.map((x) => (x.id === s.id ? { ...x, ...patch, unread: false } : x)) });
  if (s.intent) {
    const intent = intentOf(tree, s.node, s.intent);
    if (!intent) return { path: "context", actions: [], pre };
    const r = readWords(intent, edit.text);
    const kinds = Object.keys(intent.kinds);
    let kind: string | null = r && "kind" in r ? r.kind : null;
    let dir: 1 | -1 | 0 = 0;
    if (r && "dir" in r) {
      const cur = vals[key(s.node, s.intent)]?.kind ?? kinds[0];
      const i = kinds.indexOf(cur) + r.dir;
      if (i >= 0 && i < kinds.length) kind = kinds[i];
      else dir = r.dir;
    }
    if (kind)
      return {
        path: "resolve",
        reading: { node: s.node, intent: s.intent, kind, score: 1 },
        actions: [{ type: "decide", node: s.node, intent: s.intent, kind, from: "worded" }, settle({ kind })],
        pre,
      };
    return { path: "infer", need: { kind: "reword", node: s.node, intent: s.intent, text: edit.text, old: edit.old, dir }, pre, bind };
  }
  // The words name a thing: said of it, do they say a kind of one of its intents?
  const r = recognize({ type: "say", text: edit.text, node: s.node }, now, vals, focus);
  if (r.path === "resolve") return { ...r, actions: [...r.actions, settle({})], pre };
  return { path: "infer", need: { kind: "reword", node: s.node, intent: null, text: edit.text, old: edit.old, dir: 0 }, pre, bind };
}
