import type { Screen } from "./forget";
import type { Action, Decision } from "./model";
import { admit, admitTree, keyOf, type Dir, type Entity, type Gesture, type IntentNode, type Tree, type Words } from "./tree";

// =============================================================================
// Events, and the paths they take. A strong model drives everything; every
// other path is a short one through what it wrote.
//
//   event ──▶ ① vocabulary ── a phrase or gesture the tree names ──────────────▶ decide (the person's)
//                 │ (no model: a person's resolve, matched as data)
//                 ▼ not named
//             ② weak model, words only: select ── sure (≥ 0.7) ──────────────────▶ believe (the model's)
//                 │ (cheap, fast; its reading is a belief, under any person's decision, never learned)
//                 ▼ not sure, "no kind fits", or a drag (a weak text model does not read gestures)
//             ③ strong model: decide (on the person's behalf) ──▶ learn ──▶ ①, believe, or add an intent
//
//   and, apart from events: the strong model authors the whole tree from the
//   scene (re-author), and the tree replaces the one in force.
//
// What a model answers is data, checked against the stage before it is let
// in. What a short path answers is what a model wrote before: the vocabulary
// of the authored tree, or a phrase a weak model's choice taught it.
// =============================================================================

export type Point = { x: number; y: number };

/** What is under a point on the stage: a node, a population's member, or the paper. */
export type Hit = { id: string | null; member?: number };

export type LabEvent =
  | {
      kind: "drag";
      screen: Screen;
      from: Point & Hit;
      to: Point & Hit;
      /** The things whose shapes hold each end of it. */
      within: { from: string[]; to: string[] };
    }
  | { kind: "prompt"; screen: Screen; entity: string | null; text: string };

/** Which way a drag mostly went, if it mostly went one way. */
export function dirOf(e: Extract<LabEvent, { kind: "drag" }>): Dir | null {
  const dx = e.to.x - e.from.x;
  const dy = e.to.y - e.from.y;
  if (Math.hypot(dx, dy) < 30) return null;
  if (Math.abs(dx) > 2 * Math.abs(dy)) return dx > 0 ? "right" : "left";
  if (Math.abs(dy) > 2 * Math.abs(dx)) return dy > 0 ? "down" : "up";
  return null;
}

const subjectOf = (h: Hit) => (h.id && h.member !== undefined ? `${h.id}#${h.member}` : h.id);
const norm = (t: string) => t.trim().toLowerCase().replace(/[.!?。！？]+$/, "");

/** Does a drag do what a gesture says, for a node about `of`? */
function matches(g: Gesture, of: string, e: Extract<LabEvent, { kind: "drag" }>) {
  const start = subjectOf(e.from);
  if (g.from === "self" ? start !== of : e.from.id !== g.from) return false;
  const d = dirOf(e);
  if (g.dir) {
    if (!d) return false;
    if (g.dir === "horizontal" ? d !== "left" && d !== "right" : g.dir === "vertical" ? d !== "up" && d !== "down" : d !== g.dir) return false;
  }
  if (g.outOf && !(e.within.from.includes(g.outOf) && !e.within.to.includes(g.outOf))) return false;
  if (g.into && !(e.within.to.includes(g.into) && !e.within.from.includes(g.into))) return false;
  return Math.hypot(e.to.x - e.from.x, e.to.y - e.from.y) >= 30;
}

/** What a short path found: one node and kind, and why in words. */
export interface Found {
  key: string;
  kind: string;
  why: Words;
}

/**
 * ①: the event against the tree's vocabulary, as data. One match is a
 * decision; none, or more than one, is for a model.
 */
export function recognize(e: LabEvent, tree: Tree): Found | null {
  const hits: { node: IntentNode; kind: string; how: string }[] = [];
  if (e.kind === "drag") {
    for (const node of tree)
      for (const [kind, gs] of Object.entries(node.gestures ?? {}))
        for (const g of gs) if (matches(g, node.of, e)) hits.push({ node, kind, how: describeGesture(g) });
  } else {
    const text = norm(e.text);
    if (!text) return null;
    const about = tree.filter((n) => !e.entity || n.of === e.entity || n.of.startsWith(`${e.entity}#`) || e.entity.startsWith(`${n.of}#`));
    for (const node of about)
      for (const [kind, k] of Object.entries(node.kinds)) {
        const said = [...(node.say?.[kind] ?? []), k.words.en, k.words.zh, kind].map(norm);
        if (said.includes(text)) hits.push({ node, kind, how: `"${e.text.trim()}"` });
      }
  }
  const unique = [...new Map(hits.map((h) => [`${keyOf(h.node)}=${h.kind}`, h])).values()];
  if (unique.length !== 1) return null;
  const [{ node, kind, how }] = unique;
  return {
    key: keyOf(node),
    kind,
    why: {
      en: `${how} is in the vocabulary: ${node.words.en} → ${node.kinds[kind].words.en}`,
      zh: `${how} 在词汇表里：${node.words.zh} → ${node.kinds[kind].words.zh}`,
    },
  };
}

