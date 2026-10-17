// =============================================================================
// The root: a program, a doc and a context, and the loop over them.
//
//   const root = createRoot(PROGRAM);
//   root.get().values["man.hat"]        what a host reads
//   root.dispatch({ type: "narrow", key: "man.hat", pick: "absurd", from: "said" })
//   root.watch((s) => s.values["man.hat"]?.kind, render)
//
// Four things change what a host sees, and each is an action:
//
//   narrow / learn     a person, or a model's answer to a person's event
//   believe            a model, under the context it was asked in
//   context            something said of the whole, a viewer's leaning, focus
//   program            the program itself, rewritten: reconciled by key
//
// Every state is kept, so undo is a step back, and `preview` computes a state
// from actions without committing it (a proposal, a one-flip alternative).
// =============================================================================

import { believe, contextKey, EMPTY_DOC, learn, narrow, reconcile, type Context, type Doc, type Pick, type Reconciled } from "./doc";
import { questions, staleCells, values, type Value } from "./decide";
import type { Dist, Kind } from "./intent";
import type { Key, Program } from "./program";

export type Action =
  | { type: "narrow"; key: Key; pick: Pick | null; scope?: "here" | "all"; by?: string; from?: string }
  | { type: "believe"; key: Key; p: Dist; by?: string }
  | { type: "learn"; key: Key; name: string; kind: Kind<unknown> }
  | { type: "context"; ctx: Partial<Context> }
  | { type: "program"; program: Program }
  | { type: "batch"; actions: Action[] };

export interface State {
  program: Program;
  doc: Doc;
  ctx: Context;
}

export interface LogEntry {
  /** What happened, in a line: the host's note, or the action's own. */
  note: string;
  actions: Action[];
  /** What changed, cell by cell: `man.hat: big → absurd (person)`. */
  changes: string[];
  reconciled?: Omit<Reconciled, "doc">;
}

export interface Snapshot extends State {
  values: Record<Key, Value>;
  asks: Value[];
  stale: Value[];
  log: readonly LogEntry[];
  canUndo: boolean;
}

export function apply(s: State, a: Action, report?: (r: Reconciled) => void): State {
  switch (a.type) {
    case "narrow":
      return { ...s, doc: narrow(s.doc, a.key, a.pick, a) };
    case "believe":
      return { ...s, doc: believe(s.doc, a.key, a.p, { under: contextKey(s.ctx), by: a.by }) };
    case "learn":
      return { ...s, doc: learn(s.doc, a.key, a.name, a.kind) };
    case "context":
      return { ...s, ctx: { ...s.ctx, ...a.ctx } };
    case "program": {
      const r = reconcile(s.doc, a.program);
      report?.(r);
      return { ...s, program: a.program, doc: r.doc };
    }
    case "batch":
      return a.actions.reduce((t, b) => apply(t, b, report), s);
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
          : a.type === "program"
            ? `program → ${a.program.version ?? a.program.id}`
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
}

export function createRoot(program: Program, init: { doc?: Doc; ctx?: Context } = {}): Root {
  const first: State = { program, doc: init.doc ?? EMPTY_DOC, ctx: init.ctx ?? {} };
  let history: State[] = [first];
  let log: LogEntry[] = [];
  let snap: Snapshot;
  const subs = new Set<() => void>();

  const snapshotOf = (s: State, canUndo: boolean, l: readonly LogEntry[]): Snapshot => {
    const vals = values(s.program, s.doc, s.ctx);
    return { ...s, values: vals, asks: questions(vals), stale: staleCells(vals), log: l, canUndo };
  };
  const publish = () => {
    snap = snapshotOf(history[history.length - 1], history.length > 1, log);
    subs.forEach((fn) => fn());
  };
  snap = snapshotOf(first, false, log);

  return {
    get: () => snap,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    dispatch(action, note) {
      let reconciled: Reconciled | undefined;
      const next = apply(history[history.length - 1], action, (r) => (reconciled = r));
      const before = snap.values;
      history = [...history, next];
      const after = values(next.program, next.doc, next.ctx);
      const entry: LogEntry = { note: note ?? describe(action), actions: action.type === "batch" ? action.actions : [action], changes: diff(before, after) };
      if (reconciled) entry.reconciled = { kept: reconciled.kept, suspended: reconciled.suspended, restored: reconciled.restored };
      log = [entry, ...log];
      publish();
      return snap;
    },
    preview(actions) {
      return snapshotOf(actions.reduce((s, a) => apply(s, a), history[history.length - 1]), true, log);
    },
    watch(select, fn) {
      let seen = JSON.stringify(select(snap));
      return this.subscribe(() => {
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
  };
}
