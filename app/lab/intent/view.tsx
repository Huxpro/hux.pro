"use client";

import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { LabButton, LabChip, LabSection, LabShell, Section, Segmented, useLabStrings } from "@/systems/lab";
import { Hand, RotateCcw, SendHorizontal, Sparkles, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { StageProvider, type Cue, type Params, type StageHost } from "stage";
import {
  acceptAddition,
  acceptAuthoring,
  acceptSelection,
  ask,
  describeGesture,
  lessonOf,
  recognize,
  standInAdd,
  standInSelect,
  weakReads,
  type Addition,
  type Authoring,
  type Found,
  type Hit,
  type LabEvent,
  type Need,
  type Observation,
  type Point,
  type Selection,
} from "./events";
import { DREAM_IDS, DREAMS, type Dream, type DreamId } from "./dreams";
import { useLab, useValue, type Action, type Direction, type IntentView, type Lab } from "./model";
import { SCREENS, tallness, type Screen } from "./screens";
import { INTENT_STRINGS, type IntentStrings } from "./strings";
import type { Dir, Entity, Gesture, IntentNode, Tree, Words } from "./tree";

// =============================================================================
// The Intent Lab: a dream's intents, decided per screen, and changed by
// events.
//
// reintent (packages/reintent, from airtalk) is the intent tier over a stage
// scene. The state is an intent tree (./tree.ts) and what people decided
// over it; every screen's props are computed from it. Everything that
// changes it is an event (./events.ts): a switch in the panel, an answer, a
// drag on the dream, a prompt about one thing on it. A preset recognises an
// event and acts at once (①, Flux); an event none recognises goes to a model,
// which observes the tree and the event and writes the action (②, ReAct).
//
// Everything drawn is a real dream's scene (./dreams.ts: /dream/forget,
// /dream/everyone, /dream/blue), boxed at each screen's size, giving the same
// scripted performance. Nothing here knows which: the drop zones, directions
// and previews are all read off the dream's intent tree.
// =============================================================================

const scopeOf = (dream: Dream) => `${dream.id}/`;

/** The dream at a screen's size, shown at `scale`, with that screen's props over its scene. */
function DreamBox({
  dream,
  lab,
  screen,
  scale,
  inert,
  onHost,
  override,
  replay,
  still,
  className,
  children,
}: {
  dream: Dream;
  lab: Lab;
  screen: Screen;
  scale: number;
  /** It only performs; a tap on it is its tile's. */
  inert?: boolean;
  onHost?: (host: StageHost) => void;
  /** What it would be (a preview): shown instead, and moved to, not jumped to. */
  override?: Params;
  /** A preview of a moment: perform it again, from the start, with this. */
  replay?: Cue[];
  /** Hands on it: it waits at its start, with its things where a hand can find them, rather than perform. */
  still?: boolean;
  className?: string;
  /** Laid over it, at its shown size (the hand-editing overlay). */
  children?: ReactNode;
}) {
  const { locale } = useLocale();
  const live = useValue(lab.params(screen));
  const params = override ?? live;
  // A moment previewed is performed again from the start; and so is the dream's own performance, after.
  const [host, setHost] = useState<StageHost | null>(null);
  const hosted = useCallback(
    (h: StageHost) => {
      setHost(h);
      onHost?.(h);
    },
    [onHost],
  );
  const replayKey = replay ? JSON.stringify(replay) : still ? "still" : "";
  const performed = useRef(replayKey);
  useEffect(() => {
    if (!host || performed.current === replayKey) return;
    performed.current = replayKey;
    host.reset();
  }, [host, replayKey]);
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl border border-border/60", className)}
      style={{ width: screen.w * scale, height: screen.h * scale, background: dream.background }}
    >
      <div
        className={cn("absolute left-0 top-0 origin-top-left", inert && "pointer-events-none")}
        style={{ width: screen.w, height: screen.h, transform: `scale(${scale})` }}
      >
        {/* A preview's numbers glide (the host's morph); its kinds' own discrete changes move themselves. */}
        <StageProvider locale={locale} onWake={() => {}} box params={params} script={replay ?? (still ? [] : dream.script)} loop={dream.loop} morph={0.6} onHost={hosted}>
          <dream.Scene />
        </StageProvider>
      </div>
      {children}
    </div>
  );
}

/** The width an element has, kept up to date. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** What is under a point on a stage (its own px): the first of the dream's things in its order (a member of a population it names as that member; a part as what it is part of). */
function hitAt(dream: Dream, host: StageHost, p: Point): Hit {
  const scope = scopeOf(dream);
  const local = host.layer
    .at(p.x, p.y, undefined, { slop: 6 })
    .filter((id) => id.startsWith(scope))
    .map((id) => id.slice(scope.length));
  for (const thing of dream.hitOrder) {
    // A member only where the dream has intents per member (forget's moments; not the globe's lights).
    const member = dream.members?.[thing] && local.find((id) => id.startsWith(`${thing}#`));
    if (member) return { id: thing, member: Number(member.split("#")[1]) };
    if (local.includes(thing)) return { id: dream.partOf?.[thing] ?? thing };
  }
  return { id: null };
}

/** The things on the stage whose shapes hold a point (its own px). */
function within(dream: Dream, host: StageHost, p: Point): string[] {
  const scope = scopeOf(dream);
  const snap = host.layer.snapshot();
  return snap.order
    .filter((id) => id.startsWith(scope) && snap.nodes[id].visible && snap.nodes[id].backend !== "dom")
    .filter((id) => {
      const b = snap.nodes[id].bounds;
      return !!b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    })
    .map((id) => id.slice(scope.length))
    .filter((id) => !id.includes("#") && id !== dream.id);
}

