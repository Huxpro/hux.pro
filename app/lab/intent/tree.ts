import { space } from "reintent";
import type { Params } from "stage";

// =============================================================================
// The intent tree: the state, and nothing but data. A model writes it.
//
// Each node is one intent about one thing on the stage: a closed set of
// kinds, each with the props it sets (its patch), and its vocabulary: what a
// person says (`say`) and does (`gestures`) that means each kind. A strong
// model authors the whole tree from the scene, and adds a node when an event
// needs one no node has; everything faster than that is a short path through
// what it wrote: a person's gesture matched against the vocabulary, a weak
// model choosing among its kinds, code compiling the choice. Nothing the
// model writes is let in unchecked (`admit`).
//
//   strong model ──▶ tree (kinds, patches, vocabulary) ──▶ reintent ──▶ one kind per node, per screen ──▶ compile ──▶ props
// =============================================================================

export type Words = { en: string; zh: string };

export interface KindNode {
  words: Words;
  /** The props this kind sets, by node id. Every kind of a node sets the same props, so switching always undoes. */
  patch: Params;
}

export type Dir = "up" | "down" | "left" | "right" | "horizontal" | "vertical";

/** A drag that means a kind: where it starts, which way it goes, which shape it leaves or enters. */
export interface Gesture {
  /** What it starts on: an entity id, or "self" (what the node is about, a member included). */
  from: string;
  dir?: Dir;
  /** It ends inside this entity's shape ("self": what the node is about), having started outside it. */
  into?: string;
  /** It starts inside this entity's shape ("self": what the node is about) and ends outside it. */
  outOf?: string;
}

export interface IntentNode {
  /** The sort of choice; nodes of one type share a preference ("keep" for every moment). */
  type: string;
  /** What it is about: a node id (`dust`), or a population's member (`moments#0`). */
  of: string;
  /** What it decides, as a question has it. */
  words: Words;
  /** The closed set; the first is the scene as written. */
  kinds: Record<string, KindNode>;
  /** Code's guess before any model; uniform when left out. */
  prior?: Record<string, number>;
  /** When nobody is sure: ask the person, or act and offer the others as a switch. */
  resolve: "ask" | "switch";
  question?: Words;
  /** Its value crosses over along the context: `base` at the high end. */
  index?: { by: "tallness"; base: string };
  /** What a person says that means each kind (any language, lower case). */
  say?: Record<string, string[]>;
  /** What a person does that means each kind. */
  gestures?: Record<string, Gesture[]>;
  /** The tree's authoring (`preset`), or added for an event (`model`). */
  from: "preset" | "model";
  /** Which model wrote it. */
  by?: string;
}

export type Tree = IntentNode[];

export const keyOf = (n: Pick<IntentNode, "type" | "of">) => `${n.type}|${n.of}`;

/** What a screen is, as reintent's index reads it. */
export type IndexOf = (by: "tallness", ctx: unknown) => number;

/** reintent's types from a tree: one type per `type`, one subject per node. */
export function typesOf(tree: Tree, indexOf: IndexOf) {
  const byType = new Map<string, IntentNode[]>();
  for (const n of tree) byType.set(n.type, [...(byType.get(n.type) ?? []), n]);
  return space(
    Object.fromEntries(
      [...byType].map(([type, nodes]) => {
        const first = nodes[0];
        return [
          type,
          {
            kinds: (n: IntentNode) => Object.keys(n.kinds),
            subjects: () => nodes,
            id: (n: IntentNode) => n.of,
            prior: (n: IntentNode) => n.prior ?? Object.fromEntries(Object.keys(n.kinds).map((k) => [k, 1])),
            describe: (k: string, n: IntentNode) => n.kinds[k]?.words.en ?? k,
            resolve: first.resolve,
            pref: true,
            ...(first.index
              ? { index: { of: (ctx: unknown) => indexOf(first.index!.by, ctx), base: (n: IntentNode) => n.index?.base ?? first.index!.base } }
              : {}),
          },
        ];
      }),
    ),
  );
}

/** The props for one screen: each node's chosen kind's patch, merged (lists are joined: every kept moment). */
export function compile(tree: Tree, chosen: Record<string, string>): Params {
  const out: Params = {};
  for (const n of tree) {
    const kind = n.kinds[chosen[keyOf(n)]] ?? Object.values(n.kinds)[0];
    for (const [node, props] of Object.entries(kind.patch)) {
      const into = (out[node] ??= {});
      for (const [prop, value] of Object.entries(props)) {
        into[prop] = Array.isArray(value)
          ? [...new Set([...((Array.isArray(into[prop]) ? into[prop] : []) as unknown[]), ...value])].sort()
          : value;
      }
    }
  }
  return out;
}

