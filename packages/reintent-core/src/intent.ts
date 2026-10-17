// =============================================================================
// Intent types: a closed set of kinds, each with the words that say it and
// what it means (its data). The sum type an engineer, or a model, declares.
//
//   const Size = intent({
//     usual:  { words: ["寻常", "正常"], hatScale: 1 },
//     big:    { words: ["大很多"],      hatScale: 1.45 },
//     absurd: { words: ["大得离谱"],    hatScale: 1.95 },
//   }, { ordered: true });
//
//   KindOf<typeof Size>   "usual" | "big" | "absurd"
//   DataOf<typeof Size>   { hatScale: number }
//
// Closed when it is written, open over time: a model may learn a kind more
// (Doc.learned), which carries data of the same shape, so code that reads
// `value.data` holds for it too.
// =============================================================================

export type Dist = Record<string, number>;

/** A kind as written: the words that say it, a label, and anything else is its data. */
export type KindSpec = { readonly words?: readonly string[]; readonly label?: string } & Record<string, unknown>;

export interface Kind<D = Record<string, unknown>> {
  label: string;
  /** Words that name this kind ("大得离谱"): what a recognizer matches, and what a model reads. */
  words: readonly string[];
  /** What it means, in the host's terms. */
  data: D;
  /** Learned after the program was written, and from whom. */
  learned?: string;
}

export interface IntentType<K extends string = string, D = unknown> {
  readonly kinds: { readonly [k in K]: Kind<D> };
  /** The kinds in their written order: an ordered intent's "more" goes right. */
  readonly order: readonly K[];
  readonly ordered: boolean;
  /** Words for "further along" and "back" on an ordered intent. */
  readonly more: readonly string[];
  readonly less: readonly string[];
}

type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T extends readonly unknown[]
        ? { readonly [i in keyof T]: Widen<T[i]> }
        : T extends object
          ? { -readonly [k in keyof T]: Widen<T[k]> }
          : T;

type Data<S> = { [k in keyof S]: Widen<Omit<S[k], "words" | "label">> }[keyof S];

export type KindOf<T> = T extends IntentType<infer K, unknown> ? K : never;
export type DataOf<T> = T extends IntentType<string, infer D> ? D : never;

/** The words for a step along any ordered intent that names none of its own. */
export const MORE: readonly string[] = ["大一点", "更大", "再大", "还要大", "bigger", "more"];
export const LESS: readonly string[] = ["小一点", "更小", "再小", "smaller", "less"];

export function intent<S extends Record<string, KindSpec>>(
  spec: S,
  opts: { ordered?: boolean; more?: readonly string[]; less?: readonly string[] } = {},
): IntentType<keyof S & string, Data<S>> {
  const kinds = {} as Record<string, Kind<Data<S>>>;
  for (const [name, { words = [], label, ...data }] of Object.entries(spec))
    kinds[name] = { label: label ?? words[0] ?? name, words, data: data as Data<S> };
  return {
    kinds: kinds as IntentType<keyof S & string, Data<S>>["kinds"],
    order: Object.keys(spec) as (keyof S & string)[],
    ordered: !!opts.ordered,
    more: opts.more ?? MORE,
    less: opts.less ?? LESS,
  };
}

export const margin = (p: Dist) => {
  const v = Object.values(p).sort((a, b) => b - a);
  return v.length < 2 ? 1 : v[0] - v[1];
};

export const argmax = (p: Dist): string | undefined => Object.entries(p).sort((a, b) => b[1] - a[1])[0]?.[0];

export function normalize(p: Partial<Dist>, kinds: readonly string[]): Dist {
  const s = kinds.reduce((a, k) => a + (p[k] ?? 0), 0);
  return Object.fromEntries(kinds.map((k) => [k, s ? (p[k] ?? 0) / s : 1 / kinds.length]));
}
