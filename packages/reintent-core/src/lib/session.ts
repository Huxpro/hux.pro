/**
 * A session: the loop a host runs around the core, and what an inspector drives (the Lab's
 * /lab/reintent reads it off `window.__reintent`). Built only on the core's public entry.
 *
 *   the program    one of a few versions (a model's rewrites): an element, and the beliefs the
 *                  model wrote with it, kept in the source as the model's
 *   the source     what people and the model said, by path
 *   the render     watch(source, () => render(program, source)): a value, rendered again when a
 *                  write touches what it read, or when the program or the context changes
 *   the history    the source as it was before each step: undo is going back to it (the core has
 *                  no undo; this is the host's). A program change starts the history over: the
 *                  program is code, and undo does not unwrite it
 *
 *   the worlds     the likeliest whole choice maps (lib/worlds), next to the one the render
 *                  settled cell by cell: choosing one is a person writing its choices
 *
 * A model stands behind two of its doors (`Model`): a kind more past the end of a scale, and
 * beliefs again when something is said of the whole. Without one, both are reported, not done.
 */
import {
  createSource,
  render,
  watch,
  type Belief,
  type Child,
  type Read,
  type RenderOptions,
  type Result,
  type WritableSource,
} from '../core/index';
import { changes, diff, type ProgramChange } from './changes';
import { observe } from './observe';
import type { KindAbout } from './vocab';
import { worlds, type World } from './worlds';
import { recognize, said, type Need, type Reading, type Recognized } from './words';

export interface ProgramFile {
  file: string;
  source: string;
}

export interface Version {
  id: string;
  /** What this version is, in a line. */
  note: string;
  program: Child;
  /** The model's beliefs as it wrote this version, by path. */
  beliefs?: Record<string, Belief>;
  /** Its source as written: what a model reads and rewrites. */
  files?: ProgramFile[];
}

export interface Model {
  /** A kind past the end of an ordered intent, for a person who asked for more. */
  extend?(need: Extract<Need, { kind: 'extend' }>, read: Read): { kind: string; about: KindAbout } | null;
  /**
   * Beliefs again, under what has been said of the whole (`said`), for the intents read. `stored`
   * is what it believed before (a conditional belief is more than the case a read went on).
   */
  rebelieve?(reads: readonly Read[], said: readonly string[], stored: (path: string) => Belief | undefined): Record<string, Belief>;
  /** Who it is, for the log ("model:stand-in"). */
  name: string;
}

export interface LogEntry {
  note: string;
  changes: string[];
  program?: ProgramChange;
}

export interface SessionSnapshot {
  result: Result;
  reads: Read[];
  decided: string[];
  /** Questions now: unresolved intents that ask. */
  asks: Read[];
  /** Intents resting on a belief the model wrote before the last thing said of the whole. */
  stale: string[];
  said: string[];
  log: LogEntry[];
  canUndo: boolean;
  versions: Omit<Version, 'program' | 'beliefs'>[];
  current: string;
  source: ReturnType<WritableSource['snapshot']>;
  /** The likeliest worlds; `now` marks the one the render settled on, when it is one of them. */
  worlds: (Omit<World, 'result'> & { now: boolean })[];
}

/** What a sentence came to: its reading, and what was done about it. */
export type Said = Recognized & { done: string };

export interface Session {
  get(): SessionSnapshot;
  subscribe(fn: () => void): () => void;
  decide(path: string, value: unknown, note?: string): void;
  ruleOut(path: string, kind: string): void;
  forget(path: string): void;
  say(text: string): Said;
  answer(reading: Reading): void;
  use(id: string): void;
  /** Choose a world: a person writes its choices. */
  choose(choices: Record<string, string>): void;
  undo(): void;
  reset(): void;
  observe(): string;
  readonly source: WritableSource;
}

type Kept = { source: ReturnType<WritableSource['snapshot']>; said: string[]; under: Record<string, string> };

