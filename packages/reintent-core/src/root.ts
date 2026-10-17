// =============================================================================
// The root: the program the parts declared, a doc and a context, and the loop
// over them.
//
//   const root = createRoot({ id: "wardrobe" });
//   render(root, [Man, Wardrobe])          the parts run: they declare, and read
//   root.get().values["man.hat"]
//   root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd", from: "said" })
//
// Four things change what the parts see, and they re-run on each:
//
//   narrow / learn     a person, or a model's answer to a person's event
//   believe            a model, under the context it was asked in
//   context            something said of the whole, a viewer's leaning, focus
//   the program        a part declares otherwise (a model rewrote it, or an
//                      `if` went the other way): on `flush`, the doc is
//                      reconciled by path against it
//
// A part runs inside a `frame`: each `useIntent` registers its declaration
// and reads its value. A cell another part has not declared yet reads as
// nothing; the flush after the run publishes the program, and whoever read it
// runs again (the second pass).
//
// Every state of the doc is kept, so undo is a step back (the program is code:
// undo does not unwrite it), and `preview` computes a state without making it.
// =============================================================================

import { believe, contextKey, EMPTY_DOC, learn, narrow, reconcile, type Context, type Doc, type Pick } from "./doc";
import { questions, staleCells, values, type Value } from "./decide";
import type { Dist, Kind } from "./intent";
import { check, signature, type IntentDecl, type Key, type Program } from "./program";

export type Action =
  | { type: "narrow"; key: Key; pick: Pick | null; scope?: "here" | "all"; by?: string; from?: string }
  | { type: "believe"; key: Key; p: Dist; by?: string }
  | { type: "learn"; key: Key; name: string; kind: Kind<unknown> }
  | { type: "context"; ctx: Partial<Context> }
  | { type: "batch"; actions: Action[] };

export interface State {
  doc: Doc;
  ctx: Context;
}

export interface ProgramChange {
  added: Key[];
  removed: Key[];
  kept: Key[];
  suspended: Key[];
  restored: Key[];
}

export interface LogEntry {
  /** What happened, in a line: the host's note, or the action's own. */
  note: string;
  actions: Action[];
  /** What changed, cell by cell: `man.hat: big → absurd (person)`. */
  changes: string[];
  /** The program changed: cells added and removed, and what the doc's decisions did. */
  program?: ProgramChange;
}

export interface Snapshot extends State {
  program: Program;
  values: Record<Key, Value>;
  asks: Value[];
  stale: Value[];
  log: readonly LogEntry[];
  canUndo: boolean;
}

/** A part at run: where its hooks register and read. */
export interface Frame {
  intent<K extends string, D>(decl: IntentDecl<K, D>): Value<K, D>;
  /** Another cell's value now (undefined: not declared yet). */
  value(key: Key): Value | undefined;
  values(): Record<Key, Value>;
  /** The run is over: intents it did not declare this time are gone. */
  end(): void;
}

export interface ThingInfo {
  id: string;
  label?: string;
  aka?: readonly string[];
}

export function apply(s: State, a: Action): State {
  switch (a.type) {
    case "narrow":
      return { ...s, doc: narrow(s.doc, a.key, a.pick, a) };
    case "believe":
      return { ...s, doc: believe(s.doc, a.key, a.p, { under: contextKey(s.ctx), by: a.by }) };
    case "learn":
      return { ...s, doc: learn(s.doc, a.key, a.name, a.kind) };
    case "context":
      return { ...s, ctx: { ...s.ctx, ...a.ctx } };
    case "batch":
      return a.actions.reduce(apply, s);
  }
}

const describe = (a: Action): string =>
  a.type === "narrow"
    ? `${a.key} ${a.pick === null ? "forgotten" : typeof a.pick === "string" ? `= ${a.pick}` : `≠ ${a.pick.not.join(", ")}`}${a.scope === "all" ? " (everywhere)" : ""}`
    : a.type === "believe"
      ? `${a.key} believed`
      : a.type === "learn"
        ? `${a.key} learned ${a.name}`
        : a.type === "context"
          ? `context`
          : a.actions.map(describe).join(" · ");

function diff(before: Record<Key, Value>, after: Record<Key, Value>): string[] {
  const out: string[] = [];
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[k];
    const b = after[k];
    if (!b) out.push(`${k}: ${a.kind} → (gone)`);
    else if (!a) out.push(`${k}: (new) → ${b.kind} (${b.source})`);
    else if (a.kind !== b.kind || a.source !== b.source) out.push(`${k}: ${a.kind} → ${b.kind} (${b.source})`);
  }
  return out;
}

export interface Root {
  get(): Snapshot;
  subscribe(fn: () => void): () => void;
  dispatch(action: Action, note?: string): Snapshot;
  /** The snapshot these actions would make, without making it. */
  preview(actions: Action[]): Snapshot;
  /** fn runs when what `select` reads changes (compared as JSON); returns how to stop it. */
  watch<T>(select: (s: Snapshot) => T, fn: (value: T) => void): () => void;
  undo(): void;
  reset(): void;
  // The parts' side.
  frame(thing: ThingInfo): Frame;
  /** After a run: a program that changed is reconciled, logged and published. */
  flush(note?: string): void;
  /** A part mounted (a host's binding): counted, so a thing drawn twice is one thing. */
  keep(id: string): void;
  /** A part unmounted: when the last of it is gone, its cells go once the commit is over, unless it ran or mounted again. */
  drop(id: string): void;
}

interface Entry {
  info: ThingInfo;
  intents: Map<string, IntentDecl<string, unknown>>;
  /** Each intent's declaration as text, to tell a rewrite from a re-run. */
  sigs: Map<string, string>;
}

