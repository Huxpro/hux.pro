/**
 * A vocabulary for an intent: its kinds, the words that say each, and what each means to the host
 * (its data). The core needs none of it (kinds are TypeScript types there); the libraries that
 * talk with a person or a model do: a sentence is read against the words, a learned kind carries
 * data of the same shape, a model is shown the labels.
 *
 *   const Size = vocab({
 *     usual:  { label: "寻常", words: ["正常"], hatScale: 1 },
 *     absurd: { label: "大得离谱", words: ["离谱"], hatScale: 1.95 },
 *   }, { ordered: true });
 *
 *   // in an intent component (a read by name, not a React hook: it may sit under an `if`):
 *   const hat = Size.read("hat", { thing: MAN, label: "帽子有多大", aka: ["帽子"], default: "absurd", ask: true });
 *   hat.kind   // what to go on: the value, or code's fallback while unresolved
 *   hat.path   // the intent's path, which a host keys the meaning by
 *
 *   // in the host, from a render's trace:
 *   meaning(reads, hat)   // { hatScale: 1.95 }, a learned kind's data included
 */
import { isUnresolved, UNKNOWN, useChoice, usePath, type Read, type Unknown, type Unresolved } from '../core/index';

export type KindSpec = { label?: string; words?: readonly string[] } & Record<string, unknown>;

export interface KindAbout<D = unknown> {
  label: string;
  words: readonly string[];
  data: D;
  /** Who learned it, for a kind a model added. */
  learned?: string;
}

/** What `Read.about` holds for an intent declared through a vocabulary. */
export interface About {
  label?: string;
  /** Words that name the intent itself ("帽子"). */
  aka: readonly string[];
  /** The thing it is an intent of, and its words ("他"). */
  thing?: { label?: string; aka: readonly string[] };
  kinds: Record<string, KindAbout>;
  ordered: boolean;
  /** Words for a step along an ordered intent. */
  more: readonly string[];
  less: readonly string[];
}

/** The words for a step along any ordered intent that names none of its own. */
export const MORE: readonly string[] = ['大一点', '更大', '再大', '还要大', 'bigger', 'more'];
export const LESS: readonly string[] = ['小一点', '更小', '再小', 'smaller', 'less'];

type Data<S> = { [k in keyof S]: Omit<S[k], 'words' | 'label'> }[keyof S];

export interface Reading<K extends string> {
  value: K | Unresolved<K> | Unknown;
  /** What to go on: the value, or code's fallback while nobody sure has decided. */
  kind: K;
  path: string;
}

export interface Vocab<K extends string, D> {
  kinds: readonly K[];
  table: Record<K, KindAbout<D>>;
  ordered: boolean;
  more: readonly string[];
  less: readonly string[];
  /**
   * Read the intent `name` of this component, with this vocabulary: a value, known by its path,
   * so it may sit under an `if` (it is not a React hook, and not named like one).
   */
  read(
    name: string,
    opts: { default: K; ask?: boolean; open?: boolean; label?: string; aka?: readonly string[]; thing?: About['thing'] },
  ): Reading<K>;
}

export function vocab<S extends Record<string, KindSpec>>(
  spec: S,
  opts: { ordered?: boolean; more?: readonly string[]; less?: readonly string[] } = {},
): Vocab<keyof S & string, Data<S>> {
  type K = keyof S & string;
  const table = {} as Record<K, KindAbout<Data<S>>>;
  for (const [k, { label, words = [], ...data }] of Object.entries(spec))
    table[k as K] = { label: label ?? words[0] ?? k, words, data: data as Data<S> };
  const kinds = Object.keys(spec) as K[];
  const more = opts.more ?? MORE;
  const less = opts.less ?? LESS;
  const ordered = !!opts.ordered;
  return {
    kinds,
    table,
    ordered,
    more,
    less,
    read(name, o) {
      const about: About = { label: o.label, aka: o.aka ?? [], thing: o.thing, kinds: table, ordered, more, less };
      const value = useChoice<K>(name, { default: o.default, ask: o.ask, open: o.open, kinds, about });
      return { value, kind: shown(value, o.default), path: usePath(name) };
    },
  };
}

/** What to go on: the value, or the fallback while unresolved (or unknown). */
export function shown<T>(v: T | Unresolved<T> | Unknown, otherwise: T): T {
  if (v === UNKNOWN) return otherwise;
  if (isUnresolved<T>(v)) return v.fallback ?? otherwise;
  return v as T;
}

/** A kind of an intent as its read knows it: the vocabulary's, or one a model learned. */
export function kindAbout(r: Read, kind: unknown): KindAbout | undefined {
  const about = r.about as About | undefined;
  return about?.kinds[String(kind)] ?? (r.learned?.[String(kind)] as KindAbout | undefined);
}

/** What the intent at `ref.path` means now: its kind's data, a learned kind's included. */
export function meaning<D = Record<string, unknown>>(reads: readonly Read[], ref: { path: string; kind?: unknown }): D | undefined {
  const r = reads.find((x) => x.path === ref.path);
  return r ? (kindAbout(r, ref.kind ?? r.value)?.data as D | undefined) : undefined;
}

/** A label in a reader's language, from a bilingual one ("床头 · the bed's head"). */
export const half = (label: string | undefined, locale: 'zh' | 'en', fallback = '') => {
  if (!label) return fallback;
  const [zh, en] = label.split(' · ');
  return (locale === 'zh' ? zh : en) ?? label;
};
