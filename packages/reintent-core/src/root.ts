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
//   the program        a part declares otherwise (a model rewrote it, an `if`
//                      went the other way, it unmounted): on the flush, the
//                      doc is reconciled by path against it
//
// Reading and declaring are apart, as rendering and committing are:
//
//   evaluate(thing, decl, scope)   what a declaration's cell is now. Pure: a
//                                  host renders with it, and may throw the
//                                  render away
//   hold(holder, thing, decls)     these are declared now (a mounted part, a
//                                  hook): a host commits with it
//   release(holder)                not any more
//
// Each mounted instance is its own holder: him in the wardrobe and him at the
// bed are two holders of one thing. The program is everything held. A flush
// (batched after holds and releases, or called) publishes it when its shape
// changed. A cell read sideways before its part has run reads as nothing,
// and the reader runs again after the flush.
//
// Values are computed per scope (a part of the context a subtree sees: a
// focus, a viewer's leaning) and share structure from one publish to the
// next: an unchanged cell is the same object, so a reader of one cell is told
// only when it changes.
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

export interface ThingInfo {
  id: string;
  label?: string;
  aka?: readonly string[];
}

/** The part of the context a subtree sees as its own (a focus, a viewer's leaning). */
export type Scope = { focus?: Context["focus"]; lean?: Context["lean"] };

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
  /** The published state, at the root's own context. */
  get(): Snapshot;
  subscribe(fn: () => void): () => void;
  dispatch(action: Action, note?: string): Snapshot;
  /** The snapshot these actions would make, without making it. */
  preview(actions: Action[]): Snapshot;
  /** fn runs when what `select` reads changes (compared as JSON); returns how to stop it. */
  watch<T>(select: (s: Snapshot) => T, fn: (value: T) => void): () => void;
  undo(): void;
  reset(): void;

  // Reading: pure, for a render.
  /** Every published cell's value under a scope. Stable until the next publish. */
  view(scope?: Scope): Record<Key, Value>;
  /**
   * A declaration's value now, under a scope, whether or not it is held yet: the published
   * program with it (and `pending`, declared before it in the same run) in its place.
   */
  evaluate<K extends string, D>(thing: ThingInfo, decl: IntentDecl<K, D>, scope?: Scope, pending?: readonly IntentDecl<string, unknown>[]): Value<K, D>;

  // Declaring: for a commit.
  /** `holder` declares exactly `decls` on `thing` now (it replaces what it held). */
  hold(holder: string, thing: ThingInfo, decls: readonly IntentDecl<string, unknown>[]): void;
  release(holder: string): void;
  /** Publish the program if its shape changed: reconcile, log. Holds and releases schedule one. */
  flush(note?: string): void;
}

export const keyOf = (thing: string, name: string) => `${thing}.${name}`;
const declSig = (d: IntentDecl<string, unknown>) => signature({ id: "", things: [{ id: "", aka: [], intents: [d] }] });

interface Held {
  thing: ThingInfo;
  decls: readonly IntentDecl<string, unknown>[];
  sigs: string;
}