const declSig = (d: IntentDecl<string, unknown>) => signature({ id: "", things: [{ id: "", aka: [], intents: [d] }] });

export function createRoot(init: { id?: string; doc?: Doc; ctx?: Context } = {}): Root {
  const id = init.id ?? "program";
  const first: State = { doc: init.doc ?? EMPTY_DOC, ctx: init.ctx ?? {} };
  let history: State[] = [first];
  let log: LogEntry[] = [];
  const things = new Map<string, Entry>();
  const dropped = new Set<string>();
  const mounts = new Map<string, number>();
  let rev = 0;
  let published = { sig: signature({ id, things: [] }), program: { id, things: [] } as Program };
  const subs = new Set<() => void>();

  const state = () => history[history.length - 1];
  let programMemo = { rev: -1, program: published.program };
  const program = (): Program => {
    if (programMemo.rev !== rev)
      programMemo = {
        rev,
        program: { id, things: [...things.values()].map((e) => ({ id: e.info.id, label: e.info.label, aka: e.info.aka ?? [], intents: [...e.intents.values()] })) },
      };
    return programMemo.program;
  };
  let liveMemo: { rev: number; state: State; values: Record<Key, Value> } | null = null;
  const live = () => {
    const s = state();
    if (!liveMemo || liveMemo.rev !== rev || liveMemo.state !== s) liveMemo = { rev, state: s, values: values(program(), s.doc, s.ctx) };
    return liveMemo.values;
  };

  const snapshotOf = (s: State, p: Program, canUndo: boolean): Snapshot => {
    const vals = values(p, s.doc, s.ctx);
    return { ...s, program: p, values: vals, asks: questions(vals), stale: staleCells(vals), log, canUndo };
  };
  let snap = snapshotOf(first, published.program, false);
  const publish = () => {
    snap = snapshotOf(state(), program(), history.length > 1);
    subs.forEach((fn) => fn());
  };

  const root: Root = {
    get: () => snap,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    dispatch(action, note) {
      const before = snap.values;
      history = [...history, apply(state(), action)];
      const after = live();
      log = [{ note: note ?? describe(action), actions: action.type === "batch" ? action.actions : [action], changes: diff(before, after) }, ...log];
      publish();
      return snap;
    },
    preview(actions) {
      return snapshotOf(actions.reduce(apply, state()), program(), true);
    },
    watch(select, fn) {
      let seen = JSON.stringify(select(snap));
      return root.subscribe(() => {
        const v = select(snap);
        const json = JSON.stringify(v);
        if (json !== seen) {
          seen = json;
          fn(v);
        }
      });
    },
    undo() {
      if (history.length < 2) return;
      history = history.slice(0, -1);
      log = [{ note: "undo", actions: [], changes: [] }, ...log];
      publish();
    },
    reset() {
      history = [first];
      log = [];
      publish();
    },

    frame(info) {
      dropped.delete(info.id);
      let e = things.get(info.id);
      if (!e) {
        e = { info, intents: new Map(), sigs: new Map() };
        things.set(info.id, e);
        rev++;
      }
      const entry = e;
      const seen = new Set<string>();
      return {
        intent<K extends string, D>(decl: IntentDecl<K, D>) {
          const d = decl as unknown as IntentDecl<string, unknown>;
          const key = `${info.id}.${d.name}`;
          if (seen.has(d.name)) throw new Error(`reintent: ${key} declared twice in one run`);
          const problems = check(key, d);
          if (problems.length) throw new Error(`reintent: ${problems.join("; ")}`);
          seen.add(d.name);
          const sig = declSig(d);
          // A re-run brings a fresh closure every time: kept quietly. A rewrite is a new program.
          if (entry.sigs.get(d.name) !== sig) {
            entry.sigs.set(d.name, sig);
            rev++;
          }
          entry.intents.set(d.name, d);
          return live()[key] as Value<K, D>;
        },
        value: (key) => live()[key],
        values: live,
        end() {
          for (const name of [...entry.intents.keys()])
            if (!seen.has(name)) {
              entry.intents.delete(name);
              entry.sigs.delete(name);
              rev++;
            }
        },
      };
    },

    flush(note) {
      const p = program();
      const sig = signature(p);
      if (sig === published.sig) return;
      const before = snap.values;
      const r = reconcile(state().doc, p);
      if (r.doc !== state().doc && (r.suspended.length || r.restored.length)) history = [...history, { ...state(), doc: r.doc }];
      const keysOf = (q: Program) => new Set(q.things.flatMap((t) => t.intents.map((i) => `${t.id}.${i.name}`)));
      const was = keysOf(published.program);
      const now = keysOf(p);
      const change: ProgramChange = {
        added: [...now].filter((k) => !was.has(k)),
        removed: [...was].filter((k) => !now.has(k)),
        kept: r.kept,
        suspended: r.suspended,
        restored: r.restored,
      };
      published = { sig, program: p };
      log = [{ note: note ?? `program: ${now.size} cells`, actions: [], changes: diff(before, live()), program: change }, ...log];
      publish();
    },
    // Mounts are counted: a thing drawn twice (him in the wardrobe, him at the bed) is one thing,
    // gone only when the last of it is.
    // A drop is swept after the commit it happened in, not at the next flush: in one commit a
    // child's flush can run before its parent's remount (a version switched under both).
    drop(tid) {
      const n = (mounts.get(tid) ?? 1) - 1;
      mounts.set(tid, n);
      if (n > 0) return;
      dropped.add(tid);
      queueMicrotask(() => {
        if (!dropped.delete(tid)) return;
        if (things.delete(tid)) rev++;
        root.flush();
      });
    },
    keep(tid) {
      mounts.set(tid, (mounts.get(tid) ?? 0) + 1);
      dropped.delete(tid);
    },
  };
  return root;
}
