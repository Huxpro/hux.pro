"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { key, spanStatus, textOf, type IntentsApi, type Snapshot as IntentsSnapshot, type Span, type SpanStatus, type Tree } from "intents";
import type { Snapshot as SceneSnapshot } from "scene";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useLabStrings, type LabTable } from "../i18n";
import { LabButton } from "./shell";

// =============================================================================
// The two bindings, laid open: words ⇄ tree ⇄ picture.
//
// The tree is the source of truth, in the middle. The model bound the words
// to it when it wrote it (Tree.spans: these words are about this thing, this
// intent, and say this kind) and bound it to the picture (Intent.view: this
// intent moves these semantic paths). Here the three stand side by side, with
// lines between them: hover a word, an intent or a thing on the frame, and the
// chain through all three lights up.
//
// And the words are a place to edit from, like the picture is:
//
//   hover a span     a toolbar: the kinds the model believes the words could
//                    say, ranked by its belief (where it is unsure, that is
//                    its question); choose one, and the tree decides it and
//                    the words are rewritten to say it
//   rewrite a span   ① its new words name a kind → resolve; further along →
//                    a kind more; neither → ② a model (weak; strong when the
//                    words name a thing and so reprompt it)
//   delete a span    the model's evidence is gone: it believes again
//   add words        a sentence said: recognized as one, and bound to what it
//                    lands on
//   the tree moves   (a drag on the frame, an answer) a span saying another
//                    kind "differs", and its words can follow
// =============================================================================

const en = {
  title: "Binding",
  note: "The intent tree in the middle, the source of truth: the words bound to it, it bound to the picture. Hover anything in any of the three. Edit the words as you would drag the picture: each edit is an event on the tree.",
  words: "Words",
  edit: "Edit the words",
  apply: "Apply",
  cancel: "Cancel",
  follow: (n: number) => `Let the words follow the tree (${n})`,
  original: "Originally",
  statuses: { names: "names it", agrees: "says it", differs: "says another", unread: "not read yet" } satisfies Record<SpanStatus, string>,
  says: (w: string, k: string) => `The words say “${w}” → ${k}`,
  differs: (k: string, by: string) => `The tree has ${k} now (${by}).`,
  unread: "Nothing in the tree reads these words yet (a model is asked).",
  guesses: "What the words could say (the model's belief):",
  unsure: "The model is not sure: choose.",
  intentsOf: "Its intents:",
  rewrite: "Rewrite these words",
  remove: "Delete them",
  followOne: "Let the words follow",
  view: "moves",
  offScreen: "(not the beat on screen)",
};

const zh: typeof en = {
  title: "绑定",
  note: "意图树在中间，是唯一的事实：文字绑在它上面，它又绑在画面上。在三者里任意一处悬停。像拖动画面一样编辑文字：每次编辑都是树上的一个事件。",
  words: "文字",
  edit: "编辑文字",
  apply: "应用",
  cancel: "取消",
  follow: (n) => `让文字跟上树（${n}）`,
  original: "原话",
  statuses: { names: "指着它", agrees: "说的就是", differs: "说的另一个", unread: "还没读懂" },
  says: (w, k) => `文字说「${w}」→ ${k}`,
  differs: (k, by) => `树里现在是「${k}」（${by}）。`,
  unread: "树里还没有能读懂这句新话的（交给模型）。",
  guesses: "这段话可能在说（模型的信念）：",
  unsure: "模型拿不准：你来选。",
  intentsOf: "它的意图：",
  rewrite: "改写这段",
  remove: "删掉这段",
  followOne: "让文字跟上",
  view: "驱动",
  offScreen: "（不是正在演的这一幕）",
};

const STRINGS: LabTable<typeof en> = { en, zh };

// -----------------------------------------------------------------------------
// The chain: from whatever is hovered, what it binds to in the other two.
// -----------------------------------------------------------------------------

/** What is hovered: a span, an intent (its key), or a path on the frame. */
export type BindFocus = { span?: string; intent?: string; view?: string } | null;

export interface Chain {
  spans: Set<string>;
  intents: Set<string>;
  views: Set<string>;
}

const COLORS = ["#d97706", "#0284c7", "#059669", "#e11d48", "#7c3aed", "#0d9488", "#ca8a04", "#db2777"];
export const colorOf = (tree: Tree, node: string) => COLORS[Math.max(0, tree.nodes.findIndex((n) => n.id === node)) % COLORS.length];

