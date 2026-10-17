// =============================================================================
// The runtime: the loop, inside an experience.
//
//   const it = useIntents(TREE, HOST)    the tree the model wrote with the code
//   it.values / it.asks / it.preview     what the scene reads (with realized())
//   window.__intents                     the same loop, open to Inspect
//
// Every event goes one way: recognize → resolve (decide) | ask | infer (a
// model, weak or strong, async) | context → reduce → the tree → reintent →
// the scene. A drag's in-between is the view's own temporary state (preview),
// never the tree's. A history of states is the undo. The saved tree (if any)
// and a shared version (if the address has one) are laid over the code's tree
// on load.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { recognize, type Event, type Reading } from "./recognize";
import { draw, infer, type Host, type Proposal, type Tier } from "./router";
import { values as computeValues, type Value } from "./space";
import { changes, lineDiff, rebase, reduce, toXml, type Action, type By, type Change, type Context, type State, type Text, type Tree, type Version } from "./tree";
import { decodeVersion, encodeVersion, newId, savedUrl, versionInHash, type Saved } from "./version";

export type Path = "resolve" | "ask" | "infer" | "context";

export interface LogEntry {
  id: number;
  event: string;
  path: Path;
  detail: string;
  reading?: Reading;
  tier?: Tier;
  live?: boolean;
  by?: By;
  ms?: number;
  note?: Text;
  observation?: string;
  added: string[];
  removed: string[];
  pending?: boolean;
}

export interface Ask {
  key: string;
  node: string;
  intent: string;
  kinds: string[];
  p: Record<string, number>;
}

export interface Snapshot {
  scene: string;
  tree: Tree;
  base: Tree;
  ctx: Context;
  version: Version;
  xml: string;
  values: Record<string, Value>;
  asks: Ask[];
  question: { text: string; readings: Reading[] } | null;
  log: LogEntry[];
  pending: boolean;
  /** Since the code's tree: what this version changes. */
  changes: Change[];
  /** What is on disk now (null: nothing saved). */
  saved: Saved | null;
  dirty: boolean;
  canUndo: boolean;
  /** The node the experience has on screen (a dream's beat), if it says. */
  focus: string | null;
  /** A structural answer waiting for the person: what it would do, and whether the picture is showing it. */
  proposal: (Proposal & { id: number; note: Text; by: By; tier: Tier; live: boolean; event: string; xml: string }) | null;
  previewing: boolean;
}

export interface DragPreview {
  path: string;
  from: readonly [number, number];
  to: readonly [number, number];
}

export interface IntentsApi {
  version: 1;
  get(): Snapshot;
  subscribe(fn: () => void): () => void;
  dispatch(ev: Event): Promise<void>;
  preview(p: DragPreview | null): void;
  undo(): void;
  forget(node: string, intent: string): void;
  /** Back to the code's tree (the model's first writing), nothing decided. */
  reset(): void;
  /** Write the tree to content/scenes (dev only). */
  save(): Promise<{ ok: boolean; error?: string }>;
  /** This version as a link fragment ("v=…"). */
  share(): Promise<string>;
  /** Open a version from a link (its fragment, or the whole address). */
  open(link: string): Promise<boolean>;
  /** A structural proposal: apply it, drop it, or show it in the picture without applying. */
  accept(): void;
  discard(): void;
  previewProposal(on: boolean): void;
}

declare global {
  interface Window {
    __intents?: IntentsApi;
  }
}

const AUTHOR: Version = { id: "code", parent: null, by: "model" };

/**
 * The loop over a tree. `focus`: the node on screen now (a dream's beat), which
 * events lean to; or how to find it in whatever the tree is now.
 */