export function createRoot(init: { id?: string; doc?: Doc; ctx?: Context } = {}): Root {
  const id = init.id ?? "program";
  const first: State = { doc: init.doc ?? EMPTY_DOC, ctx: init.ctx ?? {} };
  let history: State[] = [first];
  let log: LogEntry[] = [];
  const subs = new Set<() => void>();
  const state = () => history[history.length - 1];

  // ---------------------------------------------------------------------------
  // The program: everything held, the latest holder of a cell winning.
  // ---------------------------------------------------------------------------

  const holders = new Map<string, Held>();
  let rev = 0;
  let built = { rev: -1, program: { id, things: [] } as Program };
  const program = (): Program => {
    if (built.rev === rev) return built.program;
    const things = new Map<string, { info: ThingInfo; intents: Map<string, IntentDecl<string, unknown>> }>();
    for (const h of holders.values()) {
      const t = things.get(h.thing.id) ?? { info: h.thing, intents: new Map() };
      things.set(h.thing.id, t);
      for (const d of h.decls) t.intents.set(d.name, d);
    }
    built = {
      rev,
      program: { id, things: [...things.values()].map((t) => ({ id: t.info.id, label: t.info.label, aka: t.info.aka ?? [], intents: [...t.intents.values()] })) },
    };
    return built.program;
  };

  // What is published: the program at the last flush, and the state at the last change.
  let published: { program: Program; sig: string; state: State } = { program: built.program, sig: signature(built.program), state: first };
  let views = new Map<string, Record<Key, Value>>();
  let lastViews = new Map<string, Record<Key, Value>>();
  const ctxOf = (scope?: Scope): Context => ({ ...published.state.ctx, ...scope, lean: { ...published.state.ctx.lean, ...scope?.lean } });
  const scopeKey = (scope?: Scope) => (scope ? JSON.stringify([scope.focus ?? null, scope.lean ?? null]) : "");
  const view = (scope?: Scope) => {
    const k = scopeKey(scope);
    let v = views.get(k);
    if (!v) {
      v = values(published.program, published.state.doc, ctxOf(scope), lastViews.get(k));
      views.set(k, v);
    }
    return v;
  };

  let snap: Snapshot;
  const snapshotOf = (s: State, p: Program, vals: Record<Key, Value>, canUndo: boolean): Snapshot => ({
    ...s,
    program: p,
    values: vals,
    asks: questions(vals),
    stale: staleCells(vals),
    log,
    canUndo,
  });
  /** The state and program now are what everyone sees; `entry` logs what that changed. */
  const publish = (entry?: (vals: Record<Key, Value>) => LogEntry) => {
    published = { ...published, state: state() };
    lastViews = new Map([...lastViews, ...views]);
    views = new Map();
    const vals = view();
    if (entry) log = [entry(vals), ...log];
    snap = snapshotOf(state(), published.program, vals, history.length > 1);
    subs.forEach((fn) => fn());
  };
  snap = snapshotOf(first, published.program, view(), false);

  // Evaluations of declarations not (or not yet) as published, kept per publish.
  let evals = new Map<string, Value>();
  let evalsFor = snap;

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      root.flush();
    });
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
      publish((after) => ({ note: note ?? describe(action), actions: action.type === "batch" ? action.actions : [action], changes: diff(before, after) }));
      return snap;
    },
    preview(actions) {
      const s = actions.reduce(apply, state());
      return snapshotOf(s, published.program, values(published.program, s.doc, s.ctx), true);
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
      const before = snap.values;
      history = history.slice(0, -1);
      publish((after) => ({ note: "undo", actions: [], changes: diff(before, after) }));
    },
    reset() {
      history = [first];
      log = [];
      publish();
    },

    view,
    evaluate<K extends string, D>(thing: ThingInfo, decl: IntentDecl<K, D>, scope?: Scope, pending: readonly IntentDecl<string, unknown>[] = []) {
      const d = decl as unknown as IntentDecl<string, unknown>;
      const key = keyOf(thing.id, d.name);
      const problems = check(key, d);
      if (problems.length) throw new Error(`reintent: ${problems.join("; ")}`);
      const sig = declSig(d);
      const own = published.program.things.find((t) => t.id === thing.id);
      const asPublished = (x: IntentDecl<string, unknown>) => {
        const was = own?.intents.find((i) => i.name === x.name);
        return !!was && declSig(was) === declSig(x);
      };
      // Declared as published, and so is everything in front of it in this run: the published value, the same object.
      if (asPublished(d) && pending.every(asPublished)) {
        const v = view(scope)[key];
        if (v) return v as Value<K, D>;
      }
      if (evalsFor !== snap) {
        evals = new Map();
        evalsFor = snap;
      }
      const memo = `${scopeKey(scope)}|${key}|${sig}|${pending.map(declSig).join("|")}`;
      const hit = evals.get(memo);
      if (hit) return hit as Value<K, D>;
      // The published program, with this run's declarations of the thing in place.
      const mine = [...pending.filter((x) => x.name !== d.name), d];
      const others = published.program.things.filter((t) => t.id !== thing.id);
      const kept = own ? own.intents.filter((i) => !mine.some((m) => m.name === i.name)) : [];
      const p: Program = { id, things: [...others, { id: thing.id, label: thing.label, aka: thing.aka ?? [], intents: [...kept, ...mine] }] };
      const v = values(p, published.state.doc, ctxOf(scope))[key];
      evals.set(memo, v);
      return v as Value<K, D>;
    },

    hold(holder, thing, decls) {
      const sigs = JSON.stringify([thing.id, decls.map(declSig)]);
      const was = holders.get(holder);
      // A re-run brings fresh closures every time: kept quietly. Anything else is a new program.
      if (was && was.sigs === sigs) {
        holders.set(holder, { thing, decls, sigs });
        return;
      }
      holders.delete(holder);
      holders.set(holder, { thing, decls, sigs });
      rev++;
      schedule();
    },
    release(holder) {
      if (!holders.delete(holder)) return;
      rev++;
      schedule();
    },
    flush(note) {
      const p = program();
      const sig = signature(p);
      if (sig === published.sig) {
        // Same shape: the closures may be new (a derive), and they are what evaluates.
        published = { ...published, program: p };
        return;
      }
      const before = snap.values;
      const r = reconcile(state().doc, p);
      if (r.suspended.length || r.restored.length) history = [...history, { ...state(), doc: r.doc }];
      const keysOf = (q: Program) => new Set(q.things.flatMap((t) => t.intents.map((i) => keyOf(t.id, i.name))));
      const was = keysOf(published.program);
      const now = keysOf(p);
      const change: ProgramChange = {
        added: [...now].filter((k) => !was.has(k)),
        removed: [...was].filter((k) => !now.has(k)),
        kept: r.kept,
        suspended: r.suspended,
        restored: r.restored,
      };
      published = { ...published, program: p, sig };
      publish((after) => ({ note: note ?? `program: ${now.size} cells`, actions: [], changes: diff(before, after), program: change }));
    },
  };
  return root;
}