/** A dream's beat that is not the one on screen: its view binding holds only while it is. */
const offScreen = (tree: Tree, node: string, focus: string | null) => !!tree.phases?.some((p) => p.node === node) && node !== focus;

/** The intents a span is about: its intent, or (naming the thing) all of the thing's. */
function intentsOfSpan(tree: Tree, s: Span): string[] {
  if (s.intent) return [key(s.node, s.intent)];
  const n = tree.nodes.find((x) => x.id === s.node);
  return n ? Object.keys(n.intents).map((i) => key(s.node, i)) : [];
}

/** Every intent's view paths (a learned thing's intents move the thing). */
export function viewsOf(tree: Tree, k: string): string[] {
  const [intent, node] = k.split("|");
  const n = tree.nodes.find((x) => x.id === node);
  return n?.intents[intent]?.view ? [...n.intents[intent].view!] : n ? [n.view ?? n.id] : [];
}

const strip = (p: string) => p.replace(/\[[^\]]*\]/g, "");
/** How well a bound view path names a path on the frame: 3 the same part, 2 the same instance, 1 the same thing, 0 not. */
export function reach(view: string, path: string): number {
  if (path === view || path.startsWith(view + ".") || path.startsWith(view + "[")) return view.includes(".") ? 3 : view.includes("[") ? 2 : 1;
  const [v, p] = [strip(view), strip(path)];
  if (p === v || p.startsWith(v + ".")) return v.includes(".") ? 3 : 1;
  return 0;
}

export function chainOf(tree: Tree, focus: BindFocus, onScreen: string | null): Chain {
  const out: Chain = { spans: new Set(), intents: new Set(), views: new Set() };
  if (!focus) return out;
  const spans = tree.spans ?? [];
  if (focus.span) {
    const s = spans.find((x) => x.id === focus.span);
    if (!s) return out;
    out.spans.add(s.id);
    for (const k of intentsOfSpan(tree, s)) out.intents.add(k);
  } else if (focus.intent) {
    out.intents.add(focus.intent);
  } else if (focus.view) {
    // The intents that move what is under the pointer, the most specific first.
    let best = 0;
    const found: [string, number][] = [];
    for (const n of tree.nodes) {
      if (offScreen(tree, n.id, onScreen)) continue;
      for (const i of Object.keys(n.intents)) {
        const k = key(n.id, i);
        const r = Math.max(0, ...viewsOf(tree, k).map((v) => reach(v, focus.view!)));
        if (r) found.push([k, r]);
        best = Math.max(best, r);
      }
    }
    for (const [k, r] of found) if (r === best) out.intents.add(k);
    out.views.add(focus.view);
  }
  for (const k of out.intents) {
    const [intent, node] = k.split("|");
    if (!offScreen(tree, node, onScreen)) for (const v of viewsOf(tree, k)) out.views.add(v);
    if (!focus.span) for (const s of spans) if (s.node === node && (!s.intent || s.intent === intent)) out.spans.add(s.id);
  }
  return out;
}

// -----------------------------------------------------------------------------
// The words: the prompt with its spans; a toolbar on each; editable.
// -----------------------------------------------------------------------------

const underline: Record<SpanStatus, "dotted" | "solid" | "dashed" | "wavy"> = { names: "dotted", agrees: "solid", differs: "dashed", unread: "wavy" };

