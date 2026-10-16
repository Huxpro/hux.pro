// =============================================================================
// ② The model, routed.
//
// When no preset reads an event, what is needed goes to a model:
//
//   weak     a kind more on an intent the tree already has (a place he was
//            dropped, an opening the door was left at, one past the end of a
//            scale): small, local, cheap.
//   strong   a new thing (with its own intents, and a drawing), a sentence
//            nothing in the tree is about, a whole new dream: open-ended.
//
// The model is shown what a ReAct step shows it (`observe`: the tree as text,
// the context, the need) and answers in one fixed shape (`Answer`), which
// becomes a tree here: kinds added, things added, the person's part as picks.
// A real model answers through the server route (/api/intents/infer, with a
// key); without one, the host's recorded answers and the generic weak rules
// below stand in, and say so.
// =============================================================================

import type { Need } from "./recognize";
import { toXml, type Action, type By, type Drawing, type Intent, type Kind, type Node, type Pt, type State, type Text, type Tree } from "./tree";

export type Tier = "weak" | "strong";

export function tierOf(need: Need): Tier {
  return need.kind === "learn-at" || need.kind === "learn-value" || need.kind === "extend" ? "weak" : "strong";
}

// -----------------------------------------------------------------------------
// The one shape a model answers in (strict-schema friendly: arrays, no maps).
// -----------------------------------------------------------------------------

export interface RealizeField {
  field: string;
  num: number | null;
  x: number | null;
  y: number | null;
  flag: boolean | null;
}
export interface AnswerKind {
  id: string;
  label_zh: string;
  label_en: string;
  aka: string[];
  realize: RealizeField[];
  p: number;
}
export interface AnswerIntent {
  name: string;
  label_zh: string;
  label_en: string;
  aka: string[];
  resolve: "ask" | "switch";
  ordered: boolean;
  kinds: AnswerKind[];
}
export interface AnswerNode {
  id: string;
  label_zh: string;
  label_en: string;
  aka: string[];
  prompt: string;
  draws: string | null;
  svg: string | null;
  intents: AnswerIntent[];
}
export interface Answer {
  note_zh: string;
  note_en: string;
  /** Kinds added to intents the tree has. */
  kinds: { node: string; intent: string; kind: AnswerKind }[];
  /** Things added (or, for a dream, the whole cast). */
  nodes: AnswerNode[];
  /** The person's part of the event, as picks on the new tree. */
  picks: { node: string; intent: string; kind: string }[];
  /** A dream's beats, in order (node ids); empty when not a dream. */
  phases: string[];
  title_zh: string;
  title_en: string;
}

export const toRealize = (fs: RealizeField[]): Record<string, unknown> =>
  Object.fromEntries(fs.map((f) => [f.field, f.x !== null && f.y !== null ? [f.x, f.y] : f.num !== null ? f.num : f.flag]));
export const fromRealize = (r: Record<string, unknown>): RealizeField[] =>
  Object.entries(r).map(([field, v]) => ({
    field,
    num: typeof v === "number" ? v : null,
    x: Array.isArray(v) ? v[0] : null,
    y: Array.isArray(v) ? v[1] : null,
    flag: typeof v === "boolean" ? v : null,
  }));

const toKind = (k: AnswerKind, by: By): Kind => ({ label: { zh: k.label_zh, en: k.label_en }, aka: k.aka, realize: toRealize(k.realize), learned: by });
const toIntent = (i: AnswerIntent, by: By): Intent => ({
  label: { zh: i.label_zh, en: i.label_en },
  aka: i.aka,
  resolve: i.resolve,
  ordered: i.ordered || undefined,
  kinds: Object.fromEntries(i.kinds.map((k) => [k.id, { ...toKind(k, by), learned: undefined }])),
  p: normalize(Object.fromEntries(i.kinds.map((k) => [k.id, k.p]))),
});
const normalize = (p: Record<string, number>) => {
  const s = Object.values(p).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v / s]));
};

/** A model's answer, as the tree it means, and the person's picks on it. */
export function applyAnswer(tree: Tree, a: Answer, need: Need, by: By): { tree: Tree; then: Action[]; drawNeeded: string[] } {
  const from = need.kind === "learn-at" || need.kind === "learn-value" ? "dragged" : "said";
  let next: Tree;
  if (need.kind === "dream") {
    next = {
      scene: tree.scene,
      title: { zh: a.title_zh, en: a.title_en },
      prompt: need.text,
      by,
      nodes: a.nodes.map((n) => toNode(n, by, false)),
      phases: a.phases.map((node) => ({ node })),
    };
  } else {
    next = {
      ...tree,
      nodes: [
        ...tree.nodes.map((n) => {
          const adds = a.kinds.filter((k) => k.node === n.id);
          if (!adds.length) return n;
          const intents = { ...n.intents };
          for (const add of adds) {
            const i = intents[add.intent];
            if (!i) continue;
            // The new kind takes its p; the others keep their proportions in what is left.
            const rest = Object.fromEntries(Object.entries(i.p).map(([k, v]) => [k, v * (1 - add.kind.p)]));
            intents[add.intent] = { ...i, kinds: { ...i.kinds, [add.kind.id]: toKind(add.kind, by) }, p: { ...rest, [add.kind.id]: add.kind.p } };
          }
          return { ...n, intents };
        }),
        ...a.nodes.filter((n) => !tree.nodes.some((x) => x.id === n.id)).map((n) => toNode(n, by, true)),
      ],
    };
  }
  const then: Action[] = a.picks.map((p) => ({ type: "decide", node: p.node, intent: p.intent, kind: p.kind, from }));
  const drawNeeded = next.nodes.filter((n) => !n.draws && !n.drawings?.length).map((n) => n.id);
  return { tree: next, then, drawNeeded };
}