/** The things on the stage, as a model is told about them: their knobs as the scene wrote them. */
function entitiesOf(dream: Dream, host: StageHost): Entity[] {
  return host.ids().flatMap((id) => {
    const w = host.written(id);
    if (!w?.def.params) return [];
    const params = Object.fromEntries(
      Object.entries(w.def.params as Record<string, object>).map(([k, spec]) => [k, { value: w.props[k], ...spec }]),
    );
    return [
      {
        id,
        kind: w.def.kind,
        intent: (w.props.intent as string) ?? w.def.intent,
        names: (w.props.names as string[]) ?? w.def.names ?? [],
        params,
        ...(dream.members?.[id] ? { members: dream.members[id].en } : {}),
      },
    ];
  });
}

function hitWords(dream: Dream, h: Hit, locale: "en" | "zh") {
  const members = h.id ? dream.members?.[h.id] : undefined;
  if (members && h.member !== undefined) return members[locale][h.member];
  return h.id ? (dream.things[h.id]?.[locale] ?? h.id) : dream.ground[locale];
}

type LogEntry = {
  id: number;
  what: string;
  route: "vocab" | "select" | "add" | "author";
  by: string;
  status: "pending" | "done" | "none" | "rejected" | "failed";
  why?: Words;
  problems?: string[];
  learned?: string;
  /** Knobs the strong model said the stage lacks for this. */
  needs?: Need[];
  ms?: number;
};

function Who({ v, S }: { v: IntentView; S: IntentStrings }) {
  const mark = v.who === "person" ? "●" : v.who === "model" ? "◐" : v.who === "pref" ? "◉" : "○";
  const words =
    v.node.index && v.who === "model" && v.where === "code"
      ? S.whoWhere
      : v.who === "person" && v.how
        ? `${S.who.person} · ${S.how[v.how] ?? v.how}`
        : S.who[v.who];
  return (
    <span className="font-mono text-[10px] text-muted-foreground">
      {mark} {words}
    </span>
  );
}

/** The intent decided by the screen's shape, if the tree has one. */
function indexedKey(tree: Tree): string | null {
  const n = tree.find((x) => x.index);
  return n ? `${n.type}|${n.of}` : null;
}

/** Which side of the crossing a screen is on: its tall kind, or the other. */
const glyph = (v: IntentView | null) => (v ? (v.kind === v.node.index?.base ? "▯" : "▭") : "");

/** Screens by shape, wide to tall, each marked with the kind it gets; and where it crosses over. */
function ShapeRuler({ lab, k, focus, onFocus, S }: { lab: Lab; k: string; focus: Screen; onFocus: (s: Screen) => void; S: IntentStrings }) {
  const stored = useValue(lab.stored);
  const at = (stored[k]?.pick as { at?: number } | undefined)?.at;
  // A log scale of tallness, from a little wider than the widest to a little taller than the tallest.
  const lo = Math.log(0.35);
  const hi = Math.log(2.6);
  const x = (t: number) => `${((Math.log(t) - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="space-y-2">
      <div className="relative h-24 rounded-xl bg-muted/40">
        {typeof at === "number" && (
          <div className="absolute inset-y-2 w-px bg-foreground" style={{ left: x(at) }}>
            <span className="absolute -top-0.5 left-1.5 whitespace-nowrap font-mono text-[10px] text-foreground">{at.toFixed(3)}</span>
          </div>
        )}
        {[...SCREENS]
          .sort((a, b) => tallness(a) - tallness(b))
          .map((s, i) => (
            <RulerDot
              key={s.id}
              lab={lab}
              k={k}
              screen={s}
              left={x(tallness(s))}
              // Neighbours' names alternate above and below the line, so close shapes do not collide.
              above={i % 2 === 1}
              on={s.id === focus.id}
              onClick={() => onFocus(s)}
              S={S}
            />
          ))}
      </div>
      <p className={TYPE.captionQuiet}>{typeof at === "number" ? S.crossAt(at.toFixed(3)) : S.crossCode}</p>
    </div>
  );
}

function RulerDot({
  lab,
  k,
  screen,
  left,
  above,
  on,
  onClick,
  S,
}: {
  lab: Lab;
  k: string;
  screen: Screen;
  left: string;
  above: boolean;
  on: boolean;
  onClick: () => void;
  S: IntentStrings;
}) {
  const v = useValue(lab.view(k, screen));
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${S.screens[screen.id]} · ${screen.w}×${screen.h}`}
      className={cn(
        "absolute top-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-md px-1 font-mono text-[10px]",
        above ? "-translate-y-[calc(100%-0.5rem)] flex-col-reverse" : "-translate-y-2 flex-col",
        on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      style={{ left }}
    >
      <span className="flex size-4 items-center justify-center rounded-full border border-current bg-background text-[11px] leading-none">
        {glyph(v)}
      </span>
      <span className={cn("whitespace-nowrap", on && "underline underline-offset-2")}>{S.short[screen.id] ?? S.screens[screen.id]}</span>
    </button>
  );
}