export function BindingWords({
  api,
  snap,
  chain,
  setHover,
}: {
  api: IntentsApi;
  snap: IntentsSnapshot;
  chain: Chain;
  setHover: (f: BindFocus) => void;
}) {
  const S = useLabStrings(STRINGS);
  const { locale } = useLocale();
  const tree = snap.tree;
  const spans = tree.spans ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [rewriting, setRewriting] = useState<{ span: string; text: string } | null>(null);
  const close = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keep = () => close.current && clearTimeout(close.current);
  const later = () => {
    keep();
    close.current = setTimeout(() => {
      setOpen(null);
      setHover(null);
    }, 260);
  };

  const differing = spans.filter((s) => spanStatus(s, snap.values) === "differs");
  const node = (id: string) => tree.nodes.find((n) => n.id === id);
  const kindLabel = (n: string, i: string, k: string) => node(n)?.intents[i]?.kinds[k]?.label[locale] ?? k;

  // The prompt, cut at its spans.
  const pieces: (string | Span)[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.from > at) pieces.push(tree.prompt.slice(at, s.from));
    pieces.push(s);
    at = s.to;
  }
  if (at < tree.prompt.length) pieces.push(tree.prompt.slice(at));

  const toolbar = (s: Span) => {
    const n = node(s.node);
    if (!n) return null;
    const status = spanStatus(s, snap.values);
    const words = textOf(tree, s);
    const one = (intent: string) => {
      const i = n.intents[intent];
      const v = snap.values[key(s.node, intent)];
      const ask = snap.asks.some((a) => a.key === key(s.node, intent));
      const ranked = Object.keys(i.kinds).sort((a, b) => (i.p[b] ?? 0) - (i.p[a] ?? 0));
      return (
        <div key={intent} className="space-y-1">
          <div className="text-[11px] text-muted-foreground">
            {n.label[locale]} · {i.label[locale]}
            {ask && <span className="ml-1 text-amber-600 dark:text-amber-400">{S.unsure}</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            {ranked.map((k) => (
              <button
                key={k}
                type="button"
                disabled={snap.pending}
                onClick={() => {
                  void api.dispatch({ type: "choose", span: s.id, intent, kind: k });
                  setOpen(null);
                }}
                className={cn(
                  "rounded border px-1.5 text-[11px] leading-5 transition-colors disabled:opacity-40",
                  v?.kind === k ? "border-foreground/60 bg-foreground/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {i.kinds[k].label[locale]}
                <span className="ml-1 font-mono text-[10px] opacity-70">{Math.round((i.p[k] ?? 0) * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      );
    };
    const v = s.intent ? snap.values[key(s.node, s.intent)] : undefined;
    return (
      <div
        onMouseEnter={keep}
        onMouseLeave={later}
        className="absolute left-0 top-full z-20 mt-1 w-[min(26rem,calc(100vw-3rem))] space-y-2 rounded-xl border border-border bg-background/95 p-3 text-left font-sans shadow-overlay backdrop-blur"
      >
        <div className="text-[12px] leading-snug text-foreground">
          {S.says(words, s.intent ? (s.kind ? kindLabel(s.node, s.intent, s.kind) : node(s.node)?.intents[s.intent]?.label[locale] ?? s.intent) : (n.label[locale] ?? n.id))}
          <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">· {S.statuses[status]}</span>
        </div>
        {status === "differs" && v && s.intent && (
          <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
            {S.differs(kindLabel(s.node, s.intent, v.kind), v.from ?? v.source)}
            <LabButton onClick={() => void api.dispatch({ type: "follow", spans: [s.id] })}>{S.followOne}</LabButton>
          </div>
        )}
        {status === "unread" && <div className="text-[11px] text-red-600 dark:text-red-400">{S.unread}</div>}
        <div className="text-[11px] text-muted-foreground">{s.intent ? S.guesses : S.intentsOf}</div>
        {s.intent ? one(s.intent) : Object.keys(n.intents).map(one)}
        {rewriting?.span === s.id ? (
          <form
            className="flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void api.dispatch({ type: "words", prompt: tree.prompt.slice(0, s.from) + rewriting.text + tree.prompt.slice(s.to) });
              setRewriting(null);
              setOpen(null);
            }}
          >
            <input
              autoFocus
              value={rewriting.text}
              onChange={(e) => setRewriting({ span: s.id, text: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-foreground/40"
            />
            <LabButton tone="primary" type="submit">
              {S.apply}
            </LabButton>
          </form>
        ) : (
          <div className="flex gap-1.5 border-t border-border/60 pt-2">
            <LabButton onClick={() => setRewriting({ span: s.id, text: words })}>{S.rewrite}</LabButton>
            <LabButton
              onClick={() => {
                void api.dispatch({ type: "words", prompt: tree.prompt.slice(0, s.from) + tree.prompt.slice(s.to) });
                setOpen(null);
              }}
            >
              {S.remove}
            </LabButton>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className={TYPE.label}>{S.words}</div>
        <div className="flex gap-1">
          {differing.length > 0 && <LabButton onClick={() => void api.dispatch({ type: "follow", spans: differing.map((s) => s.id) })}>{S.follow(differing.length)}</LabButton>}
          {editing === null && <LabButton onClick={() => setEditing(tree.prompt)}>{S.edit}</LabButton>}
        </div>
      </div>
      {editing !== null ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void api.dispatch({ type: "words", prompt: editing });
            setEditing(null);
          }}
        >
          <textarea
            autoFocus
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            rows={5}
            lang="zh"
            className="w-full rounded-lg border border-border bg-background/70 p-2.5 font-serif text-[15px] leading-loose outline-none focus:border-foreground/40"
          />
          <div className="flex gap-1.5">
            <LabButton tone="primary" type="submit">
              {S.apply}
            </LabButton>
            <LabButton onClick={() => setEditing(null)}>{S.cancel}</LabButton>
          </div>
        </form>
      ) : (
        <div lang="zh" className="font-serif text-[15px] leading-[2.1] text-reading-foreground">
          {pieces.map((p, i) => {
            if (typeof p === "string") return <span key={i}>{p}</span>;
            const status = spanStatus(p, snap.values);
            const color = colorOf(tree, p.node);
            const lit = chain.spans.has(p.id);
            return (
              <span key={p.id} className="relative inline-block">
                <button
                  type="button"
                  data-bind-span={p.id}
                  onMouseEnter={() => {
                    keep();
                    setOpen(p.id);
                    setHover({ span: p.id });
                  }}
                  onMouseLeave={later}
                  onFocus={() => {
                    setOpen(p.id);
                    setHover({ span: p.id });
                  }}
                  className="rounded-sm px-[1px] transition-colors"
                  style={{
                    background: lit ? `${color}33` : `${color}12`,
                    textDecorationLine: "underline",
                    textDecorationStyle: underline[status],
                    textDecorationColor: status === "differs" ? "#d97706" : status === "unread" ? "#dc2626" : color,
                    textDecorationThickness: lit ? 2 : 1.5,
                    textUnderlineOffset: 5,
                  }}
                >
                  {textOf(tree, p)}
                </button>
                {open === p.id && toolbar(p)}
              </span>
            );
          })}
        </div>
      )}
      {snap.base.prompt !== tree.prompt && !tree.phases && (
        <p className={cn(TYPE.caption, "text-[11px] opacity-70")}>
          {S.original}：{snap.base.prompt}
        </p>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
        {(Object.keys(underline) as SpanStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="inline-block w-5 border-b-2" style={{ borderBottomStyle: s === "unread" ? "dotted" : (underline[s] as "solid"), borderColor: s === "differs" ? "#d97706" : s === "unread" ? "#dc2626" : "currentColor" }} />
            {S.statuses[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A row's view paths, small: what the intent moves. */
export function ViewChips({ tree, k, onScreen }: { tree: Tree; k: string; onScreen: string | null }) {
  const S = useLabStrings(STRINGS);
  const [, node] = k.split("|");
  const off = offScreen(tree, node, onScreen);
  return (
    <span className={cn("font-mono text-[10px] text-muted-foreground", off && "opacity-50")}>
      {S.view} {viewsOf(tree, k).join(" · ")}
      {off ? ` ${S.offScreen}` : ""}
    </span>
  );
}

export function BindingHeader() {
  const S = useLabStrings(STRINGS);
  return (
    <div>
      <div className={TYPE.label}>{S.title}</div>
      <p className={cn(TYPE.caption, "mt-0.5")}>{S.note}</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// The lines: words → intents → picture, drawn over the inspector.
// -----------------------------------------------------------------------------

type Matrix = SceneSnapshot["toClient"];
interface Line {
  id: string;
  d: string;
  color: string;
  lit: boolean;
}

/** The boxes (scene units) a view path names on stage: the closest name only, and a part only when the part is named. */
export function sceneBoxes(view: string, scene: SceneSnapshot) {
  let best = 0;
  const all: [number, NonNullable<SceneSnapshot["instances"][number]["visible"]>][] = [];
  for (const inst of scene.instances)
    for (const n of [inst, ...inst.parts]) {
      const r = n.visible ? reach(view, n.path) : 0;
      if (r && n.visible && (n.path === inst.path || r === 3)) all.push([r, n.visible]);
      best = Math.max(best, r);
    }
  return all.filter(([r]) => r === best).map(([, b]) => b);
}

/** The same boxes in the container's coordinates, clipped to the frame. */
function boxesFor(view: string, scene: SceneSnapshot, frame: DOMRect, origin: DOMRect) {
  const m: Matrix = scene.toClient;
  const at = (x: number, y: number) => [m[0] * x + m[2] * y + m[4] + frame.left - origin.left, m[1] * x + m[3] * y + m[5] + frame.top - origin.top] as const;
  return sceneBoxes(view, scene).map((b) => {
    const [x0, y0] = at(b.x0, b.y0);
    const [x1, y1] = at(b.x1, b.y1);
    return {
      x0: Math.max(Math.min(x0, x1), frame.left - origin.left),
      y0: Math.max(Math.min(y0, y1), frame.top - origin.top),
      x1: Math.min(Math.max(x0, x1), frame.right - origin.left),
      y1: Math.min(Math.max(y0, y1), frame.bottom - origin.top),
    };
  });
}

export function BindingLines({
  container,
  frame,
  tree,
  scene,
  chain,
  onScreen,
}: {
  container: RefObject<HTMLElement | null>;
  frame: RefObject<HTMLElement | null>;
  tree: Tree | null;
  scene: SceneSnapshot | null;
  chain: Chain;
  onScreen: string | null;
}) {
  const [lines, setLines] = useState<{ w: number; h: number; lines: Line[] }>({ w: 0, h: 0, lines: [] });
  const live = useRef({ tree, scene, chain, onScreen });
  useEffect(() => {
    live.current = { tree, scene, chain, onScreen };
  });

  useEffect(() => {
    let last = "";
    let raf = 0;
    const measure = () => {
      raf = 0;
      const root = container.current;
      const fr = frame.current;
      const { tree, scene, chain, onScreen } = live.current;
      if (!root || !fr || !tree) return;
      const origin = root.getBoundingClientRect();
      const frameRect = fr.getBoundingClientRect();
      const rel = (r: DOMRect) => ({ x0: r.left - origin.left, y0: r.top - origin.top, x1: r.right - origin.left, y1: r.bottom - origin.top });
      const out: Line[] = [];
      const rows = new Map<string, ReturnType<typeof rel>>();
      for (const el of root.querySelectorAll<HTMLElement>("[data-bind-intent]")) rows.set(el.dataset.bindIntent!, rel(el.getBoundingClientRect()));
      // Words → tree.
      for (const el of root.querySelectorAll<HTMLElement>("[data-bind-span]")) {
        const s = tree.spans?.find((x) => x.id === el.dataset.bindSpan);
        if (!s) continue;
        const a = rel(el.getClientRects()[0] ?? el.getBoundingClientRect());
        for (const k of intentsOfSpan(tree, s)) {
          const r = rows.get(k);
          if (!r) continue;
          const sx = (a.x0 + a.x1) / 2;
          const sy = a.y1;
          const ex = r.x0;
          const ey = (r.y0 + r.y1) / 2;
          const lit = chain.spans.has(s.id) && chain.intents.has(k);
          out.push({ id: `${s.id}>${k}`, d: `M ${sx} ${sy} C ${sx} ${sy + 60}, ${ex - 60} ${ey}, ${ex} ${ey}`, color: colorOf(tree, s.node), lit });
        }
      }
      // Tree → picture.
      if (scene)
        for (const [k, r] of rows) {
          const [, node] = k.split("|");
          if (offScreen(tree, node, onScreen)) continue;
          for (const v of viewsOf(tree, k))
            for (const b of boxesFor(v, scene, frameRect, origin)) {
              const sx = r.x0;
              const sy = (r.y0 + r.y1) / 2;
              const ex = b.x1;
              const ey = (b.y0 + b.y1) / 2;
              const lit = chain.intents.has(k);
              out.push({ id: `${k}>${v}>${Math.round(b.x0)},${Math.round(b.y0)}`, d: `M ${sx} ${sy} C ${sx - 90} ${sy}, ${ex + 90} ${ey}, ${ex} ${ey}`, color: colorOf(tree, node), lit });
            }
        }
      const next = { w: root.scrollWidth, h: root.scrollHeight, lines: out };
      const sig = JSON.stringify(next);
      if (sig !== last) {
        last = sig;
        setLines(next);
      }
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const id = setInterval(soon, 150);
    addEventListener("scroll", soon, { passive: true });
    addEventListener("resize", soon);
    soon();
    return () => {
      clearInterval(id);
      cancelAnimationFrame(raf);
      removeEventListener("scroll", soon);
      removeEventListener("resize", soon);
    };
  }, [container, frame]);

  const any = chain.spans.size + chain.intents.size + chain.views.size > 0;
  return (
    <svg className="pointer-events-none absolute left-0 top-0 z-30 hidden lg:block" width={lines.w} height={lines.h} aria-hidden>
      {lines.lines.map((l) => (
        <path
          key={l.id}
          d={l.d}
          fill="none"
          stroke={l.color}
          strokeWidth={l.lit ? 1.8 : 1}
          strokeDasharray={l.lit ? undefined : "3 4"}
          opacity={l.lit ? 0.95 : any ? 0.08 : 0.22}
        />
      ))}
    </svg>
  );
}
