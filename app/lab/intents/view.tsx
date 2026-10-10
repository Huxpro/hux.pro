"use client";

import { RotateCcw, Send, Undo2 } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Stage } from "scene";
import * as R from "@/packages/reintent/src/reintent.js";
import { LabButton, LabChip, LabSection, LabShell, useLabStrings } from "@/systems/lab";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { Bed, BedroomDefs, Man, Room, Wardrobe as WardrobeBox, Window } from "@/experiences/common/bedroom";
import { frameDecision, realize, values as computeValues, type Value } from "./compute";
import { LATENCY, infer, observe } from "./model";
import { recognize, type Event, type Reading } from "./recognize";
import { INTENTS_STRINGS, type IntentsStrings } from "./strings";
import { INITIAL, reduce, toXml, type Action, type Pt, type State } from "./tree";

// =============================================================================
// /lab/intents: the intent loop. Reintent (airtalk#818) as a reactive,
// intent-oriented runtime, on the Wardrobe's own things.
//
//   tree.ts       DATA      the intent tree (the one state), the reducer, the tree as text
//   compute.ts    COMPUTE   reintent over the tree, then the projection to coordinates
//   view.tsx      VIEW      the live scene (with the drag's temporary state), the panel
//   recognize.ts  the event callback: ① resolve to a preset, ask, or ② hand to the model
//   model.ts      ② infer: the tree and the event → a new tree (an effect; a stand-in here)
//
//   model ──tree──▶ data ──▶ compute (reintent) ──▶ view ── event ──▶ recognizer
//                    ▲                                                   │
//                    ├──────────── ① resolve: decide ◀── preset hit ─────┤
//                    └──── replace ◀── ② model infer ◀── no preset ──────┘
// =============================================================================

type ScreenId = "phone" | "square" | "wide";
const SCREENS: Record<ScreenId, { width: number; height: number; box: { w: number; h: number } }> = {
  phone: { width: 390, height: 844, box: { w: 300, h: 650 } },
  square: { width: 1000, height: 1000, box: { w: 470, h: 470 } },
  wide: { width: 1920, height: 1080, box: { w: 640, h: 360 } },
};

const DREAM = "saturate(0.8) hue-rotate(14deg) brightness(1.06)";
/** The drag's preview: smaller the farther back (the same rule the model uses for a new place). */
const depth = (y: number) => Math.max(0.6, Math.min(1.95, 0.72 + ((y - 600) / 272) * 1.2));

type Path = "resolve" | "infer" | "ask" | "context";
interface LogEntry {
  id: number;
  event: string;
  path: Path;
  detail: string;
  note?: string;
  observation?: string;
  added: string[];
  removed: string[];
  pending?: boolean;
}

const diff = (a: string, b: string) => {
  const A = new Set(a.split("\n"));
  const B = new Set(b.split("\n"));
  return { added: [...B].filter((l) => !A.has(l)), removed: [...A].filter((l) => !B.has(l)) };
};