export function describeGesture(g: Gesture) {
  return [`drag ${g.from === "self" ? "it" : g.from}`, g.dir, g.outOf && `out of ${g.outOf}`, g.into && `into ${g.into}`].filter(Boolean).join(" ");
}

/** The gesture a drag was, for a node about `of`: what it teaches the vocabulary once a model has said what it meant. */
export function gestureOf(e: Extract<LabEvent, { kind: "drag" }>, of: string): Gesture | null {
  const start = subjectOf(e.from);
  if (!start) return null;
  const from = start === of ? "self" : e.from.id!;
  const left = e.within.from.find((x) => !e.within.to.includes(x) && x !== e.from.id);
  const entered = e.within.to.find((x) => !e.within.from.includes(x) && x !== e.from.id);
  const d = dirOf(e);
  if (left) return { from, outOf: left };
  if (entered) return { from, into: entered };
  return d ? { from, dir: d } : null;
}

// -----------------------------------------------------------------------------
// The models. What each is shown, what each may answer.

/** What a model is shown: the stage, the tree, what people decided, the event, and the context. */
export interface Observation {
  entities: Entity[];
  tree: Tree;
  decisions: Record<string, Decision>;
  event: LabEvent;
  /** Earlier prompts: context too (what the person has been asking for). */
  prompts: string[];
}

/** How sure a weak model must be for its choice to stand without the strong model. */
export const SURE = 0.7;

/** ②: a weak model may only choose within the tree, and says how sure it is. */
export type Selection =
  | { action: "decide"; key: string; kind: string; sure?: number; why: string }
  | { action: "believe"; beliefs: { key: string; p: Record<string, number> }[]; sure?: number; why: string }
  /** `escalate`: no kind fits, but a knob on the stage could say it: a strong model should add an intent. */
  | { action: "none"; escalate?: boolean; why: string };

/** ③: the strong model decides, believes, adds an intent (with the vocabulary for this event), or says why it cannot. */
export type Addition =
  | { action: "add"; node: unknown; kind?: string; why: string }
  | Extract<Selection, { action: "decide" | "believe" }>
  | { action: "none"; why: string };

/** Authoring: a strong model writes the whole tree from the scene, and what it believes about it. */
export type Authoring = { tree: unknown; beliefs?: { key: string; p: Record<string, number> }[]; why?: string };

/** What came of an event on a model's path: an action (or none), why, and what it failed. */
export interface Outcome {
  action: Action | null;
  why: Words;
  problems?: string[];
  escalate?: boolean;
}

const said = (s: string | undefined): Words => ({ en: s ?? "", zh: s ?? "" });

/** A key as a model wrote it, read the way it can only have meant: exact, or a type with one intent ("dust" is dust|dust), or "type|of:x". */
export function keyIn(tree: Tree, key: string): string | null {
  const keys = tree.map(keyOf);
  if (keys.includes(key)) return key;
  // "type|of:x", or a kind stuck on the end ("dust|dust:settles").
  for (const fixed of [key.replace("|of:", "|"), key.split(":")[0]]) if (keys.includes(fixed)) return fixed;
  const ofType = tree.filter((n) => n.type === key);
  return ofType.length === 1 ? keyOf(ofType[0]) : null;
}

/** A decision or a belief, checked: it names an intent and that intent's kinds. */
function acceptChoice(answer: Extract<Selection, { action: "decide" | "believe" }>, o: Observation): Outcome {
  const byKey = new Map(o.tree.map((n) => [keyOf(n), n]));
  if (answer.action === "decide") {
    const key = keyIn(o.tree, answer.key);
    const node = key ? byKey.get(key) : undefined;
    if (!key || !node || !(answer.kind in node.kinds)) return { action: null, why: said(answer.why), problems: [`no kind "${answer.kind}" on "${answer.key}"`] };
    return { action: { type: "decide", key, kind: answer.kind, from: "prompted", screen: o.event.screen }, why: said(answer.why) };
  }
  const ok = (answer.beliefs ?? [])
    .map((b) => ({ ...b, key: keyIn(o.tree, b.key) ?? b.key }))
    .filter((b) => byKey.has(b.key) && Object.keys(b.p ?? {}).every((k) => k in byKey.get(b.key)!.kinds));
  if (!ok.length) return { action: null, why: said(answer.why), problems: ["no belief names a node and its kinds"] };
  return { action: { type: "believe", beliefs: ok }, why: said(answer.why) };
}

