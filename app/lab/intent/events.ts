import type { Screen } from "./forget";
import type { Action, Decision } from "./model";
import { admit, keyOf, type Entity, type IntentNode, type Tree, type Words } from "./tree";

// =============================================================================
// Events, and what each comes to.
//
// A drag, a prompt, an edit: each is an event, handed to one callback. The
// callback either knows it (a preset: the gesture names an intent and a kind)
// and returns an action at once, or it does not, and the event becomes an
// effect: a model is shown the tree and the event and writes the action. The
// action, either way, goes through the same reducer, and the screens follow.
//
//   event ──▶ recognize ──▶ ① action ───────────────────────────▶ dispatch
//                  │
//                  └──────▶ ② infer (a model, async) ──▶ admit ──▶ dispatch
//
// ① is Flux: no model, nothing to wait for. ② is ReAct: the model observes
// (the tree, the decisions, the event, the context) and acts, and what it
// writes is data, checked against the stage before it is let in.
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
      /** The window's box on the stage, to say whether a drag left it. */
      window: { x: number; y: number; w: number; h: number } | null;
    }
  | { kind: "prompt"; screen: Screen; entity: string | null; text: string };

/** What a recognizer or a model made of an event. */
export interface Outcome {
  action: Action | null;
  /** In words, for the log. */
  why: Words;
}

const inside = (p: Point, b: { x: number; y: number; w: number; h: number } | null) =>
  !!b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

/**
 * ①: the gestures and words a preset already means. A moment dragged out of
 * the window is kept, dragged back in it goes; the window dragged sideways
 * lies on its side, dragged up stands; the dust dragged down settles, up it
 * rises; a prompt that names one kind of one intent is that kind. Anything
 * else is null: not for code to guess.
 */
export function recognize(e: LabEvent, tree: Tree, kept: number[]): Outcome | null {
  const has = (key: string) => tree.some((n) => keyOf(n) === key);
  if (e.kind === "drag") {
    const dx = e.to.x - e.from.x;
    const dy = e.to.y - e.from.y;
    const far = Math.hypot(dx, dy) >= 30;
    if (!far) return null;
    if (e.from.id === "moments" && e.from.member !== undefined) {
      const i = e.from.member;
      const key = `keep|moments#${i}`;
      if (!has(key)) return null;
      const out = !inside(e.to, e.window);
      if (out && !kept.includes(i))
        return { action: { type: "decide", key, kind: "stays", from: "dragged", screen: e.screen }, why: { en: "dragged out of the window: keep it", zh: "拖出窗外：留住它" } };
      if (!out && kept.includes(i))
        return { action: { type: "decide", key, kind: "goes", from: "dragged", screen: e.screen }, why: { en: "dragged back into the window: let it go", zh: "拖回窗里：让它走" } };
      return null;
    }
    if (e.from.id === "window" && has("axis|window")) {
      if (Math.abs(dx) > 2 * Math.abs(dy))
        return { action: { type: "decide", key: "axis|window", kind: "across", from: "dragged", screen: e.screen }, why: { en: "the window dragged sideways: lay it on its side, here and on wider screens", zh: "把窗横着拖：在这里和更宽的屏幕上，让它躺下" } };
      if (Math.abs(dy) > 2 * Math.abs(dx))
        return { action: { type: "decide", key: "axis|window", kind: "up", from: "dragged", screen: e.screen }, why: { en: "the window dragged up or down: stand it up, here and on taller screens", zh: "把窗竖着拖：在这里和更高的屏幕上，让它立起来" } };
      return null;
    }
    if (e.from.id === "dust" && has("dust|dust") && Math.abs(dy) > Math.abs(dx)) {
      const kind = dy > 0 ? "settles" : "rises";
      return { action: { type: "decide", key: "dust|dust", kind, from: "dragged", screen: e.screen }, why: dy > 0 ? { en: "the dust pulled down: let it settle", zh: "把尘往下拉：让它落下" } : { en: "the dust pushed up: let it rise", zh: "把尘往上推：让它升起" } };
    }
    return null;
  }
  // A prompt that is, word for word, one kind of one intent (about the chosen thing, if one is chosen).
  const text = e.text.trim().toLowerCase();
  if (!text) return null;
  const about = tree.filter((n) => !e.entity || n.of === e.entity || n.of.startsWith(`${e.entity}#`));
  const hits: { node: IntentNode; kind: string }[] = [];
  for (const node of about)
    for (const [kind, k] of Object.entries(node.kinds))
      if ([k.words.en, k.words.zh, kind].some((w) => w.toLowerCase() === text)) hits.push({ node, kind });
  if (hits.length !== 1) return null;
  const [{ node, kind }] = hits;
  return {
    action: { type: "decide", key: keyOf(node), kind, from: "prompted", screen: e.screen },
    why: { en: `"${e.text.trim()}" names one kind: ${node.words.en} → ${node.kinds[kind].words.en}`, zh: `「${e.text.trim()}」正好是一个选项：${node.words.zh} → ${node.kinds[kind].words.zh}` },
  };
}

// -----------------------------------------------------------------------------
// ②: a model reads the event. What it may write, and what it is shown.

/** What a model is shown: the stage, the tree, what people decided, the event, and the context. */
export interface Observation {
  entities: Entity[];
  tree: Tree;
  decisions: Record<string, Decision>;
  event: LabEvent;
  /** Earlier prompts: context too (what the person has been asking for). */
  prompts: string[];
}