function toNode(n: AnswerNode, by: By, learned: boolean): Node {
  return {
    id: n.id,
    label: { zh: n.label_zh, en: n.label_en },
    aka: n.aka,
    prompt: n.prompt,
    draws: n.draws ?? undefined,
    learned: learned ? by : undefined,
    intents: Object.fromEntries(n.intents.map((i) => [i.name, toIntent(i, by)])),
    drawings: n.svg ? [{ svg: n.svg, under: {}, by }] : undefined,
  };
}

// -----------------------------------------------------------------------------
// What the model is shown
// -----------------------------------------------------------------------------

export function observe(state: State, need: Need): string {
  const said = state.ctx.prompts.map((p) => `  <said>${p}</said>`).join("\n");
  const ask =
    need.kind === "learn-at"
      ? `<need kind="learn-at" node="${need.node}" intent="${need.intent}" at="${need.at.map((v) => Math.round(v)).join(",")}">A thing was dropped where none of its kinds is. Add one kind there; pick it.</need>`
      : need.kind === "learn-value"
        ? `<need kind="learn-value" node="${need.node}" intent="${need.intent}" ${need.field}="${need.value.toFixed(2)}">Left between two kinds. Add one kind at this value; pick it.</need>`
        : need.kind === "extend"
          ? `<need kind="extend" node="${need.node}" intent="${need.intent}" dir="${need.dir}">Already at the end of this scale. Add one kind further along; pick it.</need>`
          : need.kind === "new-thing"
            ? `<need kind="new-thing" noun="${need.noun}">${need.text}</need>`
            : need.kind === "dream"
              ? `<need kind="dream">${need.text}</need>`
              : `<need kind="unknown" on="${need.node ?? "scene"}">${need.text}</need>`;
  return `${toXml(state)}\n<context>\n${said}\n</context>\n${ask}\n<!-- No preset intent reads this. Change the tree as little as it takes; keep every person's pick. -->`;
}

// -----------------------------------------------------------------------------
// The host: what an experience tells the router about itself.
// -----------------------------------------------------------------------------

export interface Host {
  scene: string;
  /** What the realize fields mean, which library things there are: shown to a real model. */
  grammar: string;
  /** Answers recorded for this experience (a stand-in for the strong model). */
  recorded?: (need: Need, state: State) => Answer | null;
  /** A drawing recorded for a thing a model added (a stand-in for the strong model's drawing). */
  recordedDrawing?: (node: Node) => string | null;
  /** A place's name, for a point (for a learned place). */
  placeName?: (at: Pt) => Text;
  /** The server route; null: never call one. */
  endpoint?: string | null;
}

export interface Inference {
  tree?: Tree;
  then: Action[];
  note: Text;
  by: By;
  tier: Tier;
  /** A real model answered (false: a stand-in). */
  live: boolean;
  ms: number;
  observation: string;
  drawNeeded: string[];
  dream: boolean;
}