function Tile({
  dream,
  indexed,
  lab,
  screen,
  on,
  onClick,
  override,
  replay,
  S,
}: {
  dream: Dream;
  /** The intent the screen's shape decides, named under each tile. */
  indexed: string | null;
  lab: Lab;
  screen: Screen;
  on: boolean;
  onClick: () => void;
  override?: Params;
  replay?: Cue[];
  S: IntentStrings;
}) {
  const { locale } = useLocale();
  const axis = useValue(lab.view(indexed ?? "", screen));
  const live = useValue(lab.params(screen));
  // Under a preview, the screens it would change say so.
  const changes = !!override && JSON.stringify(override) !== JSON.stringify(live);
  const scale = 132 / screen.h;
  // The dream has buttons of its own (the way out), so the tile is a div and its button lies over it.
  return (
    <div className="group relative flex flex-col items-start gap-1.5 text-left">
      <DreamBox
        dream={dream}
        lab={lab}
        screen={screen}
        scale={scale}
        inert
        override={override}
        replay={changes ? replay : undefined}
        className={cn(
          "transition-shadow",
          on ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "group-hover:ring-1 group-hover:ring-border",
          changes && !on && "ring-2 ring-foreground/40 ring-offset-2 ring-offset-background",
        )}
      />
      <span className="flex flex-col">
        <span className="text-xs text-foreground">
          {S.screens[screen.id]}
          {changes && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">· {S.changes}</span>}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {screen.w}×{screen.h}
          {axis && ` · ${glyph(axis)} ${axis.node.kinds[axis.kind].words[locale]}`}
        </span>
      </span>
      <button type="button" onClick={onClick} aria-label={S.screens[screen.id]} aria-pressed={on} className="absolute inset-0 rounded-xl" />
    </div>
  );
}

function IntentRow({ lab, k, screen, S }: { lab: Lab; k: string; screen: Screen; S: IntentStrings }) {
  const { locale } = useLocale();
  const v = useValue(lab.view(k, screen));
  if (!v) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{v.node.words[locale]}</span>
        <span className="flex items-baseline gap-2">
          <Who v={v} S={S} />
          {v.who === "person" && (
            <button
              type="button"
              onClick={() => lab.dispatch({ type: "forget", key: k })}
              className="font-mono text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              {S.forget}
            </button>
          )}
        </span>
      </div>
      <Segmented
        value={v.kind}
        options={Object.entries(v.node.kinds).map(([kind, kn]) => ({ value: kind, label: kn.words[locale] + (v.asks && kind === v.kind ? " ?" : "") }))}
        onChange={(kind) => kind !== v.kind && lab.dispatch({ type: "decide", key: k, kind, from: "switched", screen })}
      />
      <Vocabulary node={v.node} locale={locale} S={S} />
    </div>
  );
}

/** What a person says and does that means each kind: the short path the model wrote. */
function Vocabulary({ node, locale, S }: { node: IntentView["node"]; locale: "en" | "zh"; S: IntentStrings }) {
  const lines = Object.keys(node.kinds)
    .map((kind) => {
      const said = (node.say?.[kind] ?? []).slice(0, 4).map((p) => `“${p}”`);
      const done = (node.gestures?.[kind] ?? []).map(describeGesture);
      return said.length || done.length ? `${node.kinds[kind].words[locale]} ${S.vocab}: ${[...said, ...done].join(" · ")}` : null;
    })
    .filter(Boolean);
  if (!lines.length) return null;
  return <p className="whitespace-pre-line font-mono text-[10px] leading-relaxed text-tertiary-foreground">{lines.join("\n")}</p>;
}

function Questions({ lab, screen, S }: { lab: Lab; screen: Screen; S: IntentStrings }) {
  const { locale } = useLocale();
  const qs = useValue(lab.questions(screen));
  const tree = useValue(lab.tree);
  if (!qs.length) return null;
  return (
    <Section title={S.asking}>
      {qs.map((k) => {
        const node = tree.find((n) => `${n.type}|${n.of}` === k);
        if (!node) return null;
        return (
          <div key={k} className="flex flex-col gap-3">
            <p className="text-sm text-foreground">{(node.question ?? node.words)[locale]}</p>
            <p className={TYPE.captionQuiet}>{S.questionNote}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(node.kinds).map(([kind, kn]) => (
                <LabButton key={kind} tone="primary" onClick={() => lab.dispatch({ type: "decide", key: k, kind, from: "asked", screen })}>
                  {kn.words[locale]}
                </LabButton>
              ))}
            </div>
          </div>
        );
      })}
    </Section>
  );
}