export function IntentsLabView() {
  const S = useLabStrings(INTENTS_STRINGS);
  const { locale } = useLocale();
  const [history, setHistory] = useState<State[]>([INITIAL]);
  const state = history[history.length - 1];
  const live = useRef(state);
  useLayoutEffect(() => {
    live.current = state;
  });
  const [log, setLog] = useState<LogEntry[]>([]);
  const seq = useRef(0);
  const [pending, setPending] = useState(false);
  const [question, setQuestion] = useState<{ text: string; readings: Reading[] } | null>(null);
  const [lastPath, setLastPath] = useState<Path | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [text, setText] = useState("");

  // DATA → COMPUTE: reintent's values in this context, then coordinates.
  const { values, asks } = useMemo(() => computeValues(state), [state]);
  const pic = useMemo(() => realize(state, values), [state, values]);
  const screen = (Object.keys(SCREENS) as ScreenId[]).find((k) => SCREENS[k].width === state.ctx.screen.width) ?? "phone";
  const prevXml = history.length > 1 ? toXml(history[history.length - 2]) : toXml(state);
  const xml = toXml(state);

  // A lazy effect: a thing the model added is drawn by a model, later. Until then, code's placeholder.
  // Written worlds are a cache beside the state (never stored in the tree), each with what it was written under.
  const [written, setWritten] = useState<{ world: string; under: Record<string, string> }[]>([]);
  const drawing = useMemo(() => R.effect({ eager: () => "placeholder", cache: () => written }), [written]);

  const apply = (actions: Action[]) => setHistory((h) => [...h, actions.reduce(reduce, h[h.length - 1])]);
  const label = (node: string, intent: string, kind: string) => state.tree.nodes.find((n) => n.id === node)?.intents[intent]?.kinds[kind]?.label[locale] ?? kind;
  const describe = (r: Reading) => `${r.node}.${r.intent} = ${label(r.node, r.intent, r.kind)}`;
  const say = (ev: Event) =>
    ev.type === "prompt"
      ? `${S.of} ${ev.node ?? S.scene}：「${ev.text}」`
      : ev.type === "drag" && ev.target === "man"
        ? `drag man → (${ev.to.map((v) => Math.round(v)).join(", ")})`
        : ev.type === "drag"
          ? `drag wardrobe.door → ${Math.round(ev.open * 100)}%`
          : `resize → ${ev.screen.width}×${ev.screen.height}`;

  // The event callback: recognize, then one of the four paths. Every path ends in the reducer.
  const onEvent = async (ev: Event) => {
    const before = live.current;
    const pre: Action[] = ev.type === "prompt" ? [{ type: "context", ctx: { prompts: [...before.ctx.prompts, ev.text] } }] : [];
    const r = recognize(ev, before.tree, computeValues(before).values);
    const id = ++seq.current;
    setLastPath(r.path);
    if (r.path === "resolve" || r.path === "context") {
      const actions = [...pre, ...r.actions];
      const after = actions.reduce(reduce, before);
      apply(actions);
      setLog((l) => [
        { id, event: say(ev), path: r.path, detail: r.path === "context" ? S.resized(`${after.ctx.screen.width}×${after.ctx.screen.height}`) : S.hit(describe(r.reading!)), ...diff(toXml(before), toXml(after)) },
        ...l,
      ]);
      return;
    }
    if (r.path === "ask") {
      if (pre.length) apply(pre);
      setQuestion({ text: ev.type === "prompt" ? ev.text : "", readings: r.readings });
      setLog((l) => [{ id, event: say(ev), path: "ask", detail: S.readings(r.readings.length), added: [], removed: [] }, ...l]);
      return;
    }
    // ② No preset reads it: the model looks at the tree and the event (an effect), and a new tree comes back.
    if (pre.length) apply(pre);
    setPending(true);
    setLog((l) => [{ id, event: say(ev), path: "infer", detail: r.why === "new" ? S.newThing : r.why === "edge" ? S.edge : S.miss, observation: observe(before, ev), added: [], removed: [], pending: true }, ...l]);
    const inf = await infer(pre.reduce(reduce, before), ev, r.edge);
    const now = live.current;
    const actions: Action[] = [...(inf.tree ? [{ type: "replace" as const, tree: inf.tree }] : []), ...(inf.then ?? [])];
    const after = actions.reduce(reduce, now);
    if (actions.length) apply(actions);
    setPending(false);
    setLog((l) => l.map((e) => (e.id === id ? { ...e, pending: false, note: inf.note[locale], observation: inf.observation, ...diff(toXml(now), toXml(after)) } : e)));
    if (inf.draw) {
      // It asks for the thing to be drawn; the drawing is cached, never thrown away (undo, redo: it is back).
      const world = inf.draw;
      setTimeout(() => setWritten((w) => (w.some((x) => x.world === world) ? w : [{ world, under: {} }, ...w])), LATENCY * 1.4);
    }
  };

  // The view's own temporary state: what a drag looks like before it is an event.
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ target: "man"; at: Pt; offset: Pt } | { target: "door"; open: number } | null>(null);
  const toScene = (e: ReactPointerEvent): Pt => {
    const svg = box.current?.querySelector("svg");
    const m = svg?.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  const doorFrom = (x: number) => Math.max(0, Math.min(0.85, (358 - x) / 72) * 0.85);
  const down = (e: ReactPointerEvent) => {
    if (pending) return;
    const path = (e.target as Element).closest("[data-sem]")?.getAttribute("data-sem") ?? "";
    const p = toScene(e);
    if (path.startsWith("man")) {
      setDrag({ target: "man", at: pic.man.at, offset: [pic.man.at[0] - p[0], pic.man.at[1] - p[1]] });
      setTarget("man");
    } else if (path.startsWith("wardrobe.door.right")) {
      setDrag({ target: "door", open: doorFrom(p[0]) });
      setTarget("wardrobe");
    } else return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag) return;
    const p = toScene(e);
    setDrag(drag.target === "man" ? { ...drag, at: [p[0] + drag.offset[0], p[1] + drag.offset[1]] } : { target: "door", open: doorFrom(p[0]) });
  };
  const up = () => {
    if (!drag) return;
    const ev: Event = drag.target === "man" ? { type: "drag", target: "man", to: drag.at } : { type: "drag", target: "door", open: drag.open };
    setDrag(null);
    void onEvent(ev);
  };

  const man = drag?.target === "man" ? { ...pic.man, at: drag.at, scale: depth(drag.at[1]), inside: false, lean: 0 } : pic.man;
  const door = drag?.target === "door" ? drag.open : pic.door;
  const manEl = (
    <Man
      instance={man.inside ? "wardrobe" : "bedside"}
      hatScale={man.hatScale}
      eyes={man.eyes}
      transform={`translate(${man.at[0].toFixed(1)} ${man.at[1].toFixed(1)}) rotate(${man.lean}) scale(${man.scale.toFixed(3)})`}
    />
  );
  const lamp = pic.extra.find((x) => x.id === "lamp");
  const lampDrawn = lamp ? drawing({}).source === "written" : false;
  const learned = state.tree.nodes.reduce((n, x) => n + (x.learned ? 1 : 0) + Object.values(x.intents).reduce((m, i) => m + Object.values(i.kinds).filter((k) => k.learned).length, 0), 0);

  const actions = (
    <>
      <LabButton disabled={history.length < 2 || pending} onClick={() => setHistory((h) => h.slice(0, -1))}>
        <Undo2 />
        {S.undo}
      </LabButton>
      <LabButton
        disabled={history.length < 2 || pending}
        onClick={() => {
          setHistory([INITIAL]);
          setLog([]);
          setQuestion(null);
          setLastPath(null);
        }}
      >
        <RotateCcw />
        {S.reset}
      </LabButton>
    </>
  );

  const panel = (
    <div className="divide-y divide-border/60">
      <section className="space-y-2 p-4">
        <h3 className={TYPE.label}>{S.tree}</h3>
        <p className={TYPE.caption}>{S.treeNote}</p>
        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-2.5 font-mono text-[10.5px] leading-[1.55] text-foreground">
          {xml.split("\n").map((line, i) => (
            <div key={i} className={cn(!prevXml.split("\n").includes(line) && "bg-amber-500/20")}>
              {line}
            </div>
          ))}
        </pre>
      </section>
      <section className="space-y-2 p-4">
        <h3 className={TYPE.label}>{S.now}</h3>
        <div className="grid gap-1">
          {Object.values(values).map((v) => (
            <ValueRow key={v.key} v={v} S={S} label={label} onForget={v.source === "person" && v.intent !== "frame" ? () => apply([{ type: "forget", node: v.node, intent: v.intent }]) : undefined} />
          ))}
        </div>
      </section>
      <section className="space-y-2 p-4">
        <h3 className={TYPE.label}>{S.events}</h3>
        <p className={TYPE.caption}>{S.eventsNote}</p>
        {log.length === 0 && <p className={cn(TYPE.rowMeta, "text-[11px]")}>{S.noEvents}</p>}
        <div className="space-y-3">
          {log.map((e) => (
            <div key={e.id} className="space-y-1 rounded-lg border border-border/60 p-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-foreground">{e.event}</span>
                <PathBadge path={e.path} label={S.paths[e.path]} />
              </div>
              <div className={cn(TYPE.rowMeta, "text-[11px]")}>{e.pending ? S.thinking : e.detail}</div>
              {e.note && <div className="text-[12px] leading-snug text-foreground">{e.note}</div>}
              {(e.added.length > 0 || e.removed.length > 0) && (
                <pre className="overflow-x-auto font-mono text-[10px] leading-[1.5]">
                  {e.removed.map((l, i) => (
                    <div key={`r${i}`} className="text-red-600 dark:text-red-400">- {l.trim()}</div>
                  ))}
                  {e.added.map((l, i) => (
                    <div key={`a${i}`} className="text-emerald-700 dark:text-emerald-400">+ {l.trim()}</div>
                  ))}
                </pre>
              )}
              {e.observation && (
                <details>
                  <summary className={cn(TYPE.rowMeta, "cursor-pointer text-[11px]")}>{S.observation}</summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px] leading-[1.45]">{e.observation}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <LabShell lab="intents" layout="workbench" meta={<span className={TYPE.rowMeta}>{S.meta(log.length, learned)}</span>} actions={actions} panel={panel}>
      <LabSection title={S.loop} note={S.loopNote}>
        <Flow S={S} path={lastPath} pending={pending} />
      </LabSection>

      <LabSection
        title={S.stage}
        note={S.stageNote}
        aside={
          <div className="flex flex-wrap items-center gap-1.5">
            {(["fill", "whole"] as const).map((k) => (
              <LabChip
                key={k}
                on={values["frame|scene"]?.kind === k}
                onClick={() => {
                  // A preset edit: reintent moves the framing's crossover to this screen's shape.
                  const before = live.current;
                  const action: Action = { type: "frame", decision: frameDecision(before, k) };
                  const after = reduce(before, action);
                  apply([action]);
                  setLastPath("resolve");
                  setLog((l) => [{ id: ++seq.current, event: `switch frame → ${k}`, path: "resolve", detail: S.hit(`frame = ${k}`), ...diff(toXml(before), toXml(after)) }, ...l]);
                }}
              >
                {S.frames[k]}
              </LabChip>
            ))}
            <span className="px-1 text-muted-foreground">·</span>
            {(Object.keys(SCREENS) as ScreenId[]).map((id) => (
              <LabChip
                key={id}
                on={screen === id}
                onClick={() => void onEvent({ type: "resize", screen: { id, width: SCREENS[id].width, height: SCREENS[id].height } })}
              >
                {S.screens[id]}
              </LabChip>
            ))}
          </div>
        }
      >
        <div className="flex flex-wrap items-start gap-6">
          <div
            ref={box}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setDrag(null)}
            className={cn("relative shrink-0 touch-none select-none overflow-hidden rounded-2xl bg-black ring-1 ring-border/60", drag ? "cursor-grabbing" : "cursor-grab")}
            style={{ width: SCREENS[screen].box.w, height: SCREENS[screen].box.h }}
          >
            <Stage width={390} height={844} fit={pic.fit} className="absolute inset-0" style={{ width: "100%", height: "100%" }} svg={{ style: { filter: DREAM, background: "#05070d" } }}>
              <BedroomDefs />
              <Room />
              <Window />
              <WardrobeBox openLeft={0} openRight={door}>
                {man.inside && manEl}
              </WardrobeBox>
              {!man.inside && manEl}
              {lamp && <LampView at={lamp.at} scale={lamp.scale} on={lamp.on} drawn={lampDrawn} label={S.drawing} />}
              <Bed />
            </Stage>
            {pending && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 text-center font-mono text-[11px] text-white/85">
                {S.thinking}
              </div>
            )}
          </div>

          <div className="min-w-[16rem] max-w-md flex-1 space-y-5">
            {/* What is asked: the model unsure on an intent that asks, or a sentence with more than one reading. */}
            {(asks.length > 0 || question) && (
              <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/[0.07] p-3">
                <div className={TYPE.label}>{S.asks}</div>
                {question && (
                  <div className="space-y-2">
                    <p className="text-sm text-foreground">{S.asksRecognizer(question.text)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {question.readings.map((r) => (
                        <LabButton
                          key={`${r.node}.${r.intent}.${r.kind}`}
                          tone="primary"
                          onClick={() => {
                            apply([{ type: "decide", node: r.node, intent: r.intent, kind: r.kind, from: "answered" }]);
                            setQuestion(null);
                            setLastPath("resolve");
                            setLog((l) => [{ id: ++seq.current, event: `「${question.text}」`, path: "resolve", detail: S.answered(describe(r)), added: [], removed: [] }, ...l]);
                          }}
                        >
                          {describe(r)}
                        </LabButton>
                      ))}
                    </div>
                  </div>
                )}
                {asks.map((c) => {
                  const [intent, node] = c.key.split("|");
                  const i = state.tree.nodes.find((n) => n.id === node)!.intents[intent];
                  return (
                    <div key={c.key} className="space-y-2">
                      <p className="text-sm text-foreground">
                        {S.asksModel} <span className="font-medium">{i.label[locale]}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.kinds.map((k) => (
                          <LabButton
                            key={k}
                            tone="primary"
                            onClick={() => {
                              apply([{ type: "decide", node, intent, kind: k, from: "answered" }]);
                              setLastPath("resolve");
                              setLog((l) => [{ id: ++seq.current, event: `${node}.${intent}?`, path: "resolve", detail: S.answered(label(node, intent, k)), added: [], removed: [] }, ...l]);
                            }}
                          >
                            {i.kinds[k].label[locale]} · {Math.round((values[c.key]?.p[k] ?? 0) * 100)}%
                          </LabButton>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <div className={TYPE.label}>{S.say}</div>
              <p className={TYPE.caption}>{S.sayNote}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={cn(TYPE.rowMeta, "text-[11px]")}>{S.of}</span>
                {[null, ...state.tree.nodes.map((n) => n.id)].map((id) => (
                  <LabChip key={id ?? "scene"} on={target === id} onClick={() => setTarget(id)}>
                    {id ? state.tree.nodes.find((n) => n.id === id)!.label[locale] : S.scene}
                  </LabChip>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!text.trim() || pending) return;
                  void onEvent({ type: "prompt", text: text.trim(), node: target });
                  setText("");
                }}
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={S.placeholder}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-1.5 text-sm outline-none focus:border-foreground/40"
                />
                <LabButton tone="primary" type="submit" disabled={pending}>
                  <Send />
                  {S.send}
                </LabButton>
              </form>
              <div className="flex flex-wrap gap-1">
                {S.tries.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={pending}
                    onClick={() => void onEvent({ type: "prompt", text: t, node: target })}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </LabSection>
    </LabShell>
  );
}

// -----------------------------------------------------------------------------

function ValueRow({ v, S, label, onForget }: { v: Value; S: IntentsStrings; label: (n: string, i: string, k: string) => string; onForget?: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="font-mono text-[11px] text-muted-foreground">
        {v.node}.{v.intent}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-foreground">{v.intent === "frame" ? v.kind : label(v.node, v.intent, v.kind)}</span>
        <PathBadge path={v.source === "person" ? "resolve" : v.source === "ask" ? "ask" : "context"} label={`${S.sources[v.source]}${v.from ? ` · ${v.from}` : ""}`} />
        {onForget && (
          <button type="button" onClick={onForget} className={cn(TYPE.rowMeta, "text-[10px] hover:text-foreground")}>
            {S.forget}
          </button>
        )}
      </span>
    </div>
  );
}

function PathBadge({ path, label }: { path: Path; label: string }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded px-1.5 font-mono text-[10px] leading-4",
        path === "resolve" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        path === "infer" && "bg-violet-500/15 text-violet-700 dark:text-violet-300",
        path === "ask" && "bg-amber-500/20 text-amber-700 dark:text-amber-300",
        path === "context" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** The loop, with the last event's path lit. */
function Flow({ S, path, pending }: { S: IntentsStrings; path: Path | null; pending: boolean }) {
  const lit: Record<Path, string[]> = {
    resolve: ["event", "recognizer", "resolve", "tree", "compute", "view"],
    infer: ["event", "recognizer", "infer", "model", "tree", "compute", "view"],
    ask: ["event", "recognizer", "ask"],
    context: ["event", "context", "compute", "view"],
  };
  const on = (id: string) => !!path && lit[path].includes(id);
  const node = (id: keyof IntentsStrings["flow"], tone?: Path) => (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
        on(id)
          ? tone === "infer"
            ? "border-violet-500 bg-violet-500/15 text-foreground"
            : tone === "ask"
              ? "border-amber-500 bg-amber-500/15 text-foreground"
              : "border-emerald-500 bg-emerald-500/15 text-foreground"
          : "border-border text-muted-foreground",
        pending && id === "model" && "animate-pulse",
      )}
    >
      {S.flow[id]}
    </span>
  );
  const arrow = <span className="text-muted-foreground">→</span>;
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {node("model", "infer")} {arrow} {node("tree")} {arrow} {node("compute")} {arrow} {node("view")} {arrow} {node("event")} {arrow} {node("recognizer")}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-6">
        <span className="text-muted-foreground">↳</span> {node("resolve")} <span className={cn(TYPE.rowMeta, "text-[11px]")}>decide → {S.flow.tree}</span>
        <span className="px-2 text-muted-foreground">|</span>
        {node("ask", "ask")} <span className={cn(TYPE.rowMeta, "text-[11px]")}>→ {S.flow.resolve}</span>
        <span className="px-2 text-muted-foreground">|</span>
        {node("infer", "infer")} <span className={cn(TYPE.rowMeta, "text-[11px]")}>{S.flow.model} → replace → {S.flow.tree}</span>
        <span className="px-2 text-muted-foreground">|</span>
        {node("context")} <span className={cn(TYPE.rowMeta, "text-[11px]")}>→ {S.flow.compute}</span>
      </div>
    </div>
  );
}

/** The lamp a model added: code's placeholder until the model has drawn it. */
function LampView({ at, scale, on, drawn, label }: { at: readonly [number, number]; scale: number; on: boolean; drawn: boolean; label: string }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]}) scale(${scale})`}>
      {drawn ? (
        <>
          <defs>
            <radialGradient id="lampGlow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
            </radialGradient>
          </defs>
          {on && <ellipse cx="0" cy="-60" rx="90" ry="78" fill="url(#lampGlow)" />}
          <rect x="-28" y="-6" width="56" height="10" fill="#141a2c" />
          <rect x="-15" y="-10" width="30" height="5" rx="2" fill="#1d2540" />
          <rect x="-2" y="-52" width="4" height="44" fill="#1d2540" />
          <path d="M -19 -50 L 19 -50 L 12 -78 L -12 -78 Z" fill={on ? "#efd29a" : "#2a3350"} />
        </>
      ) : (
        <>
          <rect x="-22" y="-80" width="44" height="82" fill="none" stroke="#9aa6c8" strokeDasharray="4 3" />
          <text x="0" y="-34" textAnchor="middle" fontSize="9" fill="#9aa6c8" fontFamily="monospace">
            {label}
          </text>
        </>
      )}
    </g>
  );
}