/**
 * ②'s answer, checked. A weak model's reading is a belief: the model's, under
 * any person's decision, never learned. It stands only when the model is
 * sure of it; otherwise, or when it says a knob could do what no kind does,
 * the event goes to the strong model (`escalate`). A drag never comes here.
 */
export function acceptSelection(answer: Selection, o: Observation): Outcome {
  if (answer.action === "decide" || answer.action === "believe") {
    const sure = typeof answer.sure === "number" ? answer.sure : 0;
    if (sure < SURE) return { action: null, why: said(`not sure (${sure}): ${answer.why}`), escalate: true };
    const out = acceptChoice(answer, o);
    if (out.action?.type !== "decide") return out;
    // "It means settles", read by a weak model: the model believes settles, as surely as it says.
    const { key, kind } = out.action;
    const node = o.tree.find((n) => keyOf(n) === key)!;
    const kinds = Object.keys(node.kinds);
    const p = Object.fromEntries(kinds.map((k) => [k, k === kind ? sure : (1 - sure) / (kinds.length - 1)]));
    return { action: { type: "believe", beliefs: [{ key: keyOf(node), p }] }, why: out.why };
  }
  return { action: null, why: said(answer.why ?? "nothing to do"), escalate: answer.action === "none" && !!answer.escalate };
}

/** What a decision the strong model made teaches the vocabulary: these words, or this drag, mean that kind. */
export function lessonOf(e: LabEvent, a: Action, tree: Tree): Extract<Action, { type: "learn" }> | null {
  if (a.type !== "decide") return null;
  const node = tree.find((n) => keyOf(n) === a.key);
  if (!node) return null;
  const gesture = e.kind === "drag" ? (gestureOf(e, node.of) ?? undefined) : undefined;
  const phrase = e.kind === "prompt" ? e.text : undefined;
  return phrase || gesture ? { type: "learn", key: a.key, kind: a.kind, phrase, gesture } : null;
}

/** Whether an event may take the weak path: words, yes; a drag, no (a weak text model does not read gestures). */
export const weakReads = (e: LabEvent) => e.kind === "prompt";

/** ③'s answer, checked: a choice like ②'s (the strong model needs no threshold), or a node `admit` lets in, which learns this event as it is added. */
export function acceptAddition(answer: Addition, o: Observation, by: string): Outcome {
  if (answer.action === "decide" || answer.action === "believe") return acceptChoice(answer, o);
  if (answer.action !== "add") return { action: null, why: said(answer.why) };
  const r = admit(answer.node, o.entities, { from: "model", by });
  if ("problems" in r) return { action: null, why: said(answer.why), problems: r.problems };
  let node = r.node;
  const kind = answer.kind && answer.kind in node.kinds ? answer.kind : undefined;
  if (kind) {
    const e = o.event;
    const phrase = e.kind === "prompt" ? norm(e.text) : undefined;
    const gesture = e.kind === "drag" ? gestureOf(e, node.of) ?? undefined : undefined;
    if (phrase && !(node.say?.[kind] ?? []).includes(phrase)) node = { ...node, say: { ...node.say, [kind]: [...(node.say?.[kind] ?? []), phrase] } };
    if (gesture) node = { ...node, gestures: { ...node.gestures, [kind]: [...(node.gestures?.[kind] ?? []), gesture] } };
  }
  return { action: { type: "add", node, ...(kind ? { kind, from: "prompted" as const, screen: o.event.screen } : {}) }, why: said(answer.why) };
}

/** An authored tree, checked whole: every node admitted; beliefs only about its own nodes and kinds. */
export function acceptAuthoring(answer: Authoring, entities: Entity[], by: string): { action: Action | null; problems?: string[] } {
  const r = admitTree(answer.tree, entities, by);
  if ("problems" in r) return { action: null, problems: r.problems };
  const byKey = new Map(r.tree.map((n) => [keyOf(n), n]));
  const beliefs = Object.fromEntries(
    (answer.beliefs ?? [])
      .filter((b) => byKey.has(b.key) && Object.keys(b.p ?? {}).every((k) => k in byKey.get(b.key)!.kinds))
      .map((b) => [b.key, { p: b.p }]),
  );
  return { action: { type: "replace", tree: r.tree, beliefs } };
}

// -----------------------------------------------------------------------------
// When no model is reachable (a dev server with no key): stand-ins that answer
// the way each model is asked to, so every path can be walked offline. Not
// models, and the log says so.