// -----------------------------------------------------------------------------
// What a model may write: checked against the stage it is for.

/** One thing on the stage, as a model is told about it. */
export interface Entity {
  id: string;
  kind: string;
  intent: string;
  names: string[];
  /** Its knobs: the value the scene wrote, and the spec. */
  params: Record<string, { value: unknown; unit?: string; range?: [number, number]; note?: string }>;
  /** A population's members, by index. */
  members?: string[];
}

const NAME = /^[a-zA-Z][a-zA-Z0-9-]{0,23}$/;
const DIRS = new Set(["up", "down", "left", "right", "horizontal", "vertical"]);
const MAX_SAY = 12;

const words = (w: unknown): Words | null =>
  w && typeof w === "object" && typeof (w as Words).en === "string"
    ? { en: (w as Words).en.slice(0, 80), zh: typeof (w as Words).zh === "string" ? (w as Words).zh.slice(0, 80) : (w as Words).en.slice(0, 80) }
    : null;

/**
 * A node a model wrote, made whole (kinds that leave a prop out get the
 * value the scene wrote, so switching back undoes) and checked: what it is
 * about exists, its kinds are a closed set of two to four, every patch is a
 * knob that exists, in its range. Returns the node, or why not. Its
 * vocabulary is held to its own kinds and things on the stage too, but a
 * phrase or gesture that fails is dropped (and said, in `dropped`), not the
 * node: a wrong word costs a short path, a wrong patch would change the scene.
 */
export function admit(
  raw: unknown,
  entities: Entity[],
  { from = "model", by }: { from?: IntentNode["from"]; by?: string } = {},
): { node: IntentNode; dropped?: string[] } | { problems: string[] } {
  const problems: string[] = [];
  const n = raw as Partial<IntentNode> | null;
  if (!n || typeof n !== "object") return { problems: ["not an intent node"] };
  const byId = new Map(entities.map((e) => [e.id, e]));
  if (typeof n.type !== "string" || !NAME.test(n.type)) problems.push(`type "${n.type}" is not a short name`);
  const [ofId, member] = String(n.of ?? "").split("#");
  const of = byId.get(ofId);
  if (!of) problems.push(`"${n.of}" is not on the stage`);
  else if (member !== undefined && !(of.members && Number(member) >= 0 && Number(member) < of.members.length)) problems.push(`"${n.of}" is not one of its members`);
  const kinds = Object.entries((n.kinds ?? {}) as Record<string, Partial<KindNode>>);
  if (kinds.length < 2 || kinds.length > 4) problems.push(`it has ${kinds.length} kinds; a choice has two to four`);
  // Every prop any kind sets, so each kind can set them all.
  const touched = new Map<string, Set<string>>();
  for (const [name, k] of kinds) {
    if (!NAME.test(name)) problems.push(`kind "${name}" is not a short name`);
    if (!words(k.words)) problems.push(`kind "${name}" has no words`);
    for (const [node, props] of Object.entries(k.patch ?? {})) {
      const e = byId.get(node);
      if (!e) {
        problems.push(`kind "${name}" sets "${node}", which is not on the stage`);
        continue;
      }
      for (const [prop, value] of Object.entries(props ?? {})) {
        const spec = e.params[prop];
        if (!spec) problems.push(`${node} has no knob "${prop}"`);
        else if (typeof spec.value === "number" && (typeof value !== "number" || !Number.isFinite(value))) problems.push(`${node}.${prop} takes a number`);
        else if (typeof spec.value === "number" && spec.range && ((value as number) < spec.range[0] || (value as number) > spec.range[1]))
          problems.push(`${node}.${prop} = ${value} is outside ${spec.range[0]}–${spec.range[1]}`);
        else if (typeof spec.value === "string" && typeof value !== "string") problems.push(`${node}.${prop} takes words`);
        else if (typeof spec.value === "boolean" && typeof value !== "boolean") problems.push(`${node}.${prop} takes true or false`);
        else if (Array.isArray(spec.value) && !Array.isArray(value)) problems.push(`${node}.${prop} takes a list`);
        touched.set(node, (touched.get(node) ?? new Set()).add(prop));
      }
    }
  }
  if (!touched.size) problems.push("none of its kinds changes anything");
  if (n.resolve !== "ask" && n.resolve !== "switch") problems.push(`resolve is "${n.resolve}", not ask or switch`);
  if (!words(n.words)) problems.push("it has no words for what it decides");
  const names = new Set(kinds.map(([k]) => k));
  if (n.index && !(n.index.by === "tallness" && names.has(n.index.base))) problems.push("its index is not tallness with one of its kinds as the base");
  if (problems.length) return { problems };
  // The vocabulary: its own kinds, things on the stage. What fails is dropped, and said.
  const dropped: string[] = [];
  const say: Record<string, string[]> = {};
  for (const [kind, phrases] of Object.entries(n.say ?? {})) {
    if (!names.has(kind)) dropped.push(`it says "${kind}", which is not one of its kinds`);
    else if (!Array.isArray(phrases)) dropped.push(`what it says for "${kind}" is not a list`);
    else say[kind] = phrases.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim().toLowerCase().slice(0, 60)).slice(0, MAX_SAY);
  }
  const place = (x: unknown) => x === "self" || (typeof x === "string" && byId.has(x));
  const gestures: Record<string, Gesture[]> = {};
  for (const [kind, list] of Object.entries(n.gestures ?? {})) {
    if (!names.has(kind)) {
      dropped.push(`a gesture means "${kind}", which is not one of its kinds`);
      continue;
    }
    gestures[kind] = [];
    for (const g of Array.isArray(list) ? list : []) {
      const ok =
        g &&
        place(g.from) &&
        (g.dir === undefined || DIRS.has(g.dir)) &&
        (g.into === undefined || place(g.into)) &&
        (g.outOf === undefined || place(g.outOf)) &&
        (g.dir || g.into || g.outOf);
      if (ok) gestures[kind].push({ from: g.from, ...(g.dir ? { dir: g.dir } : {}), ...(g.into ? { into: g.into } : {}), ...(g.outOf ? { outOf: g.outOf } : {}) });
      else dropped.push(`a gesture for "${kind}" names nothing on the stage, or no way to go`);
    }
  }
  const whole: Record<string, KindNode> = {};
  for (const [name, k] of kinds) {
    const patch: Params = {};
    for (const [node, props] of touched) {
      patch[node] = {};
      for (const prop of props) patch[node][prop] = k.patch?.[node]?.[prop] ?? byId.get(node)!.params[prop].value;
    }
    whole[name] = { words: words(k.words)!, patch };
  }
  const prior = n.prior && typeof n.prior === "object" ? Object.fromEntries(Object.entries(n.prior).filter(([k, v]) => k in whole && typeof v === "number" && v >= 0)) : undefined;
  return {
    node: {
      type: n.type!,
      of: n.of!,
      words: words(n.words)!,
      kinds: whole,
      ...(prior && Object.keys(prior).length ? { prior } : {}),
      resolve: n.resolve!,
      ...(n.question && words(n.question) ? { question: words(n.question)! } : {}),
      ...(n.index ? { index: { by: "tallness" as const, base: n.index.base } } : {}),
      ...(Object.keys(say).length ? { say } : {}),
      ...(Object.values(gestures).some((g) => g.length) ? { gestures } : {}),
      from,
      ...(by ? { by } : {}),
    },
    ...(dropped.length ? { dropped } : {}),
  };
}