/** What the strong model said the stage lacks: past the intent tree, work for the kinds' code. */
function Needs({ log, S }: { log: LogEntry[]; S: IntentStrings }) {
  const seen = new Map<string, { n: Need; asked: string[] }>();
  for (const e of log)
    for (const n of e.needs ?? []) {
      const k = `${n.of}.${n.knob}`;
      const had = seen.get(k);
      if (had) had.asked.push(e.what);
      else seen.set(k, { n, asked: [e.what] });
    }
  if (!seen.size) return null;
  return (
    <Section title={S.needsTitle}>
      <p className={TYPE.captionQuiet}>{S.needsNote}</p>
      <Code>
        {[...seen.entries()]
          .map(([k, { n, asked }]) => `${n.new ? "+ " : ""}${k}${n.note ? `  // ${n.note}` : ""}\n  ← ${asked.join(" · ")}`)
          .join("\n")}
      </Code>
    </Section>
  );
}

/** What would be kept beside the scene: a person's decisions and the intents a model wrote, one element each, literals only. */
function Stored({ lab, S }: { lab: Lab; S: IntentStrings }) {
  const stored = useValue(lab.stored);
  const written = useValue(lab.written);
  const lines = [
    ...written.map((n) => `<Intent id="${n.type}" of="${n.of}" kinds="${Object.keys(n.kinds).join(" ")}" from="model" />`),
    ...Object.entries(stored).map(([key, d]) => {
      const [type, of] = key.split("|");
      const pick = d.pick as string | { base: string; below: string | null; at: number };
      const attrs =
        typeof pick === "string" ? `pick="${pick}"` : `base="${pick.base}"${pick.below ? ` below="${pick.below}"` : ""} at={${pick.at}}`;
      return `<Decision of="${type}|${of}" ${attrs} from="${d.from ?? "resolved"}" />`;
    }),
  ];
  return (
    <Section title={S.stored}>
      <p className={TYPE.captionQuiet}>{S.storedNote}</p>
      <Code>{lines.length ? lines.join("\n") : S.nothingStored}</Code>
    </Section>
  );
}

function Props({ lab, screen, S }: { lab: Lab; screen: Screen; S: IntentStrings }) {
  const params = useValue(lab.params(screen));
  const lines = Object.entries(params).map(
    ([node, props]) => `${node}: ${Object.entries(props).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ")}`,
  );
  return (
    <Section title={S.props}>
      <p className={TYPE.captionQuiet}>{S.propsNote}</p>
      <Code>{lines.join("\n")}</Code>
    </Section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
      {children}
    </pre>
  );
}

/** A drop zone: one gesture in the vocabulary that a drag from here could be, and what it would mean. */
type Zone = { key: string; kind: string; label: string; kindWords: string; how: string; g: Gesture; rect: [number, number, number, number] | null };

const ARROW: Record<Dir, [number, number][]> = {
  up: [[0, -1]],
  down: [[0, 1]],
  left: [[-1, 0]],
  right: [[1, 0]],
  horizontal: [[-1, 0], [1, 0]],
  vertical: [[0, -1], [0, 1]],
};

/** A thing's box on the stage now (its own px). */
function boxOf(dream: Dream, host: StageHost, id: string): [number, number, number, number] | null {
  const b = host.layer.snapshot().nodes[`${scopeOf(dream)}${id}`]?.bounds;
  return b ? [b.x, b.y, b.w, b.h] : null;
}

/** Every gesture in the tree's vocabulary that a drag from here could still be: the drop zones it has. */
function zonesFrom(dream: Dream, tree: Tree, start: Hit, inside: string[], host: StageHost, locale: "en" | "zh", S: IntentStrings): Zone[] {
  const subject = start.id && start.member !== undefined ? `${start.id}#${start.member}` : start.id;
  const name = (x: string, node: IntentNode) => {
    const id = x === "self" ? node.of.split("#")[0] : x;
    return dream.things[id]?.[locale] ?? id;
  };
  const out: Zone[] = [];
  for (const node of tree)
    for (const [kind, gs] of Object.entries(node.gestures ?? {}))
      for (const g of gs) {
        if (g.from === "self" ? subject !== node.of : start.id !== g.from) continue;
        const place = g.outOf ?? g.into;
        const where = place === "self" ? node.of.split("#")[0] : place;
        // Out of a shape it did not start in, or into one it already is in: not a way this drag can go.
        if ((g.outOf && !inside.includes(where!)) || (g.into && inside.includes(where!))) continue;
        const how = g.outOf ? S.outOf(name(g.outOf, node)) : g.into ? S.into(name(g.into, node)) : S.dirs[g.dir!];
        out.push({
          key: `${node.type}|${node.of}`,
          kind,
          label: `${node.words[locale]} → ${node.kinds[kind].words[locale]}`,
          kindWords: node.kinds[kind].words[locale],
          how,
          g,
          rect: where ? boxOf(dream, host, where) : null,
        });
      }
  return out;
}

/**
 * Hands on the dream: a drag is an event (from what, to where); a tap picks
 * what a prompt is about. While a drag is under way, every gesture the tree's
 * vocabulary has from where it started is drawn as a drop zone with its
 * name, the one it would be is lit, and what it would do is previewed
 * (`onAim`). Laid over the focused box, in its shown px; the stage's own px
 * are those over `scale`.
 */
function Hands({
  dream,
  host,
  width,
  scale,
  tree,
  picked,
  onPick,
  onAim,
  onDrag,
  S,
}: {
  dream: Dream;
  host: StageHost | null;
  /** The stage's own width, and the scale it is shown at. */
  width: number;
  scale: number;
  tree: Tree;
  picked: Hit;
  onPick: (h: Hit) => void;
  onAim: (found: Found | null) => void;
  onDrag: (from: Point & Hit, to: Point & Hit, inside: { from: string[]; to: string[] }) => void;
  S: IntentStrings;
}) {
  const { locale } = useLocale();
  const [line, setLine] = useState<{ a: Point; b: Point } | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [aim, setAim] = useState<Found | null>(null);
  const start = useRef<(Point & Hit) | null>(null);
  const startWithin = useRef<string[]>([]);
  const outline = useRef<HTMLDivElement>(null);
  const shownW = width * scale;
  const local = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };
  const end = () => {
    start.current = null;
    setLine(null);
    setZones([]);
    setAim(null);
    onAim(null);
  };
  // What a prompt is about, outlined where it is now (it moves).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = outline.current;
      if (!el) return;
      if (!host || !picked.id) {
        el.style.display = "none";
        return;
      }
      const scope = scopeOf(dream);
      const id = picked.member !== undefined ? `${scope}${picked.id}#${picked.member}` : `${scope}${picked.id}`;
      const sel = host.layer.select(id);
      const shape = sel?.member?.shape ?? sel?.node.shape;
      const b = !shape
        ? null
        : "rect" in shape
          ? shape.rect
          : "circle" in shape
            ? [shape.circle[0] - shape.circle[2], shape.circle[1] - shape.circle[2], shape.circle[2] * 2, shape.circle[2] * 2]
            : null;
      el.style.display = b ? "block" : "none";
      if (b) Object.assign(el.style, { left: `${b[0] * scale - 3}px`, top: `${b[1] * scale - 3}px`, width: `${b[2] * scale + 6}px`, height: `${b[3] * scale + 6}px` });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [dream, host, picked, scale]);
  const far = line && Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) >= 30;
  return (
    <div
      className="absolute inset-0 cursor-crosshair touch-none"
      onPointerDown={(e) => {
        if (!host) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = local(e);
        const hit = hitAt(dream, host, p);
        start.current = { ...p, ...hit };
        startWithin.current = within(dream, host, p);
        setLine({ a: p, b: p });
        setZones(zonesFrom(dream, tree, hit, startWithin.current, host, locale, S));
      }}
      onPointerMove={(e) => {
        const a = start.current;
        if (!a || !host) return;
        const b = local(e);
        setLine({ a, b });
        // The one the drag would be if it ended here: lit, and previewed.
        const found = recognize({ kind: "drag", screen: { id: "", w: 0, h: 0 }, from: a, to: { ...b, ...hitAt(dream, host, b) }, within: { from: startWithin.current, to: within(dream, host, b) } }, tree);
        if (found?.key !== aim?.key || found?.kind !== aim?.kind) {
          setAim(found);
          onAim(found);
        }
      }}
      onPointerUp={(e) => {
        const from = start.current;
        const firstWithin = startWithin.current;
        end();
        if (!from || !host) return;
        const p = local(e);
        if (Math.hypot(p.x - from.x, p.y - from.y) < 8) return onPick({ id: from.id, member: from.member });
        onDrag(from, { ...p, ...hitAt(dream, host, p) }, { from: firstWithin, to: within(dream, host, p) });
      }}
      onPointerCancel={end}
    >
      <div ref={outline} className="pointer-events-none absolute hidden rounded-md border-2 border-dashed" style={{ borderColor: `rgba(${dream.ink}, 0.7)` }} />
      {line &&
        zones.map((z, i) => {
          const lit = aim?.key === z.key && aim?.kind === z.kind;
          // A shape's zone is named in full; an arrow by the kind it leads to (the intent is in the pill when it is aimed at).
          const label = (
            <span
              className={cn(
                "block max-w-[11rem] truncate whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] shadow-sm transition-colors",
                lit ? "bg-foreground text-background" : "bg-background/90 text-foreground",
              )}
            >
              {z.rect ? `${z.how} · ${z.label}` : z.kindWords}
            </span>
          );
          if (z.rect) {
            const [x, y, w, h] = z.rect.map((v) => v * scale);
            // Out of a shape: everything around it is the zone; into it: the shape is.
            return (
              <div
                key={i}
                className={cn("pointer-events-none absolute rounded-xl border-2 transition-all duration-200", !lit && "border-dashed")}
                style={{
                  borderColor: `rgba(${dream.ink}, ${lit ? 1 : 0.4})`,
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  boxShadow: z.g.outOf ? `0 0 0 9999px rgba(${dream.ink}, ${lit ? 0.12 : 0.05})` : undefined,
                  background: z.g.into ? `rgba(${dream.ink}, ${lit ? 0.12 : 0.05})` : undefined,
                }}
              >
                <div className="absolute left-0" style={{ top: z.g.outOf ? -26 - 22 * (i % 2) : 6 + 22 * (i % 2), ...(z.g.into ? { left: 6 } : {}) }}>
                  {label}
                </div>
              </div>
            );
          }
          // A way to go: an arrow from where the drag began, named at its tip.
          return ARROW[z.g.dir!].map(([dx, dy], j) => {
            const L = Math.min(72, shownW * 0.18);
            const [x0, y0] = [line.a.x * scale, line.a.y * scale];
            return (
              <div key={`${i}-${j}`} className="pointer-events-none absolute" style={{ left: x0, top: y0, color: `rgb(${dream.ink})` }}>
                <svg className="absolute overflow-visible" width="1" height="1">
                  <line x1={0} y1={0} x2={dx * L} y2={dy * L} stroke="currentColor" strokeOpacity={lit ? 1 : 0.4} strokeWidth={lit ? 3 : 2} />
                  <circle cx={dx * L} cy={dy * L} r={lit ? 5 : 3.5} fill="currentColor" fillOpacity={lit ? 1 : 0.4} />
                </svg>
                {/* Named at its tip: above a sideways one, past an upright one; kept inside the dream. */}
                <div
                  className="absolute"
                  style={{
                    left: Math.min(Math.max(x0 + dx * L, 48), shownW - 48) - x0,
                    top: dy ? dy * (L + 10) : -10,
                    transform: `translate(-50%, ${dy > 0 ? "0" : "-100%"})`,
                  }}
                >
                  {label}
                </div>
              </div>
            );
          });
        })}
      {line && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ color: `rgb(${dream.ink})` }}>
          <line x1={line.a.x * scale} y1={line.a.y * scale} x2={line.b.x * scale} y2={line.b.y * scale} stroke="currentColor" strokeWidth={2} strokeDasharray="4 3" />
          <circle cx={line.b.x * scale} cy={line.b.y * scale} r={5} fill="currentColor" />
        </svg>
      )}
      {line && far && (
        // Beside the finger, on whichever side has room.
        <div
          className="pointer-events-none absolute"
          style={{
            left: line.b.x * scale + (line.b.x * scale > shownW / 2 ? -12 : 12),
            top: line.b.y * scale + 12,
            transform: line.b.x * scale > shownW / 2 ? "translateX(-100%)" : undefined,
          }}
        >
          <span
            className={cn("block max-w-[14rem] truncate whitespace-nowrap rounded-md px-2 py-1 font-mono text-[11px] shadow-overlay", aim ? "bg-foreground text-background" : "bg-background text-foreground")}
            style={{ maxWidth: Math.max(96, Math.max(line.b.x * scale, shownW - line.b.x * scale) - 20) }}
          >
            {aim ? S.release(zones.find((z) => z.key === aim.key && z.kind === aim.kind)?.label ?? `${aim.key} → ${aim.kind}`) : S.releaseModel}
          </span>
        </div>
      )}
    </div>
  );
}