/** What a model may answer: one action, in data, and why. */
export type ModelAnswer =
  | { action: "decide"; key: string; kind: string; why: string }
  | { action: "add"; node: unknown; kind?: string; why: string }
  | { action: "believe"; beliefs: { key: string; p: Record<string, number> }[]; why: string }
  | { action: "none"; why: string };

/**
 * A model's answer, checked and made an action. A decision must name a node
 * and one of its kinds; a node must pass `admit`; a belief must name kinds.
 * What fails is not let in, and the log says why.
 */
export function accept(answer: ModelAnswer, o: Observation): Outcome & { problems?: string[] } {
  const why = (s: string): Words => ({ en: s, zh: s });
  const byKey = new Map(o.tree.map((n) => [keyOf(n), n]));
  const screen = o.event.screen;
  if (answer.action === "decide") {
    const node = byKey.get(answer.key);
    if (!node || !(answer.kind in node.kinds)) return { action: null, why: why(answer.why), problems: [`no kind "${answer.kind}" on "${answer.key}"`] };
    return { action: { type: "decide", key: answer.key, kind: answer.kind, from: "prompted", screen }, why: why(answer.why) };
  }
  if (answer.action === "add") {
    const r = admit(answer.node, o.entities);
    if ("problems" in r) return { action: null, why: why(answer.why), problems: r.problems };
    const kind = answer.kind && answer.kind in r.node.kinds ? answer.kind : undefined;
    return { action: { type: "add", node: r.node, ...(kind ? { kind, from: "prompted" as const, screen } : {}) }, why: why(answer.why) };
  }
  if (answer.action === "believe") {
    const ok = (answer.beliefs ?? []).filter((b) => byKey.has(b.key) && Object.keys(b.p ?? {}).every((k) => k in byKey.get(b.key)!.kinds));
    if (!ok.length) return { action: null, why: why(answer.why), problems: ["no belief names a node and its kinds"] };
    return { action: { type: "believe", beliefs: ok }, why: why(answer.why) };
  }
  return { action: null, why: why(answer.why ?? "nothing to do") };
}

/**
 * The model, when none is reachable (a dev server with no key): a few rules
 * that answer the way the model is asked to, so the second path can be
 * walked offline. Not a model, and the log says so.
 */
export function standIn(o: Observation): ModelAnswer {
  const e = o.event;
  const moments = o.entities.find((x) => x.id === "moments");
  const gap = (moments?.params.gap?.value as number) ?? 0.95;
  const size = (moments?.params.size?.value as number) ?? 56;
  if (e.kind === "drag") {
    if (e.from.id === "moments" && e.to.id === "moments")
      return { action: "none", why: "That reorders the moments. Nothing in this scene orders them (no knob does), so no intent can: that is a kind to regenerate, not a choice to make." };
    return { action: "none", why: "A drag that names nothing on the stage." };
  }
  const t = e.text.toLowerCase();
  if (/slow|linger|慢/.test(t))
    return {
      action: "add",
      node: {
        type: "pace",
        of: "moments",
        words: { en: "How fast they come", zh: "来得多快" },
        kinds: {
          asWritten: { words: { en: "As written", zh: "原样" }, patch: { moments: { gap } } },
          slower: { words: { en: "Slower", zh: "慢一些" }, patch: { moments: { gap: 1.5 } } },
        },
        resolve: "switch",
      },
      kind: "slower",
      why: "No intent says how fast the moments come; a new one does, with the scene as written as its other kind.",
    };
  if (/fast|quick|hurry|快/.test(t))
    return {
      action: "add",
      node: {
        type: "pace",
        of: "moments",
        words: { en: "How fast they come", zh: "来得多快" },
        kinds: {
          asWritten: { words: { en: "As written", zh: "原样" }, patch: { moments: { gap } } },
          faster: { words: { en: "Faster", zh: "快一些" }, patch: { moments: { gap: 0.6 } } },
        },
        resolve: "switch",
      },
      kind: "faster",
      why: "No intent says how fast the moments come; a new one does.",
    };
  if (/big|large|close|大/.test(t))
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
      },
      kind: "larger",
      why: "A new intent: how large the moments are.",
    };
  if (/snow|fall|sink|雪|落|沉/.test(t)) return { action: "decide", key: "dust|dust", kind: "settles", why: "Falling like snow is the dust settling." };
  if (/sad|melanchol|难过|伤感/.test(t))
    return {
      action: "believe",
      beliefs: [
        { key: "holding|edge", p: { wears: 0.8, keeps: 0.2 } },
        { key: "letgo|tide", p: { tide: 0.3, oneByOne: 0.7 } },
        { key: "dust|dust", p: { rises: 0.25, settles: 0.75 } },
      ],
      why: "A mood, not a choice: it shifts what the model believes about several intents, and leaves alone whatever a person decided.",
    };
  return { action: "none", why: "Nothing in the tree or the stage's knobs answers that." };
}

/** Ask the model (the dev server's or a deployment's /api/intent); with none, the stand-in. */
export async function infer(o: Observation): Promise<{ answer: ModelAnswer; by: string }> {
  try {
    const res = await fetch("/api/intent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(o) });
    if (res.status === 501) return { answer: standIn(o), by: "stand-in" };
    const body = (await res.json()) as { answer?: ModelAnswer; model?: string; error?: string };
    if (!res.ok || !body.answer) return { answer: { action: "none", why: body.error ?? `the model route said ${res.status}` }, by: body.model ?? "model" };
    return { answer: body.answer, by: body.model ?? "model" };
  } catch {
    return { answer: standIn(o), by: "stand-in" };
  }
}