export function standInSelect(o: Observation): Selection {
  const e = o.event;
  if (e.kind === "drag") {
    if (e.from.id === "moments" && e.to.id === "moments")
      return { action: "none", escalate: false, why: "That reorders the moments; no knob orders them, so no intent can: a kind to regenerate, not a choice." };
    return { action: "none", escalate: false, why: "A drag that names nothing the tree can say." };
  }
  const t = e.text.toLowerCase();
  if (/snow|fall|sink|雪|落|沉/.test(t)) return { action: "decide", key: "dust|dust", kind: "settles", sure: 0.9, why: "Falling like snow is the dust settling." };
  if (/never let|don't let|别让|不要让/.test(t) && e.entity?.startsWith("moments#"))
    return { action: "decide", key: `keep|${e.entity}`, kind: "stays", sure: 0.9, why: "Never letting it go is keeping it." };
  if (/sad|melanchol|难过|伤感/.test(t))
    return {
      action: "believe",
      beliefs: [
        { key: "holding|edge", p: { wears: 0.8, keeps: 0.2 } },
        { key: "letgo|tide", p: { tide: 0.3, oneByOne: 0.7 } },
        { key: "dust|dust", p: { rises: 0.25, settles: 0.75 } },
      ],
      sure: 0.8,
      why: "A mood, not a choice: it moves what the model believes about several intents, and leaves whatever a person decided.",
    };
  if (/slow|linger|fast|quick|hurry|big|large|慢|快|大/.test(t))
    return { action: "none", escalate: true, why: "No intent says how fast or how large the moments are, but their knobs could: a new intent is needed." };
  return { action: "none", escalate: false, why: "Nothing in the tree or the stage's knobs answers that." };
}

export function standInAdd(o: Observation): Addition {
  const e = o.event;
  if (e.kind !== "prompt") return { action: "none", why: "No knob answers that drag." };
  const t = e.text.toLowerCase();
  const moments = o.entities.find((x) => x.id === "moments");
  const gap = (moments?.params.gap?.value as number) ?? 0.95;
  const size = (moments?.params.size?.value as number) ?? 56;
  const pace = (kind: string, words: Words, value: number, say: string[]) => ({
    action: "add" as const,
    node: {
      type: "pace",
      of: "moments",
      words: { en: "How fast they come", zh: "来得多快" },
      kinds: {
        asWritten: { words: { en: "As written", zh: "原样" }, patch: { moments: { gap } } },
        [kind]: { words, patch: { moments: { gap: value } } },
      },
      resolve: "switch",
      say: { asWritten: ["as written", "原样"], [kind]: say },
    },
    kind,
    why: "No intent says how fast the moments come; the gap between them does, so a new intent with the scene as written as its other kind.",
  });
  if (/slow|linger|慢/.test(t)) return pace("slower", { en: "Slower", zh: "慢一些" }, 1.5, ["slower", "slow down", "慢一些", "慢一点"]);
  if (/fast|quick|hurry|快/.test(t)) return pace("faster", { en: "Faster", zh: "快一些" }, 0.6, ["faster", "speed up", "快一些", "快一点"]);
  if (/big|large|大/.test(t))
    return {
      action: "add",
      node: {
        type: "scale",
        of: "moments",
        words: { en: "How large they are", zh: "有多大" },
        kinds: {
          asWritten: { words: { en: "As written", zh: "原样" }, patch: { moments: { size } } },
          larger: { words: { en: "Larger", zh: "大一些" }, patch: { moments: { size: 72 } } },
        },
        resolve: "switch",
        say: { larger: ["larger", "bigger", "大一些", "大一点"] },
      },
      kind: "larger",
      why: "A new intent: how large the moments are.",
    };
  return { action: "none", why: "No knob on the stage answers that." };
}

// -----------------------------------------------------------------------------

type Mode = "select" | "add" | "author";

/**
 * Ask a model (the dev server's or a deployment's /api/intent). With no model
 * configured (501), the stand-in answers, under its own name; a model that
 * answered badly is a failure, never quietly the stand-in.
 */
export async function ask<T>(mode: Mode, body: object, standIn: () => T): Promise<{ answer?: T; by: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch("/api/intent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode, ...body }) });
  } catch {
    return { answer: standIn(), by: "stand-in" };
  }
  if (res.status === 501) return { answer: standIn(), by: "stand-in" };
  const out = (await res.json().catch(() => ({}))) as { answer?: T; model?: string; error?: string };
  if (!res.ok || !out.answer) return { by: out.model ?? "model", error: out.error ?? `the model route said ${res.status}` };
  return { answer: out.answer, by: out.model ?? "model" };
}