/** What the model already sees, as one-flip directions: hover (or a first tap) previews on every screen; a click makes it yours. */
function Directions({
  lab,
  screen,
  preview,
  onPreview,
  onApply,
  S,
}: {
  lab: Lab;
  screen: Screen;
  preview: string | null;
  onPreview: (d: Direction | null) => void;
  onApply: (d: Direction) => void;
  S: IntentStrings;
}) {
  const { locale } = useLocale();
  const all = useValue(lab.directions(screen));
  const shown = all.slice(0, 8);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={TYPE.label}>{S.directions}</h3>
      </div>
      <p className={TYPE.captionQuiet}>{S.directionsNote}</p>
      <div className="flex flex-wrap gap-2" onPointerLeave={(e) => e.pointerType === "mouse" && onPreview(null)}>
        {shown.map((d) => {
          const id = `${d.key}=${d.kind}`;
          const on = preview === id;
          return (
            <button
              key={id}
              type="button"
              onPointerEnter={(e) => e.pointerType === "mouse" && onPreview(d)}
              onClick={(e) => {
                // A finger has no hover: its first tap previews, its second makes it yours.
                if ((e.nativeEvent as PointerEvent).pointerType === "touch" && !on) return onPreview(d);
                onApply(d);
              }}
              className={cn(
                "group flex min-w-[9rem] flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-colors",
                on ? "border-foreground bg-foreground text-background" : "border-border/70 bg-background/60 hover:border-foreground/50",
              )}
            >
              <span className={cn("text-[11px]", on ? "text-background/70" : "text-muted-foreground")}>{d.node.words[locale]}</span>
              <span className="text-sm">{d.node.kinds[d.kind].words[locale]}</span>
              <span className="flex w-full items-center gap-2">
                <span className={cn("h-1 flex-1 overflow-hidden rounded-full", on ? "bg-background/30" : "bg-foreground/10")}>
                  <span className={cn("block h-full rounded-full", on ? "bg-background" : "bg-foreground/60")} style={{ width: `${Math.round(d.p * 100)}%` }} />
                </span>
                <span className={cn("font-mono text-[10px]", on ? "text-background/80" : "text-muted-foreground")}>
                  {d.believed ? S.modelSays(d.p) : S.codeSays(d.p)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventLog({ log, S }: { log: LogEntry[]; S: IntentStrings }) {
  const { locale } = useLocale();
  if (!log.length) return <p className={TYPE.captionQuiet}>{S.noEvents}</p>;
  return (
    <ol className="space-y-2">
      {[...log].reverse().map((e) => (
        <li key={e.id} className="rounded-lg border border-border/60 px-3 py-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px]",
                e.route === "vocab" ? "bg-foreground text-background" : e.route === "select" ? "border border-foreground/60 text-foreground" : "border-2 border-foreground text-foreground",
              )}
            >
              {S.route[e.route]}
            </span>
            <span className="text-xs text-foreground">{e.what}</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {e.by} · {S.status[e.status]}
              {e.ms !== undefined ? ` · ${e.ms < 10 ? e.ms.toFixed(1) : Math.round(e.ms)} ms` : ""}
            </span>
          </div>
          {e.why && <p className={cn(TYPE.captionQuiet, "mt-1")}>{e.why[locale]}</p>}
          {e.learned && <p className="mt-0.5 font-mono text-[10px] text-foreground">↺ {S.learned(e.learned)}</p>}
          {e.needs?.map((n) => (
            <p key={`${n.of}.${n.knob}`} className="mt-0.5 font-mono text-[10px] text-foreground">
              ⚙ {n.new ? S.needsThing(n.of, n.knob) : S.needs(`${n.of}.${n.knob}`)}
              {n.note ? ` · ${n.note}` : ""}
            </p>
          ))}
          {e.problems?.map((p, i) => (
            <p key={i} className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              ✗ {p}
            </p>
          ))}
        </li>
      ))}
    </ol>
  );
}

/** The lab, on whichever dream `?dream=` names (forget by default); each dream gets a lab of its own. */
export function IntentLabView({ initial }: { initial?: string }) {
  const [id, setId] = useState<DreamId>(DREAM_IDS.find((d) => d === initial) ?? "forget");
  const choose = (next: DreamId) => {
    setId(next);
    const url = new URL(window.location.href);
    if (next === "forget") url.searchParams.delete("dream");
    else url.searchParams.set("dream", next);
    window.history.replaceState(null, "", url);
  };
  return <DreamLab key={id} dream={DREAMS[id]} onDream={choose} />;
}

function DreamLab({ dream, onDream }: { dream: Dream; onDream: (id: DreamId) => void }) {
  const S = useLabStrings(INTENT_STRINGS);
  const { locale } = useLocale();
  const lab = useLab(dream.preset, dream.beliefs, dream.settle);
  const [focusId, setFocusId] = useState(dream.focus);
  const focus = SCREENS.find((s) => s.id === focusId) ?? SCREENS[0];
  const [stageRef, stageW] = useWidth<HTMLDivElement>();
  const asks = useValue(lab.questions(focus)).length;
  const stored = useValue(lab.stored);
  const written = useValue(lab.written);
  const history = useValue(lab.history);
  const keys = useValue(lab.keys);
  // As large as the column allows, and no taller than most of a laptop's screen.
  const scale = stageW ? Math.min(1, stageW / focus.w, 440 / focus.h) : 0;

  const [hands, setHands] = useState(false);
  const [host, setHost] = useState<StageHost | null>(null);
  const [picked, setPicked] = useState<Hit>({ id: null });
  const [text, setText] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const prompts = useRef<string[]>([]);
  const seq = useRef(0);
  const tree = useValue(lab.tree);

  // A preview: a what-if every screen moves to (a direction hovered, a drop zone aimed at), committed by nothing.
  const [preview, setPreview] = useState<{ id: string; label: string; action: Action } | null>(null);
  const previewOf = useMemo(() => (preview ? lab.whatIf(preview.action) : null), [lab, preview]);
  // A preview of a moment's intent performs that moment again.
  const replay = preview && "key" in preview.action && dream.replay?.keys.includes(preview.action.key) ? dream.replay.script : undefined;
  const previewDirection = (d: Direction | null) =>
    setPreview(
      d
        ? {
            id: `${d.key}=${d.kind}`,
            label: `${d.node.words[locale]} → ${d.node.kinds[d.kind].words[locale]}`,
            action: { type: "decide", key: d.key, kind: d.kind, from: "switched", screen: focus },
          }
        : null,
    );

  const put = (entry: LogEntry) => setLog((l) => [...l.filter((x) => x.id !== entry.id), entry]);

  /**
   * The one callback every event goes through. ① The tree's vocabulary (no
   * model); ② a weak model chooses within the tree, and its choice is learned;
   * ③ when no kind fits, the strong model adds an intent. Each answer is
   * checked before it is dispatched.
   */
  const handle = useCallback(
    async (e: LabEvent, what: string) => {
      const id = ++seq.current;
      const t0 = performance.now();
      const ms = () => performance.now() - t0;
      const found = recognize(e, lab.tree());
      if (found) {
        lab.dispatch({ type: "decide", key: found.key, kind: found.kind, from: e.kind === "drag" ? "dragged" : "prompted", screen: e.screen });
        put({ id, what, route: "vocab", by: "—", status: "done", why: found.why, ms: ms() });
        return;
      }
      const o: Observation = {
        entities: host ? entitiesOf(dream, host) : [],
        tree: lab.tree(),
        decisions: lab.stored(),
        event: e,
        prompts: prompts.current.slice(-5),
      };
      // A drag the vocabulary does not know goes straight to the strong model: a weak text model does not read gestures.
      const sel = weakReads(e)
        ? (put({ id, what, route: "select", by: "…", status: "pending" }), await ask<Selection>("select", o, () => standInSelect(o)))
        : { answer: { action: "none", escalate: true, why: S.gestureToStrong } as Selection, by: "—" };
      if (!sel.answer) return put({ id, what, route: "select", by: sel.by, status: "failed", problems: [sel.error ?? "no answer"], ms: ms() });
      // What a model decided is learned: the next time this is said or done, it is ①.
      const teach = (a: Action): string | undefined => {
        const lesson = lessonOf(e, a, o.tree);
        if (!lesson) return undefined;
        lab.dispatch(lesson);
        const node = o.tree.find((n) => `${n.type}|${n.of}` === lesson.key);
        const how = lesson.phrase ? `“${lesson.phrase.trim().toLowerCase()}”` : describeGesture(lesson.gesture!);
        return `${node?.words[locale] ?? lesson.key} → ${node?.kinds[lesson.kind].words[locale] ?? lesson.kind}: ${how}`;
      };
      const chosen = acceptSelection(sel.answer, o);
      if (chosen.action) {
        lab.dispatch(chosen.action);
        return put({ id, what, route: "select", by: sel.by, status: "done", why: chosen.why, ms: ms() });
      }
      if (!chosen.escalate) {
        return put({ id, what, route: "select", by: sel.by, status: chosen.problems ? "rejected" : "none", why: chosen.why, problems: chosen.problems, ms: ms() });
      }
      put({ id, what, route: "add", by: "…", status: "pending", why: { en: `${sel.by}: ${chosen.why.en} → ${S.escalated}`, zh: `${sel.by}：${chosen.why.zh} → ${S.escalated}` } });
      const add = await ask<Addition>("add", o, () => standInAdd(o));
      if (!add.answer) return put({ id, what, route: "add", by: add.by, status: "failed", problems: [add.error ?? "no answer"], ms: ms() });
      const added = acceptAddition(add.answer, o, add.by);
      if (added.action) lab.dispatch(added.action);
      const learned = added.action && added.action.type === "decide" ? teach(added.action) : undefined;
      put({
        id,
        what,
        route: "add",
        by: `${sel.by} → ${add.by}`,
        status: added.action ? "done" : added.problems ? "rejected" : "none",
        why: { en: `${sel.by}: ${chosen.why.en} → ${added.why.en}`, zh: `${sel.by}：${chosen.why.zh} → ${added.why.zh}` },
        problems: added.problems,
        needs: added.needs,
        learned,
        ms: ms(),
      });
    },
    [dream, lab, host, locale, S],
  );

  /** The strong model writes the whole tree again, from the scene. */
  const reauthor = async () => {
    if (!host) return;
    const id = ++seq.current;
    const t0 = performance.now();
    const entities = entitiesOf(dream, host);
    const scene = host.layer.get(dream.id);
    put({ id, what: S.reauthorWhat, route: "author", by: "…", status: "pending" });
    const cached = (): Authoring => ({
      tree: dream.preset,
      beliefs: Object.entries(dream.beliefs).map(([key, b]) => ({ key, p: b.p })),
      why: "The cached authoring: no model is reachable.",
    });
    const out = await ask<Authoring>("author", { entities, intent: scene?.intent, names: scene?.names }, cached);
    if (!out.answer) return put({ id, what: S.reauthorWhat, route: "author", by: out.by, status: "failed", problems: [out.error ?? "no answer"], ms: performance.now() - t0 });
    const by = out.by === "stand-in" ? dream.authoredBy : out.by;
    const r = acceptAuthoring(out.answer, entities, by);
    if (r.action) lab.dispatch(r.action);
    put({
      id,
      what: S.reauthorWhat,
      route: "author",
      by: out.by,
      status: r.action ? "done" : "rejected",
      why: { en: out.answer.why ?? "", zh: out.answer.why ?? "" },
      problems: (r.problems ?? r.dropped?.map((d) => `dropped ${d}`))?.slice(0, 6),
      ms: performance.now() - t0,
    });
  };
  const authoredBy = tree.find((n) => n.from === "preset")?.by ?? dream.authoredBy;
  const indexed = indexedKey(tree);

  const about = picked.id ? hitWords(dream, picked, locale) : S.everything;
  const send = (ev: FormEvent) => {
    ev.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    const entity = picked.id ? (picked.member !== undefined ? `${picked.id}#${picked.member}` : picked.id) : null;
    void handle({ kind: "prompt", screen: focus, entity, text: t }, S.prompt(about, t));
    prompts.current.push(t);
  };

  const groups: [string, string[]][] = [
    ["", keys.filter((k) => !k.startsWith("keep|") && !written.some((n) => `${n.type}|${n.of}` === k))],
    [S.keepGroup, keys.filter((k) => k.startsWith("keep|"))],
    [S.byModel, written.map((n) => `${n.type}|${n.of}`)],
  ];

  return (
    <LabShell
      lab="intent"
      layout="workbench"
      meta={S.meta(dream.path, SCREENS.length, asks, Object.keys(stored).length, written.length)}
      actions={
        <>
          <Segmented<DreamId>
            value={dream.id}
            options={DREAM_IDS.map((d) => ({ value: d, label: DREAMS[d].path.replace("/dream/", "") }))}
            onChange={onDream}
          />
          <LabButton onClick={lab.undo} disabled={!history.length}>
            <Undo2 /> {S.undo}
          </LabButton>
          <LabButton
            onClick={() => {
              lab.reset();
              setLog([]);
            }}
            disabled={!Object.keys(stored).length && !written.length}
          >
            <RotateCcw /> {S.reset}
          </LabButton>
        </>
      }
      panel={
        <>
          <Questions lab={lab} screen={focus} S={S} />
          <Section title={S.tree}>
            <p className={TYPE.captionQuiet}>{S.treeNote(authoredBy)}</p>
            <div>
              <LabButton tone="primary" onClick={() => void reauthor()} disabled={!host || log.some((l) => l.route === "author" && l.status === "pending")}>
                <Sparkles /> {log.some((l) => l.route === "author" && l.status === "pending") ? S.authoring : S.reauthor}
              </LabButton>
            </div>
          </Section>
          <Section title={S.intents(S.screens[focus.id])}>
            <p className={TYPE.captionQuiet}>{S.intentsNote}</p>
            {groups.map(([title, ks]) =>
              ks.length ? (
                <div key={title || "presets"} className="flex flex-col gap-4">
                  {title && <h3 className={cn(TYPE.label, "pt-2")}>{title}</h3>}
                  {title === S.byModel && <p className={TYPE.captionQuiet}>{S.byModelNote}</p>}
                  {ks.map((k) => (
                    <IntentRow key={k} lab={lab} k={k} screen={focus} S={S} />
                  ))}
                </div>
              ) : null,
            )}
          </Section>
          <Needs log={log} S={S} />
          <Stored lab={lab} S={S} />
          <Props lab={lab} screen={focus} S={S} />
        </>
      }
    >
      <LabSection
        title={`${S.focus} · ${S.screens[focus.id]} · ${focus.w}×${focus.h}`}
        note={hands ? S.handsNote(dream.gestures[locale]) : S.focusNote(dream.path, dream.performs[locale])}
        aside={
          <LabChip on={hands} onClick={() => setHands((h) => !h)}>
            <Hand /> {hands ? S.handsOn : S.hands}
          </LabChip>
        }
      >
        <div ref={stageRef} className="flex w-full justify-center">
          {scale > 0 && (
            <DreamBox
              key={focus.id}
              dream={dream}
              lab={lab}
              screen={focus}
              scale={scale}
              onHost={setHost}
              override={previewOf?.(focus)}
              replay={replay}
              still={hands}
              className={cn(preview && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
            >
              {hands && (
                <Hands
                  dream={dream}
                  host={host}
                  width={focus.w}
                  scale={scale}
                  tree={tree}
                  picked={picked}
                  onPick={setPicked}
                  onAim={(found) => {
                    const node = found && tree.find((n) => `${n.type}|${n.of}` === found.key);
                    setPreview(
                      found && node
                        ? {
                            id: `${found.key}=${found.kind}`,
                            label: `${node.words[locale]} → ${node.kinds[found.kind].words[locale]}`,
                            action: { type: "decide", key: found.key, kind: found.kind, from: "dragged", screen: focus },
                          }
                        : null,
                    );
                  }}
                  onDrag={(from, to, inside) =>
                    void handle({ kind: "drag", screen: focus, from, to, within: inside }, S.drag(hitWords(dream, from, locale), hitWords(dream, to, locale)))
                  }
                  S={S}
                />
              )}
              {preview && (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex">
                  <span className="truncate rounded-md bg-foreground px-2 py-1 font-mono text-[11px] text-background shadow-overlay">
                    {S.previewing(preview.label)}
                  </span>
                </div>
              )}
            </DreamBox>
          )}
        </div>
        <Directions
          lab={lab}
          screen={focus}
          preview={preview?.id ?? null}
          onPreview={previewDirection}
          onApply={(d) => {
            lab.dispatch({ type: "decide", key: d.key, kind: d.kind, from: "switched", screen: focus });
            setPreview(null);
          }}
          S={S}
        />
        <form onSubmit={send} className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {S.promptAbout}{" "}
            <button type="button" onClick={() => setPicked({ id: null })} className="text-foreground underline underline-offset-2" title={S.everything}>
              {about}
            </button>
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={dream.placeholder[locale]}
            aria-label={dream.placeholder[locale]}
            className="min-w-0 flex-1 rounded-md border border-border/60 bg-background/70 px-3 py-1.5 text-base outline-none focus:border-foreground/50 sm:text-sm"
          />
          <LabButton type="submit" tone="primary" disabled={!text.trim()}>
            <SendHorizontal /> {S.send}
          </LabButton>
        </form>
      </LabSection>
      <LabSection title={S.events} note={S.eventsNote}>
        <EventLog log={log} S={S} />
      </LabSection>
      {indexed && (
        <LabSection title={S.shape(tree.find((n) => `${n.type}|${n.of}` === indexed)!.words[locale])} note={S.shapeNote}>
          <ShapeRuler lab={lab} k={indexed} focus={focus} onFocus={(s) => setFocusId(s.id)} S={S} />
        </LabSection>
      )}
      <LabSection title={S.wall} note={S.wallNote}>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-6">
          {SCREENS.map((s) => (
            <Tile key={s.id} dream={dream} indexed={indexed} lab={lab} screen={s} on={s.id === focus.id} onClick={() => setFocusId(s.id)} override={previewOf?.(s)} replay={replay} S={S} />
          ))}
        </div>
      </LabSection>
    </LabShell>
  );
}