export function useIntents(base: Tree, host: Host, focusOf: string | null | ((tree: Tree) => string | null) = null) {
  const initial: State = { tree: base, ctx: { prompts: [], viewer: {} }, version: AUTHOR };
  const [history, setHistory] = useState<State[]>([initial]);
  const state = history[history.length - 1];
  const [log, setLog] = useState<LogEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [question, setQuestion] = useState<Snapshot["question"]>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  // A structural answer, held until the person accepts it: the actions it would take, and the state after.
  const [proposal, setProposal] = useState<(NonNullable<Snapshot["proposal"]> & { actions: Action[]; after: State; drawNeeded: string[] }) | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const seq = useRef(0);

  const focus = typeof focusOf === "function" ? focusOf(state.tree) : focusOf;
  const live = useRef({ state, log, pending, question, saved, history, focus, proposal, previewing });
  useEffect(() => {
    live.current = { state, log, pending, question, saved, history, focus, proposal, previewing };
  });
  const listeners = useRef(new Set<() => void>());
  const cache = useRef<{ from: typeof live.current; snap: Snapshot } | null>(null);
  useEffect(() => {
    for (const l of listeners.current) l();
  }, [state, log, pending, question, saved, focus, proposal, previewing]);

  // What the picture shows: the state, or (previewing a proposal) the state it would make.
  const shown = previewing && proposal ? proposal.after : state;
  const { values, asks } = useMemo(() => computeValues(shown), [shown]);

  const push = (actions: Action[]) => {
    if (!actions.length) return;
    setHistory((h) => [...h, actions.reduce(reduce, h[h.length - 1])]);
  };
  const entry = (e: Omit<LogEntry, "id">) => {
    const id = ++seq.current;
    setLog((l) => [{ ...e, id }, ...l].slice(0, 80));
    return id;
  };
  const patch = (id: number, e: Partial<LogEntry>) => setLog((l) => l.map((x) => (x.id === id ? { ...x, ...e } : x)));

  // The saved tree, then a shared version, over the code's tree.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void (async () => {
      let start: State = initial;
      try {
        const res = await fetch(savedUrl(host.scene), { cache: "no-store" });
        if (res.ok) {
          const s = (await res.json()) as Saved;
          if (s?.tree?.nodes) {
            setSaved(s);
            start = { ...start, tree: overlay(base, s.tree), version: s.version };
          }
        }
      } catch {
        // Nothing saved: the code's tree.
      }
      const v = versionInHash(location.hash);
      const shared = v ? await decodeVersion(v) : null;
      if (shared) start = { ...start, tree: overlay(base, shared.tree), version: shared.version };
      if (start !== initial) setHistory([start]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  const describe = (ev: Event) =>
    ev.type === "say"
      ? `${ev.node ?? "scene"} ←「${ev.text}」`
      : ev.type === "dream"
        ? `dream ←「${ev.text}」`
        : ev.type === "drag"
          ? `drag ${ev.path} → (${ev.to.map((v) => Math.round(v)).join(", ")})`
          : ev.type === "answer"
            ? `answer ${ev.node}.${ev.intent} = ${ev.kind}`
            : ev.type === "lean"
              ? `lean ${ev.intent} → ${ev.kind ?? "none"}`
              : ev.type === "words"
                ? `words ✎ ${wordDiff(live.current.state.tree.prompt, ev.prompt)}`
                : ev.type === "choose"
                  ? `words ⟶ ${ev.intent} = ${ev.kind}`
                  : `words follow the tree (${ev.spans.length})`;

  const dispatch = async (ev: Event) => {
    const before = live.current.state;
    // Described against the words as they were (an edit is told by what went and what came).
    const what = describe(ev);
    const vals = computeValues(before).values;
    // Context first: what is said joins it; a leaning is the viewer's.
    const pre: Action[] = [];
    if (ev.type === "say" || ev.type === "dream") pre.push({ type: "context", ctx: { prompts: [...before.ctx.prompts, ev.text] } });
    if (ev.type === "lean") {
      const viewer = { ...before.ctx.viewer };
      if (ev.kind) viewer[ev.intent] = ev.kind;
      else delete viewer[ev.intent];
      pre.push({ type: "context", ctx: { viewer } });
    }
    const r = recognize(ev, before.tree, vals, live.current.focus);
    // An edit to the words comes first: the prompt as it is now, its spans moved.
    pre.push(...(r.pre ?? []));
    // Words just edited, bound to what the event lands on: a reading, a thing a model added, a kind it picked.
    const bind = (target: { node: string; intent?: string; kind?: string } | null): Action[] => (r.bind && target ? [{ type: "bind", ...r.bind, ...target }] : []);
    // A drag's in-between ends when the tree has its answer: now, or when a model's comes back.
    const settled = () => ev.type === "drag" && setPreview(null);
    if (r.path === "resolve" || r.path === "context") {
      const actions = [...pre, ...r.actions, ...bind(r.path === "resolve" && r.reading ? r.reading : null)];
      const after = actions.reduce(reduce, before);
      push(actions);
      settled();
      if (ev.type === "answer") setQuestion(null);
      const d = lineDiff(toXml(before), toXml(after));
      entry({ event: what, path: r.path, detail: r.path === "resolve" && r.reading ? `${r.reading.node}.${r.reading.intent} = ${r.reading.kind}` : "context", reading: r.path === "resolve" ? r.reading : undefined, ...d });
      return;
    }
    if (r.path === "ask") {
      push(pre);
      settled();
      setQuestion({ text: r.text, readings: r.readings });
      entry({ event: what, path: "ask", detail: r.readings.map((x) => `${x.node}.${x.intent} = ${x.kind}`).join(" | "), added: [], removed: [] });
      return;
    }
    // ② infer: no preset reads it. Routed to a weak or a strong model; its tree comes back.
    push(pre);
    setPending(true);
    const withPre = pre.reduce(reduce, before);
    const id = entry({ event: what, path: "infer", detail: r.need.kind, pending: true, added: [], removed: [] });
    const inf = await infer(withPre, r.need, host);
    const now = live.current.state;
    // A structural answer is the whole tree as it should be (rebase would bring back what it removed): loaded, not merged.
    const actions: Action[] = inf.tree ? [inf.dream || inf.proposal ? { type: "load", tree: inf.tree } : { type: "replace", tree: inf.tree }, ...inf.then] : [];
    if (inf.tree && !inf.dream) {
      const added = inf.tree.nodes.find((n) => !now.tree.nodes.some((o) => o.id === n.id));
      const picked = inf.then.find((a) => a.type === "decide");
      actions.push(...bind(added ? { node: added.id } : picked?.type === "decide" ? { node: picked.node, intent: picked.intent, kind: picked.kind } : null));
    }
    const after = actions.reduce(reduce, now);
    settled();
    setPending(false);
    const diff = lineDiff(toXml(now), toXml(after));
    if (inf.proposal) {
      // Bigger than a kind more: shown as a proposal. The person previews it, accepts it, or drops it.
      setProposal({ ...inf.proposal, id, note: inf.note, by: inf.by, tier: inf.tier, live: inf.live, event: what, xml: toXml(after), actions: inf.proposal.scope === "code" ? [] : actions, after, drawNeeded: inf.drawNeeded });
      patch(id, { pending: false, tier: inf.tier, live: inf.live, by: inf.by, ms: inf.ms, note: inf.note, observation: inf.observation, detail: `${r.need.kind} · ${inf.proposal.scope === "code" ? "needs the code" : "proposal"}`, ...diff });
      return;
    }
    push(actions);
    patch(id, { pending: false, tier: inf.tier, live: inf.live, by: inf.by, ms: inf.ms, note: inf.note, observation: inf.observation, ...diff });
    drawAll(inf.drawNeeded, after);
  };

  // A thing with no drawing yet: a lazy effect, written by a strong model; a placeholder till then.
  const drawAll = (ids: string[], after: State) => {
    for (const nodeId of ids) {
      const node = after.tree.nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      const did = entry({ event: `draw ${nodeId}`, path: "infer", detail: "drawing", tier: "strong", pending: true, added: [], removed: [] });
      const t0 = performance.now();
      void draw(after, node, host).then((d) => {
        if (d) push([{ type: "draw", node: nodeId, drawing: d }]);
        patch(did, { pending: false, by: d?.by, live: d?.by.who.startsWith("model:") && d?.by.who !== "model:recorded", ms: Math.round(performance.now() - t0), note: d ? { zh: "画好了：按它被写下时的意图缓存", en: "Drawn: cached with the intents it was written under" } : { zh: "画不出来：留着占位", en: "Not drawn: the placeholder stays" } });
      });
    }
  };

  const api: IntentsApi = {
    version: 1,
    get: () => {
      // Cached while nothing it reads has changed, as useSyncExternalStore asks.
      const now = live.current;
      const c = cache.current;
      if (c && (Object.keys(now) as (keyof typeof now)[]).every((k) => c.from[k] === now[k])) return c.snap;
      cache.current = { from: now, snap: snapshotOf() };
      return cache.current.snap;
    },
    subscribe: (fn) => {
      listeners.current.add(fn);
      return () => listeners.current.delete(fn);
    },
    dispatch,
    preview: (p) => setPreview(p),
    undo: () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h)),
    forget: (node, intent) => push([{ type: "forget", node, intent }]),
    reset: () => {
      setHistory([initial]);
      setQuestion(null);
      setLog([]);
    },
    save: async () => {
      const s = live.current.state;
      const body: Saved = { version: { id: newId(), parent: s.version.id, by: "author" }, tree: s.tree, savedAt: new Date().toISOString() };
      try {
        const res = await fetch("/api/scenes/intents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scene: host.scene, ...body }) });
        if (!res.ok) return { ok: false, error: (await res.json().catch(() => ({})))?.error ?? res.statusText };
        setSaved(body);
        setHistory((h) => [...h.slice(0, -1), { ...h[h.length - 1], version: body.version }]);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    share: async () => {
      const s = live.current.state;
      const v: Saved = { version: { id: newId(), parent: s.version.id, by: "you" }, tree: s.tree };
      setHistory((h) => [...h.slice(0, -1), { ...h[h.length - 1], version: v.version }]);
      return `v=${await encodeVersion(v)}`;
    },
    accept: () => {
      const p = live.current.proposal;
      if (!p || p.scope === "code") return;
      push(p.actions);
      setProposal(null);
      setPreviewing(false);
      entry({ event: `accept ${p.event}`, path: "resolve", detail: "the proposal, applied", ...lineDiff(toXml(live.current.state), p.xml) });
      drawAll(p.drawNeeded, p.after);
    },
    discard: () => {
      const p = live.current.proposal;
      if (!p) return;
      setProposal(null);
      setPreviewing(false);
      entry({ event: `discard ${p.event}`, path: "context", detail: "the proposal, dropped (the words stay as edited; undo takes them back)", added: [], removed: [] });
    },
    previewProposal: (on) => setPreviewing(on && !!live.current.proposal && live.current.proposal.scope !== "code"),
    open: async (link) => {
      const v = versionInHash(link.includes("v=") ? link.slice(link.indexOf("v=") - 1) : `#v=${link}`);
      const s = v ? await decodeVersion(v) : null;
      if (!s) return false;
      push([{ type: "load", tree: overlay(base, s.tree), version: s.version }]);
      entry({ event: `open version ${s.version.id}`, path: "context", detail: `parent ${s.version.parent ?? "—"} · by ${s.version.by}`, ...lineDiff(toXml(live.current.state), toXml({ tree: s.tree })) });
      return true;
    },
  };

  function snapshotOf(): Snapshot {
    const { state: s, log: l, pending: p, question: q, saved: sv, history: h, focus: f, proposal: pr, previewing: pv } = live.current;
    const v = computeValues(s);
    return {
      scene: host.scene,
      tree: s.tree,
      base,
      ctx: s.ctx,
      version: s.version,
      xml: toXml(s),
      values: v.values,
      asks: v.asks.map((c) => ({ key: c.key, node: c.key.split("|")[1], intent: c.type, kinds: c.kinds, p: v.values[c.key].p })),
      question: q,
      log: l,
      pending: p,
      changes: changes(base, s.tree),
      saved: sv,
      dirty: JSON.stringify(sv?.tree ?? base) !== JSON.stringify(s.tree),
      canUndo: h.length > 1,
      focus: f,
      proposal: pr ? publicProposal(pr) : null,
      previewing: pv,
    };
  }

  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });
  useEffect(() => {
    // A stable object for the outside, always calling the latest closures.
    const stable: IntentsApi = {
      version: 1,
      get: () => apiRef.current.get(),
      subscribe: (fn) => apiRef.current.subscribe(fn),
      dispatch: (ev) => apiRef.current.dispatch(ev),
      preview: (p) => apiRef.current.preview(p),
      undo: () => apiRef.current.undo(),
      forget: (n, i) => apiRef.current.forget(n, i),
      reset: () => apiRef.current.reset(),
      save: () => apiRef.current.save(),
      share: () => apiRef.current.share(),
      open: (l) => apiRef.current.open(l),
      accept: () => apiRef.current.accept(),
      discard: () => apiRef.current.discard(),
      previewProposal: (on) => apiRef.current.previewProposal(on),
    };
    window.__intents = stable;
    return () => {
      if (window.__intents === stable) delete window.__intents;
    };
  }, []);

  return { state: shown, values, asks: asks.map((c) => c.key), preview, pending, focus };
}

/** A proposal as the outside sees it: what it would do, not the actions that would do it. */
function publicProposal<P extends { actions: unknown; after: unknown; drawNeeded: unknown }>(p: P): Omit<P, "actions" | "after" | "drawNeeded"> {
  const rest: Partial<P> = { ...p };
  delete rest.actions;
  delete rest.after;
  delete rest.drawNeeded;
  return rest as Omit<P, "actions" | "after" | "drawNeeded">;
}

/** An edit, in a few characters: what went, what came. */
function wordDiff(a: string, b: string) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  const gone = a.slice(p, a.length - s);
  const came = b.slice(p, b.length - s);
  return gone && came ? `「${gone}」→「${came}」` : gone ? `−「${gone}」` : `+「${came}」`;
}

/** A kept tree over the code's: rebased by key when it is the same piece, whole when it is another (a dream). */
export function overlay(base: Tree, kept: Tree): Tree {
  // The same piece (an experience with its own code for time): the code's tree, with what was kept laid over it,
  // the words as they were left. Another dream: the kept tree, whole.
  return !base.phases && !kept.phases ? { ...rebase(base, kept), prompt: kept.prompt, spans: kept.spans ?? base.spans } : kept;
}
