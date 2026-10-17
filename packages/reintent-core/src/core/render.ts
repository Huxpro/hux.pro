/* eslint-disable @typescript-eslint/no-explicit-any -- ported as written (Huxpro/airtalk#845) */
/**
 * Rendering: World = f(intents, context). `render` expands the components of an element tree in
 * one context and returns the host's tree, which the core never reads, and a trace of everything
 * about intents it met on the way, which is all the core says about a render.
 *
 *   render(el, source, { provide, overrides }) → { tree, trace }
 *   whatIf(el, source, overrides, opts)        the same render with some intents as if decided
 *   watch(source, run)                          run again when, and only when, what it read changed
 *
 * Inside a component:
 *   useIntent(name, { default, open, ask, kinds })  → T | Unresolved<T> | Unknown
 *   useCtx(Context)                                 → the context value in scope
 *   useKey()                                        → this component's key
 *
 * An intent's identity is its path: the nearest scope's id, the component's `Type:key`, and the
 * intent's name (`Slide:gallery/Row:g0,g1,g2#arrange`). Keys are unique within a scope, so a part
 * keeps its intents when it moves inside the scope; an unkeyed component is named by its position.
 * A component's name is its `displayName`, else its function name: paths are stored, so a build
 * that renames functions (a minifier) must keep names or the components must set displayName.
 */
import { contextOfProvider, type Context } from './context';
import {
  Fragment,
  hostKindOf,
  isElement,
  isHostNode,
  type Child,
  type Element,
  type Rendered,
} from './jsx';
import type { Source } from './source';
import {
  isGiven,
  sameKind,
  settle,
  UNKNOWN,
  type By,
  type Scope,
  type Dist,
  type Said,
  type Unknown,
  type Unresolved,
} from './value';

export type Read = {
  path: string;
  /** The intent's name (what a decision at the deck scope is about). */
  name: string;
  /** The contexts it was read in, by name: `{ Screen: 'phone-p' }`. */
  ctx: Record<string, string>;
  /** What the render went on: the value, or the fallback when unresolved. */
  value: unknown;
  by: By;
  /** For a person's decision: made about this intent, or about every intent of its name in the deck. */
  scope?: Scope;
  belief?: Dist;
  /** For a conditional belief: the case it was read under (paths read before it, and their values). */
  given?: Record<string, unknown>;
  not?: string[];
  ask?: boolean;
  open: boolean;
  /** The kinds it has here: the program's, then those a model learned. */
  kinds?: readonly unknown[];
  /** Kinds a model learned for it, as stored. */
  learned?: Record<string, unknown>;
  /** A person's value of a kind the program does not have now: kept, not applied. */
  waiting?: unknown;
  /** What the component says about the intent, for libraries (words, labels); the core never reads it. */
  about?: unknown;
};
export type Trace = { reads: Read[] };
export type Result = { tree: Rendered | Rendered[] | null; trace: Trace };

export type RenderOptions = {
  /** Context values in scope at the root (Providers inside the tree add more). */
  provide?: Array<[Context<any>, unknown]>;
  /** Intents as if a person had said these values: what `whatIf` renders. */
  overrides?: Record<string, Said<unknown>>;
};

/** While `watch` runs: every read of every render, to know what to re-run on. */
let collecting: Read[] | null = null;

type Frame = { id: string; key: string; scope: string; ctx: Map<Context<any>, unknown> };
type Run = { source: Source; overrides: Record<string, Said<unknown>>; reads: Read[]; frame: Frame | null };
let run: Run | null = null;

export function render(el: Child, source: Source, opts: RenderOptions = {}): Result {
  const prev = run;
  const me: Run = { source, overrides: opts.overrides ?? {}, reads: [], frame: null };
  run = me;
  try {
    const root: Frame = { id: '', key: '', scope: '', ctx: new Map(opts.provide ?? []) };
    const tree = expand(el, root, 0);
    collecting?.push(...me.reads);
    return { tree: tree as Result['tree'], trace: { reads: me.reads } };
  } finally {
    run = prev;
  }
}

export function whatIf(
  el: Child,
  source: Source,
  overrides: Record<string, Said<unknown>>,
  opts: RenderOptions = {},
): Result {
  return render(el, source, { ...opts, overrides: { ...opts.overrides, ...overrides } });
}