async function callModel(host: Host, body: unknown): Promise<{ answer: unknown; model: string } | null> {
  if (host.endpoint === null) return null;
  try {
    const res = await fetch(host.endpoint ?? "/api/intents/infer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return (await res.json()) as { answer: unknown; model: string };
  } catch {
    return null;
  }
}

export async function infer(state: State, need: Need, host: Host): Promise<Inference> {
  const t0 = performance.now();
  const tier = tierOf(need);
  const observation = observe(state, need);
  const real = await callModel(host, { task: "infer", tier, observation, need, grammar: host.grammar });
  let answer: Answer | null = null;
  let by: By;
  if (real) {
    answer = real.answer as Answer;
    by = { who: `model:${tier}`, model: real.model, event: describe(need) };
  } else {
    // The stand-in: a weak model's rules are generic; a strong model's answers are the host's, recorded.
    await new Promise((r) => setTimeout(r, tier === "weak" ? 450 : 1100));
    answer = (tier === "weak" ? weakStandIn(state, need, host) : null) ?? host.recorded?.(need, state) ?? null;
    by = { who: "model:recorded", event: describe(need) };
  }
  const ms = Math.round(performance.now() - t0);
  if (!answer) {
    return {
      then: [],
      note: { zh: "模型也读不懂：树不变", en: "The model cannot read it either: the tree stays" },
      by,
      tier,
      live: !!real,
      ms,
      observation,
      drawNeeded: [],
      dream: false,
    };
  }
  const applied = applyAnswer(state.tree, answer, need, by);
  return { ...applied, note: { zh: answer.note_zh, en: answer.note_en }, by, tier, live: !!real, ms, observation, dream: need.kind === "dream" };
}

/** A lazy effect: a thing a model added is drawn by a (strong) model, later. */
export async function draw(state: State, node: Node, host: Host): Promise<Drawing | null> {
  const real = await callModel(host, { task: "draw", tier: "strong", observation: toXml(state), node: { id: node.id, prompt: node.prompt, label: node.label }, grammar: host.grammar });
  if (real) return { svg: String((real.answer as { svg: string }).svg), under: {}, by: { who: "model:strong", model: real.model, event: `draw ${node.id}` } };
  await new Promise((r) => setTimeout(r, 1400));
  const svg = host.recordedDrawing?.(node);
  return svg ? { svg, under: {}, by: { who: "model:recorded", event: `draw ${node.id}` } } : null;
}

const describe = (need: Need) =>
  need.kind === "learn-at"
    ? `drop ${need.node}.${need.intent} at ${need.at.map(Math.round).join(",")}`
    : need.kind === "learn-value"
      ? `leave ${need.node}.${need.intent} at ${need.value.toFixed(2)}`
      : need.kind === "extend"
        ? `past the end of ${need.node}.${need.intent}`
        : need.kind === "new-thing" || need.kind === "dream" || need.kind === "unknown"
          ? need.text
          : "";

// -----------------------------------------------------------------------------
// The weak model's work, as rules (what a weak model is for: one kind more).
// -----------------------------------------------------------------------------

let seq = 0;

function weakStandIn(state: State, need: Need, host: Host): Answer | null {
  const base = { nodes: [], phases: [], title_zh: "", title_en: "" };
  const n = state.tree.nodes.find((x) => x.id === (need as { node?: string }).node);
  const intent = n && "intent" in need ? n.intents[need.intent] : undefined;
  if (!n || !intent) return null;
  if (need.kind === "learn-at") {
    const g = intent.gesture;
    const [y0, s0, y1, s1] = g?.depth ?? [0, 1, 1, 1];
    const scale = Math.max(Math.min(s0, s1) * 0.8, Math.min(Math.max(s0, s1) * 1.05, s0 + ((need.at[1] - y0) / (y1 - y0)) * (s1 - s0)));
    const name = host.placeName?.(need.at) ?? { zh: `新位置`, en: "a new place" };
    const id = `spot${++seq}`;
    return {
      ...base,
      note_zh: `一个新的位置：${name.zh}（离已有的几个都太远），近大远小，比例 ${scale.toFixed(2)}`,
      note_en: `A new place: ${name.en} (too far from the ones it had), scaled by depth to ${scale.toFixed(2)}`,
      kinds: [{ node: n.id, intent: need.intent, kind: { id, label_zh: name.zh, label_en: name.en, aka: [name.zh], realize: fromRealize({ [g?.field ?? "at"]: need.at.map(Math.round), scale: +scale.toFixed(3) }), p: 0.8 } }],
      picks: [{ node: n.id, intent: need.intent, kind: id }],
    };
  }
  if (need.kind === "learn-value") {
    const pct = Math.round(need.value * 100);
    const id = `${need.field}${pct}`;
    return {
      ...base,
      note_zh: `停在两种之间：记成一种新的（${pct}%），以后也能说出来`,
      note_en: `Left between two kinds: a new one (${pct}%), nameable from now on`,
      kinds: [{ node: n.id, intent: need.intent, kind: { id, label_zh: `${pct}%`, label_en: `${pct}%`, aka: [], realize: fromRealize({ [need.field]: +need.value.toFixed(3) }), p: 0.8 } }],
      picks: [{ node: n.id, intent: need.intent, kind: id }],
    };
  }
  if (need.kind === "extend") {
    // One step further along: every number in the last two kinds, extrapolated.
    const ks = Object.values(intent.kinds);
    const [a, b] = need.dir > 0 ? [ks[ks.length - 2], ks[ks.length - 1]] : [ks[1], ks[0]];
    const realize: Record<string, unknown> = {};
    for (const [f, v] of Object.entries(b.realize)) {
      const w = a?.realize[f];
      realize[f] = typeof v === "number" && typeof w === "number" ? +Math.max(0, v + (v - w)).toFixed(3) : v;
    }
    const id = `${need.intent}${need.dir > 0 ? "+" : "-"}${ks.length}`;
    const label = need.dir > 0 ? { zh: `比「${b.label.zh}」还过`, en: `beyond ${b.label.en}` } : { zh: `比「${b.label.zh}」还不及`, en: `short of ${b.label.en}` };
    return {
      ...base,
      note_zh: `已经在这个尺度的尽头：往外再延一档（${label.zh}）`,
      note_en: `Already at the end of the scale: one more step out (${label.en})`,
      kinds: [{ node: n.id, intent: need.intent, kind: { id, label_zh: label.zh, label_en: label.en, aka: [], realize: fromRealize(realize), p: 0.8 } }],
      picks: [{ node: n.id, intent: need.intent, kind: id }],
    };
  }
  return null;
}
