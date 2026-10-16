import { space } from "reintent";
import type { Params } from "stage";

// =============================================================================
// The intent tree: the state, and nothing but data.
//
// Each node is one intent about one thing on the stage: a closed set of
// kinds, each with the props it sets (its patch). A preset tree is written by
// hand; a model may add a node, or write a whole new tree, in the same shape,
// and it is checked before it is let in. reintent decides each node per
// context (a person > their preference > a model sure enough > code); compile
// merges the chosen kinds' patches into the scene's props.
//
//   tree ──▶ typesOf ──▶ reintent ──▶ one kind per node, per screen ──▶ compile ──▶ props
// =============================================================================

export type Words = { en: string; zh: string };

export interface KindNode {
  words: Words;
  /** The props this kind sets, by node id. Every kind of a node sets the same props, so switching always undoes. */
  patch: Params;
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
  /** Who wrote it. */
  from: "preset" | "model";
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

/**
 * A node a model wrote, made whole (kinds that leave a prop out get the
 * value the scene wrote, so switching back undoes) and checked: what it is
 * about exists, its kinds are a closed set of two to four, every patch is a
 * knob that exists, in its range. Returns the node, or why not.
 */
export function admit(raw: unknown, entities: Entity[]): { node: IntentNode } | { problems: string[] } {
  const problems: string[] = [];
  const n = raw as Partial<IntentNode> | null;
  if (!n || typeof n !== "object") return { problems: ["not an intent node"] };
  const byId = new Map(entities.map((e) => [e.id, e]));
  if (typeof n.type !== "string" || !NAME.test(n.type)) problems.push(`type "${n.type}" is not a short name`);
  const [ofId, member] = String(n.of ?? "").split("#");
  const of = byId.get(ofId);
  if (!of) problems.push(`"${n.of}" is not on the stage`);
  else if (member !== undefined && !(of.members && Number(member) >= 0 && Number(member) < of.members.length)) problems.push(`"${n.of}" is not one of its members`);
  const words = (w: unknown): Words | null =>
    w && typeof w === "object" && typeof (w as Words).en === "string"
      ? { en: (w as Words).en.slice(0, 80), zh: typeof (w as Words).zh === "string" ? (w as Words).zh.slice(0, 80) : (w as Words).en.slice(0, 80) }
      : null;
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
        else if (Array.isArray(spec.value) && !Array.isArray(value)) problems.push(`${node}.${prop} takes a list`);
        touched.set(node, (touched.get(node) ?? new Set()).add(prop));
      }
    }
  }
  if (!touched.size) problems.push("none of its kinds changes anything");
  if (n.resolve !== "ask" && n.resolve !== "switch") problems.push(`resolve is "${n.resolve}", not ask or switch`);
  if (!words(n.words)) problems.push("it has no words for what it decides");
  if (problems.length) return { problems };
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
      from: "model",
    },
  };
}