export function createSession(o: {
  versions: Version[];
  model?: Model;
  render?: RenderOptions;
  /** Which worlds to show: how many, and over which choices (the rest summed out). */
  worlds?: { k?: number; only?: (r: Read) => boolean };
}): Session {
  const source = createSource();
  const byId = (id: string) => o.versions.find((v) => v.id === id)!;
  let current = o.versions[0].id;
  let whole: string[] = [];
  // The context each belief was written under (what had been said of the whole).
  let under: Record<string, string> = {};
  let log: LogEntry[] = [];
  const key = () => whole.join('\n');

  const writeBeliefs = (next: Version, prev?: Version) =>
    source.batch(() => {
      for (const p of Object.keys(prev?.beliefs ?? {})) if (!next.beliefs?.[p]) source.write(p, 'model', undefined);
      for (const [p, dist] of Object.entries(next.beliefs ?? {})) {
        source.write(p, 'model', dist);
        under[p] = '';
      }
    });
  writeBeliefs(byId(current));

  const w = watch(source, () => render(byId(current).program, source, o.render));
  let history: Kept[] = [];
  const first = (): Kept => ({ source: source.snapshot(), said: [...whole], under: { ...under } });
  let start = first();

  const subs = new Set<() => void>();
  let snap: SessionSnapshot;
  const build = (): SessionSnapshot => {
    const result = w.value;
    const reads = result.trace.reads;
    const decided = source.decided();
    const k = key();
    const stale = [
      ...new Set(reads.filter((r) => r.by !== 'human' && source.get(r.path)?.model !== undefined && (under[r.path] ?? '') !== k).map((r) => r.path)),
    ];
    const now = (c: Record<string, string>) => Object.entries(c).every(([p, k]) => reads.some((r) => r.path === p && r.value === k));
    const ws = worlds(byId(current).program, source, { ...o.render, ...o.worlds }).map(({ choices, p }) => ({ choices, p, now: now(choices) }));
    return {
      result,
      reads,
      worlds: ws,
      decided,
      asks: reads.filter((r) => r.by === 'unresolved' && r.ask).filter((r, i, a) => a.findIndex((x) => x.path === r.path) === i),
      stale,
      said: [...whole],
      log,
      canUndo: history.length > 0,
      versions: o.versions.map(({ id, note, files }) => ({ id, note, files })),
      current,
      source: source.snapshot(),
    };
  };
  const publish = () => {
    snap = build();
    subs.forEach((f) => f());
  };
  snap = build();
  // After watch has rendered again (it subscribed first), publish what it rendered.
  source.subscribe(() => publish());

  /** One step: kept for undo, done, rendered, logged. */
  const step = (note: string, fn: () => void) => {
    const before = w.value.trace.reads;
    history = [...history, { source: source.snapshot(), said: [...whole], under: { ...under } }];
    const saidBefore = key();
    source.batch(fn);
    if (key() !== saidBefore) w.rerun();
    log = [{ note, changes: diff(before, w.value.trace.reads) }, ...log];
    publish();
  };

  const restore = (k: Kept) => {
    source.batch(() => {
      const now = source.snapshot();
      for (const p of Object.keys(now.entries))
        if (!k.source.entries[p]) {
          source.write(p, 'human', undefined);
          source.write(p, 'model', undefined);
          for (const kind of Object.keys(now.entries[p].learned ?? {})) source.learn(p, kind, undefined);
        }
      for (const [p, e] of Object.entries(k.source.entries)) {
        source.write(p, 'human', e.human);
        source.write(p, 'model', e.model);
        const had = now.entries[p]?.learned ?? {};
        for (const kind of Object.keys(had)) if (!e.learned?.[kind]) source.learn(p, kind, undefined);
        for (const [kind, about] of Object.entries(e.learned ?? {})) source.learn(p, kind, about);
      }
      for (const n of Object.keys(now.deck)) if (!(n in k.source.deck)) source.write(n, 'human', undefined, { scope: 'deck' });
      for (const [n, v] of Object.entries(k.source.deck)) source.write(n, 'human', v, { scope: 'deck' });
    });
    whole = [...k.said];
    under = { ...k.under };
    w.rerun();
  };

  const readOf = (path: string) => w.value.trace.reads.find((r) => r.path === path);

  const session: Session = {
    source,
    get: () => snap,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    decide: (path, value, note) => step(note ?? `${path} = ${JSON.stringify(value)}`, () => source.write(path, 'human', value)),
    ruleOut(path, kind) {
      const prev = source.get(path)?.human as { $not?: string[] } | undefined;
      const not = [...new Set([...(prev && typeof prev === 'object' && prev.$not ? prev.$not : []), kind])];
      step(`${path} ≠ ${kind}`, () => source.write(path, 'human', { $not: not }));
    },
    forget: (path) => step(`${path} forgotten`, () => source.write(path, 'human', undefined)),
    answer: (r) => step(`answered: ${r.path} = ${r.kind}`, () => source.write(r.path, 'human', said(r))),
    say(text) {
      const r = recognize(text, w.value.trace.reads);
      switch (r.outcome) {
        case 'resolve':
          step(`“${text}” → ${r.reading.path} ${r.reading.not ? '≠' : '='} ${r.reading.kind}`, () => source.write(r.reading.path, 'human', said(r.reading)));
          return { ...r, done: 'resolved: a person’s decision, no model' };
        case 'ask':
          return { ...r, done: 'more than one reading: asking' };
        case 'context': {
          if (!o.model?.rebelieve) {
            step(`“${text}”, said of the whole`, () => (whole = [...whole, text]));
            return { ...r, done: 'said of the whole; no model to believe again' };
          }
          let n = 0;
          step(`“${text}”, said of the whole → ${o.model.name} believes again`, () => {
            whole = [...whole, text];
            const k = key();
            const beliefs = o.model!.rebelieve!(w.value.trace.reads, whole, (p) => source.get(p)?.model);
            for (const [p, dist] of Object.entries(beliefs)) {
              source.write(p, 'model', dist);
              under[p] = k;
              n++;
            }
          });
          return { ...r, done: `said of the whole: ${n} beliefs again` };
        }
        case 'infer': {
          const read = r.need.kind === 'extend' ? readOf(r.need.path) : undefined;
          const learned = r.need.kind === 'extend' && read && o.model?.extend ? o.model.extend(r.need, read) : null;
          if (learned && r.need.kind === 'extend') {
            const path = r.need.path;
            step(`“${text}” → ${o.model!.name} learned a kind past the end of ${path}`, () => {
              source.learn(path, learned.kind, learned.about);
              source.write(path, 'human', learned.kind);
            });
            return { ...r, done: 'past the end: a model learned a kind more, and it is yours' };
          }
          return { ...r, done: 'nothing in the program can say this: it would go to a model' };
        }
      }
    },
    use(id) {
      if (id === current || !o.versions.some((v) => v.id === id)) return;
      const before = w.value.trace.reads;
      const prev = byId(current);
      current = id;
      writeBeliefs(byId(id), prev);
      w.rerun();
      const after = w.value.trace.reads;
      log = [{ note: `program → ${id} (${byId(id).note})`, changes: diff(before, after), program: changes(before, after, source.decided()) }, ...log];
      // The program is code: undo does not unwrite it, so the history starts over here.
      history = [];
      start = first();
      publish();
    },
    choose: (choices) =>
      step(`world: ${Object.entries(choices).map(([p, k]) => `${p} = ${k}`).join(', ')}`, () => {
        for (const [p, k] of Object.entries(choices)) source.write(p, 'human', k);
      }),
    undo() {
      const k = history[history.length - 1];
      if (!k) return;
      const before = w.value.trace.reads;
      history = history.slice(0, -1);
      restore(k);
      log = [{ note: 'undo', changes: diff(before, w.value.trace.reads) }, ...log];
      publish();
    },
    reset() {
      restore(start);
      history = [];
      log = [];
      publish();
    },
    observe: () => observe(w.value.trace.reads, whole),
  };
  return session;
}


/** Where a host lays its session open to an inspector in another frame (same origin). */
declare global {
  interface Window {
    __reintent?: Session;
  }
}