/**
 * A whole tree a model authored. Each intent is admitted or not on its own:
 * one that fails is left out (and said, in `dropped`), not the tree, as long
 * as any is let in. No two about the same thing.
 */
export function admitTree(raw: unknown, entities: Entity[], by?: string): { tree: Tree; dropped?: string[] } | { problems: string[] } {
  if (!Array.isArray(raw) || !raw.length) return { problems: ["no intents"] };
  const problems: string[] = [];
  const dropped: string[] = [];
  const tree: Tree = [];
  const seen = new Set<string>();
  raw.forEach((r, i) => {
    const out = admit(r, entities, { from: "preset", by });
    if ("problems" in out) problems.push(...out.problems.map((p) => `#${i}: ${p}`));
    else if (seen.has(keyOf(out.node))) problems.push(`#${i}: a second intent about ${keyOf(out.node)}`);
    else {
      seen.add(keyOf(out.node));
      tree.push(out.node);
      dropped.push(...(out.dropped ?? []).map((d) => `#${i}: ${d}`));
    }
  });
  if (!tree.length) return { problems };
  dropped.unshift(...problems.map((p) => `left out ${p}`));
  return { tree, ...(dropped.length ? { dropped } : {}) };
}

/** A node with one more phrase or gesture for a kind: what a short path learned from a model's answer. */
export function learn(node: IntentNode, kind: string, { phrase, gesture }: { phrase?: string; gesture?: Gesture }): IntentNode {
  const next = { ...node };
  if (phrase) {
    const p = phrase.trim().toLowerCase().slice(0, 60);
    const had = node.say?.[kind] ?? [];
    if (!had.includes(p)) next.say = { ...node.say, [kind]: [...had, p].slice(-MAX_SAY) };
  }
  if (gesture) {
    const had = node.gestures?.[kind] ?? [];
    if (!had.some((g) => JSON.stringify(g) === JSON.stringify(gesture))) next.gestures = { ...node.gestures, [kind]: [...had, gesture] };
  }
  return next;
}
