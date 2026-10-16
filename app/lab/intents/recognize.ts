// =============================================================================
// The recognizer: an event's callback.
//
// Every interaction is an event: a drag that ends, a resize, a sentence. Its
// callback reads it against the tree's preset intents (each kind's anchor,
// each word it is known by) and answers one of:
//
//   resolve   ① it hits a preset: actions straight to the reducer (Flux). No model.
//   ask       it hits more than one: a question whose kinds are the readings
//             (reintent's ask: the person picks, then resolve).
//   infer     ② it hits nothing: the model looks at the tree and the event and
//             writes a new tree (an effect, async), which comes back as `replace` (ReAct).
//   context   it changes what the tree is seen in, not the tree (a resize).
// =============================================================================

import type { Value } from "./compute";
import type { Action, Context, Pt, Tree } from "./tree";

export type Event =
  | { type: "drag"; target: "man"; to: Pt }
  | { type: "drag"; target: "door"; open: number }
  | { type: "resize"; screen: Context["screen"] }
  | { type: "prompt"; text: string; node: string | null };

export interface Reading {
  node: string;
  intent: string;
  kind: string;
  /** How sure the recognizer is of this reading. */
  score: number;
}

export type Recognized =
  | { path: "resolve"; actions: Action[]; reading?: Reading }
  | { path: "ask"; readings: Reading[] }
  | { path: "infer"; why?: "new" | "edge"; edge?: { node: string; intent: string; dir: 1 | -1 } }
  | { path: "context"; actions: Action[] };

/** How close (scene units) a drop must be to a place for it to be that place. */
export const DOCK = 70;
/** How close a door must be to a kind's opening to snap to it. */
const SNAP = 0.1;

const BIGGER = ["大一点", "大些", "更大", "再大", "开大", "大点", "bigger", "larger", "wider", "more"];
const SMALLER = ["小一点", "小些", "更小", "再小", "关小", "小点", "smaller", "less", "narrower"];

export function recognize(ev: Event, tree: Tree, values: Record<string, Value>): Recognized {
  if (ev.type === "resize") return { path: "context", actions: [{ type: "context", ctx: { screen: ev.screen } }] };

  if (ev.type === "drag" && ev.target === "man") {
    const place = tree.nodes.find((n) => n.id === "man")!.intents.place;
    let best: { kind: string; d: number } | null = null;
    for (const [kind, k] of Object.entries(place.kinds)) {
      const at = k.realize.at!;
      const d = Math.hypot(at[0] - ev.to[0], at[1] - ev.to[1]);
      if (!best || d < best.d) best = { kind, d };
    }
    if (best && best.d <= DOCK)
      return {
        path: "resolve",
        reading: { node: "man", intent: "place", kind: best.kind, score: 1 - best.d / DOCK },
        actions: [{ type: "decide", node: "man", intent: "place", kind: best.kind, from: "dragged" }],
      };
    return { path: "infer" };
  }

  if (ev.type === "drag" && ev.target === "door") {
    const door = tree.nodes.find((n) => n.id === "wardrobe")!.intents.door;
    let best: { kind: string; d: number } | null = null;
    for (const [kind, k] of Object.entries(door.kinds)) {
      const d = Math.abs((k.realize.open ?? 0) - ev.open);
      if (!best || d < best.d) best = { kind, d };
    }
    if (best && best.d <= SNAP)
      return {
        path: "resolve",
        reading: { node: "wardrobe", intent: "door", kind: best.kind, score: 1 - best.d / SNAP },
        actions: [{ type: "decide", node: "wardrobe", intent: "door", kind: best.kind, from: "dragged" }],
      };
    return { path: "infer" };
  }

  // A sentence: read it against every intent's words (only the selected thing's, when one is).
  const text = ev.text.toLowerCase();
  // An indefinite ("一盏灯", "a lamp") brings in something new: if what it names is not in the
  // tree, no preset can be about it, however many of the other words match one.
  const indefinite = /(一|几)(个|盏|张|把|只|件|扇|位|束|片|条)\s*([^\s，。,.]{1,4})|\b(?:a|an)\s+([a-z]+)/.exec(text);
  if (indefinite) {
    const noun = (indefinite[3] ?? indefinite[4] ?? "").trim();
    const known = tree.nodes.some((n) => n.aka.some((w) => noun.includes(w.toLowerCase()) || w.toLowerCase().includes(noun)));
    if (noun && !known) return { path: "infer", why: "new" };
  }
  const bigger = BIGGER.some((w) => text.includes(w));
  const smaller = SMALLER.some((w) => text.includes(w));
  // The relative words are not also kind words ("大一点" is not the kind "大很多").
  const rest = [...BIGGER, ...SMALLER].reduce((t, w) => t.split(w).join(" "), text);
  const readings: Reading[] = [];
  // Does the sentence name an intent at all? Then only what it names can be read: "帽子大一点"
  // is about the hat, even when the hat has no bigger kind and the door has one.
  const scope = tree.nodes.filter((n) => !ev.node || n.id === ev.node);
  const namedAny = scope.some((n) => Object.values(n.intents).some((i) => i.aka.some((w) => rest.includes(w.toLowerCase()))));
  let edge: { node: string; intent: string; dir: 1 | -1 } | null = null;
  for (const n of tree.nodes) {
    if (ev.node && n.id !== ev.node) continue;
    const named = n.aka.some((w) => rest.includes(w.toLowerCase()));
    for (const [name, intent] of Object.entries(n.intents)) {
      const hit = intent.aka.some((w) => rest.includes(w.toLowerCase()));
      const kinds = Object.keys(intent.kinds);
      const byWord = kinds
        .map((k) => ({ k, len: Math.max(0, ...(intent.kinds[k].aka ?? []).filter((w) => rest.includes(w.toLowerCase())).map((w) => w.length)) }))
        .filter((x) => x.len > 0)
        .sort((a, b) => b.len - a.len)[0];
      if (byWord) readings.push({ node: n.id, intent: name, kind: byWord.k, score: 2 + (hit ? 1 : 0) + (named ? 0.5 : 0) + byWord.len * 0.1 });
      else if ((bigger || smaller) && intent.ordered && (hit || (ev.node && named))) {
        const cur = values[`${name}|${n.id}`]?.kind ?? kinds[0];
        const i = kinds.indexOf(cur) + (bigger ? 1 : -1);
        if (i >= 0 && i < kinds.length) readings.push({ node: n.id, intent: name, kind: kinds[i], score: 3 });
        // Past the end of its scale: no preset is that big. The model can add one.
        else edge = { node: n.id, intent: name, dir: bigger ? 1 : -1 };
      } else if ((bigger || smaller) && intent.ordered && !hit && !ev.node && !namedAny) {
        // "大一点", said of nothing: every intent that has a bigger (or smaller) is a reading.
        const cur = values[`${name}|${n.id}`]?.kind ?? kinds[0];
        const i = kinds.indexOf(cur) + (bigger ? 1 : -1);
        if (i >= 0 && i < kinds.length) readings.push({ node: n.id, intent: name, kind: kinds[i], score: 1 });
      }
    }
  }
  readings.sort((a, b) => b.score - a.score);
  if (!readings.length) return edge ? { path: "infer", why: "edge", edge } : { path: "infer" };
  const [top, second] = readings;
  if (second && top.score - second.score < 1) return { path: "ask", readings: readings.slice(0, 3) };
  return {
    path: "resolve",
    reading: top,
    actions: [{ type: "decide", node: top.node, intent: top.intent, kind: top.kind, from: "said" }],
  };
}