function expand(c: Child, parent: Frame, index: number): Rendered | Rendered[] | null {
  if (c == null || c === false || c === true) return null;
  if (typeof c === 'string' || typeof c === 'number') return c;
  if (Array.isArray(c)) return c.flatMap((x, i) => flat(expand(x, parent, i)));
  if (isHostNode(c)) return c;
  if (!isElement(c)) throw new Error(`not an element: ${String(c)}`);
  const el = c as Element;
  if (el.type === Fragment) return expand(el.props.children, parent, 0);
  const provided = contextOfProvider(el.type);
  if (provided) {
    const ctx = new Map(parent.ctx).set(provided, el.props.value);
    return expand(el.props.children, { ...parent, ctx }, 0);
  }
  const kind = hostKindOf(el.type);
  if (kind) {
    const children = flat(expand(el.props.children, parent, 0));
    return { $$host: true, kind, props: el.props, children };
  }
  const type = el.type as Exclude<Element['type'], typeof Fragment>;
  const seg = `${type.displayName || type.name || 'Anonymous'}:${el.key ?? index}`;
  const id = el.key !== undefined ? join(parent.scope, seg) : join(parent.id, seg);
  const frame: Frame = {
    id,
    key: el.key ?? String(index),
    scope: type.scope ? id : parent.scope,
    ctx: parent.ctx,
  };
  const r = run!;
  const outer = r.frame;
  r.frame = frame;
  let out: Child;
  try {
    out = type(el.props);
  } finally {
    r.frame = outer;
  }
  return expand(out, frame, 0);
}
const join = (a: string, b: string) => (a ? `${a}/${b}` : b);
const flat = (x: Rendered | Rendered[] | null): Rendered[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

function current(): { r: Run; f: Frame } {
  if (!run?.frame) throw new Error('hooks run only inside a component being rendered');
  return { r: run, f: run.frame };
}

export function useCtx<C>(context: Context<C>): C {
  const { f } = current();
  if (!f.ctx.has(context)) throw new Error(`no ${context.name} in scope`);
  return f.ctx.get(context) as C;
}

export function useKey(): string {
  return current().f.key;
}

export type IntentOptions<T> = {
  /** Code's value here: what is used when it is moot, and the fallback when unresolved. */
  default?: T;
  /** Whether there is anything to decide in this context (default true). */
  open?: boolean;
  /** When unresolved: ask a person (true), or act on the fallback and offer the rest (false). */
  ask?: boolean;
  /**
   * The kinds, for libraries that list alternatives. When given, they also bound what a person's
   * value can be: one outside them (a kind the program no longer has) waits instead of applying.
   * Kinds a model learned for the intent are added to them.
   */
  kinds?: readonly T[];
  /** Anything the component says about the intent, passed through to the read (labels, words). */
  about?: unknown;
};

export function useIntent<T>(name: string, opts: IntentOptions<T> = {}): T | Unresolved<T> | Unknown {
  const { r, f } = current();
  const path = `${f.id}#${name}`;
  const ctx = Object.fromEntries([...f.ctx].map(([c, v]) => [c.name, c.key(v)]));
  const open = opts.open ?? true;
  const entry = r.source.get(path);
  const learned = entry?.learned;
  const kinds = opts.kinds && [...opts.kinds, ...Object.keys(learned ?? {}).filter((k) => !opts.kinds!.includes(k as T))];
  const base = { path, name, ctx, open, ...(kinds && { kinds }), ...(learned && { learned }), ...(opts.about !== undefined && { about: opts.about }) };
  if (r.source.unknown(f.scope || f.id)) {
    r.reads.push({ ...base, value: undefined, by: 'unknown' });
    return UNKNOWN;
  }
  const axis = (spec: string) => {
    const [cname, aname] = spec.split('.');
    for (const [c, v] of f.ctx) if (c.name === cname && c.axes[aname]) return c.axes[aname](v);
    return undefined;
  };
  // A conditional belief: the case that holds for what this render has read so far.
  let model = entry?.model;
  let given: Record<string, unknown> | undefined;
  if (isGiven(model)) {
    const before = (p: string) => r.reads.findLast((x) => x.path === p);
    const c = model.$given.find((c) =>
      Object.entries(c.when).every(([p, v]) => {
        const b = before(p);
        return !!b && b.by !== 'unknown' && sameKind(b.value, v);
      }),
    );
    given = c?.when;
    model = c ? c.p : model.else;
  }
  const o = settle<T>({
    human: (path in r.overrides ? r.overrides[path] : entry?.human) as Said<T> | undefined,
    deck: r.source.deck(name) as Said<T> | undefined,
    model,
    code: opts.default,
    kinds,
    open,
    ask: opts.ask ?? false,
    axis,
  });
  const u = o.by === 'unresolved' ? (o.value as any) : null;
  r.reads.push({
    ...base,
    value: u ? u.fallback : o.value,
    by: o.by,
    ...(o.scope && { scope: o.scope }),
    ...(o.belief && { belief: o.belief }),
    ...(given && { given }),
    ...(u?.not && { not: u.not }),
    ...(u && { ask: u.ask }),
    ...(o.waiting !== undefined && { waiting: o.waiting }),
  });
  return o.value;
}

/** The path an intent of this component has (what a host keys its meaning by). */
export function usePath(name: string): string {
  return `${current().f.id}#${name}`;
}

/**
 * Re-render on change, the way a component re-renders: `run` renders (any number of times) and
 * returns what it returns; it runs again only when a write touches an intent one of its renders
 * read, a deck-wide decision of a name it read, or a scope it read inside.
 * → { value, runs, skipped, rerun, dispose }
 */
export function watch<R>(source: Source, fn: () => R) {
  let deps = { paths: new Set<string>(), names: new Set<string>() };
  const state = { value: undefined as R, runs: 0, skipped: 0 };
  const exec = () => {
    const seen: Read[] = [];
    const prev = collecting;
    collecting = seen;
    try {
      state.value = fn();
    } finally {
      collecting = prev;
    }
    deps = { paths: new Set(seen.map((r) => r.path)), names: new Set(seen.map((r) => r.name)) };
    state.runs++;
  };
  exec();
  const off = source.subscribe((c) => {
    const hit =
      (c.path && deps.paths.has(c.path)) ||
      (c.name && deps.names.has(c.name)) ||
      (c.scope && [...deps.paths].some((p) => p.startsWith(c.scope + '/') || p.startsWith(c.scope + '#')));
    if (hit) exec();
    else state.skipped++;
  });
  return {
    get value() {
      return state.value;
    },
    get runs() {
      return state.runs;
    },
    get skipped() {
      return state.skipped;
    },
    /** Something outside the intents changed (a cache it reads): run again. */
    rerun: exec,
    dispose: off,
  };
}
