"use client";

import { Undo2, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { LabButton, LabSection, LabShell, useLabStrings } from "@/systems/lab";
import { TYPE } from "@/lib/typography";
import { useLocale } from "@/services";
import { cn } from "@/lib/utils";
import { CaptureDefs, useCaptures, type Captured } from "./capture";
import {
  EMPTY_DOC,
  THINGS,
  belief,
  cellsOf,
  decide,
  forget,
  narrow,
  questions,
  tile,
  type Cell,
  type Doc,
  type Screen,
  type Thing,
  type Tile,
} from "./host";
import { SCREENS_STRINGS, type ScreensStrings } from "./strings";

// =============================================================================
// /lab/screens: one dream, any screen. Reintent (airtalk#818) as the Lab's
// camera: how a scene composed once for a phone is framed everywhere else.
//
//   capture.tsx   the Wardrobe, measured at each still (packages/scene)
//   host.ts       the intents (frame, keep, focus) and the solver
//   view.tsx      the wall of screens, any size, and why each looks as it does
//
// The doc (a person's decisions and rules, and the model's recorded beliefs)
// is the only state; every frame on the wall is computed from it. A history
// of docs is the undo.
// =============================================================================

type ScreenId = keyof ScreensStrings["screens"];
const SCREENS: (Screen & { id: ScreenId })[] = [
  { id: "phone", width: 390, height: 844 },
  { id: "small", width: 375, height: 667 },
  { id: "ipadPortrait", width: 834, height: 1112 },
  { id: "feed", width: 1080, height: 1350 },
  { id: "fold", width: 1080, height: 1232 },
  { id: "square", width: 1000, height: 1000 },
  { id: "ipadLandscape", width: 1112, height: 834 },
  { id: "laptop", width: 1280, height: 800 },
  { id: "desktop", width: 1920, height: 1080 },
  { id: "ultrawide", width: 2560, height: 1080 },
];

/** A screen drawn at a constant area, so a phone and a monitor weigh the same on the wall. */
const sizeOf = (s: Screen, area: number) => {
  const t = s.height / s.width;
  return { w: Math.round(Math.sqrt(area / t)), h: Math.round(Math.sqrt(area * t)) };
};

const freeScreen = (t: number): Screen & { id: ScreenId } => ({
  id: "free",
  width: Math.round(1000 / Math.sqrt(t)),
  height: Math.round(1000 * Math.sqrt(t)),
});

export function ScreensLabView() {
  const S = useLabStrings(SCREENS_STRINGS);
  // One address whatever the reader's language: only the svg and the stills' (bilingual) labels
  // are taken, and a changing address would reload the frame mid-capture.
  const { captures, frame, error } = useCaptures("/scenes/wardrobe/index.html?lang=zh");
  const { locale } = useLocale();
  // The scene's still labels are bilingual ("床头 · at the bed"): this reader's half.
  const stillLabel = (label: string) => label.split(" · ")[locale === "zh" ? 0 : 1] ?? label;
  const [history, setHistory] = useState<Doc[]>([EMPTY_DOC]);
  const doc = history[history.length - 1];
  const apply = (next: Doc) => setHistory((h) => [...h, next]);
  const [sel, setSel] = useState<{ still: string; screen: ScreenId }>({ still: "bedside", screen: "ipadLandscape" });
  const [tallness, setTallness] = useState(1);
  const [hover, setHover] = useState<string | null>(null);

  const free = freeScreen(tallness);
  const screenOf = (id: ScreenId) => (id === "free" ? free : SCREENS.find((s) => s.id === id)!);

  // Every tile on the wall: computed from the doc, nothing stored.
  const wall = useMemo(
    () => (captures ? captures.map((c) => ({ capture: c, tiles: SCREENS.map((s) => tile(doc, c, s)) })) : null),
    [captures, doc],
  );
  const selected = useMemo(() => {
    const c = captures?.find((x) => x.still === sel.still);
    return c ? { capture: c, screen: screenOf(sel.screen), tile: tile(doc, c, screenOf(sel.screen), true) } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- screenOf reads `free`, keyed by tallness
  }, [captures, doc, sel, tallness]);
  const asked = useMemo(() => {
    if (!captures) return [];
    const seen = new Map<string, Cell>();
    for (const c of captures) for (const q of questions(doc, cellsOf(c), SCREENS[0])) seen.set(q.key, q);
    return [...seen.values()];
  }, [captures, doc]);

  const actions = (
    <>
      <LabButton disabled={history.length < 2} onClick={() => setHistory((h) => h.slice(0, -1))}>
        <Undo2 />
        {S.undo}
      </LabButton>
      <LabButton disabled={history.length < 2} onClick={() => setHistory([EMPTY_DOC])}>
        <RotateCcw />
        {S.reset}
      </LabButton>
    </>
  );

  const panel = selected && (
    <Panel
      S={S}
      doc={doc}
      apply={apply}
      asked={asked}
      selected={selected}
      screenLabel={S.screens[sel.screen]}
      setHover={setHover}
      captures={captures!}
    />
  );

  return (
    <LabShell lab="screens" layout="workbench" meta={<span className={TYPE.rowMeta}>{S.meta(SCREENS.length + 1, asked.length)}</span>} actions={actions} panel={panel}>
      {frame}
      {captures && <CaptureDefs captures={captures} />}
      {!captures && <p className={TYPE.caption}>{error ? S.failed : S.measuring}</p>}

      {wall && (
        <LabSection title={S.wall} note={S.wallNote}>
          <div className="overflow-x-auto pb-2">
            <div className="inline-grid gap-y-3" style={{ gridTemplateColumns: `auto repeat(${SCREENS.length}, auto)`, columnGap: 8 }}>
              {wall.map(({ capture, tiles }) => [
                <div key={capture.still} className={cn(TYPE.rowMeta, "self-center pr-1 text-right text-[11px]")}>
                  {stillLabel(capture.label)}
                </div>,
                ...tiles.map((t, i) => {
                  const s = SCREENS[i];
                  const { w, h } = sizeOf(s, 8200);
                  return (
                    <div key={`${capture.still}:${s.id}`} className="flex items-end">
                      <TileView
                        capture={capture}
                        t={t}
                        w={w}
                        h={h}
                        S={S}
                        hover={hover}
                        selected={sel.still === capture.still && sel.screen === s.id}
                        onClick={() => setSel({ still: capture.still, screen: s.id })}
                      />
                    </div>
                  );
                }),
              ])}
              <div />
              {SCREENS.map((s) => (
                <div key={s.id} className={cn(TYPE.rowMeta, "max-w-[9rem] truncate pt-0.5 text-[11px]")}>
                  {S.screens[s.id]}
                </div>
              ))}
            </div>
          </div>
        </LabSection>
      )}

      {captures && (
        <LabSection
          title={S.free}
          note={S.freeNote}
          aside={
            <label className="flex items-center gap-3">
              <input
                type="range"
                min={Math.log(0.42)}
                max={Math.log(2.3)}
                step={0.001}
                value={Math.log(tallness)}
                onChange={(e) => {
                  setTallness(Math.exp(Number(e.target.value)));
                  setSel((cur) => ({ ...cur, screen: "free" }));
                }}
                className="w-48 accent-foreground"
                aria-label={S.free}
              />
              <span className={cn(TYPE.rowMeta, "w-24 tabular-nums")}>{S.freeShape(free.width, free.height)}</span>
            </label>
          }
        >
          <div className="flex flex-wrap items-end gap-4">
            {captures.map((c) => {
              const { w, h } = sizeOf(free, 52000);
              return (
                <TileView
                  key={c.still}
                  capture={c}
                  t={tile(doc, c, free)}
                  w={w}
                  h={h}
                  S={S}
                  hover={hover}
                  selected={sel.still === c.still && sel.screen === "free"}
                  onClick={() => setSel({ still: c.still, screen: "free" })}
                />
              );
            })}
          </div>
        </LabSection>
      )}
    </LabShell>
  );
}

// -----------------------------------------------------------------------------
// A still on a screen
// -----------------------------------------------------------------------------

function TileView({
  capture,
  t,
  w,
  h,
  S,
  hover,
  selected,
  onClick,
  bare,
}: {
  capture: Captured;
  t: Tile;
  w: number;
  h: number;
  S: ScreensStrings;
  hover: string | null;
  selected?: boolean;
  onClick?: () => void;
  bare?: boolean;
}) {
  const v = t.world.view;
  const whole = t.world.mode === "whole";
  const thing = hover?.startsWith("keep|") ? (hover.slice(5) as Thing) : hover?.startsWith("focus|") ? t.world.focus : null;
  const box = thing ? capture.things[thing] : null;
  const cut = thing ? t.world.shown[thing] === "crop" : false;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-[6px] bg-black ring-1 transition-shadow",
        selected ? "ring-2 ring-amber-500" : "ring-border/60 hover:ring-foreground/40",
        t.broken.length > 0 && "ring-red-500",
      )}
      style={{ width: w, height: h }}
    >
      <svg
        viewBox={`${v.x0} ${v.y0} ${v.x1 - v.x0} ${v.y1 - v.y0}`}
        preserveAspectRatio={whole ? "xMidYMid meet" : "xMidYMid slice"}
        className="absolute inset-0 h-full w-full"
        style={{ filter: capture.filter }}
        aria-hidden
      >
        <use href={`#cap-${capture.still}`} />
        {box && (
          <rect
            x={box.box.x0}
            y={box.box.y0}
            width={box.box.x1 - box.box.x0}
            height={box.box.y1 - box.box.y0}
            fill="none"
            stroke={cut ? "#ef6b5f" : "#f0a83a"}
            strokeWidth={2}
            strokeDasharray={cut ? "6 4" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {!bare && (
        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1 font-mono text-[9px] leading-4 text-white/80">
          {t.changed && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title={S.changed} />}
          {S.modes[t.world.mode]}
        </span>
      )}
    </button>
  );
}

// -----------------------------------------------------------------------------
// The panel: what is asked, why this tile looks as it does, what is stored
// -----------------------------------------------------------------------------

const typeOrder = { frame: 0, keep: 1, focus: 2 } as const;

function Panel({
  S,
  doc,
  apply,
  asked,
  selected,
  screenLabel,
  setHover,
  captures,
}: {
  S: ScreensStrings;
  doc: Doc;
  apply: (d: Doc) => void;
  asked: Cell[];
  selected: { capture: Captured; screen: Screen; tile: Tile };
  screenLabel: string;
  setHover: (k: string | null) => void;
  captures: Captured[];
}) {
  const { capture, screen, tile: t } = selected;
  const cells = [...t.cells].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
  const thingName = (k: string) => (THINGS as readonly string[]).includes(k) ? S.things[k as Thing] : k;
  const kindName = (cell: Cell, k: string) => {
    if (cell.type === "frame") return S.kinds[k as "fill" | "whole"];
    if (cell.type === "focus") return thingName(k);
    if (k === "whole") return S.kinds.whole_keep;
    if (k === "part") {
      const key = S.keyPart[cell.subject.thing as Thing];
      return key ? `${S.kinds.part} · ${key}` : S.kinds.part;
    }
    return S.kinds.crop;
  };
  const sourceOf = (cell: Cell): keyof ScreensStrings["from"] => {
    if (t.firm[cell.key] === "person") return "person";
    if (t.firm[cell.key] === "pref") return "pref";
    const d = decide(doc, t.cells, cell.key, screen);
    return d.from === "inferred" ? "model" : d.ask ? "asked" : "code";
  };
  const shownKind = (cell: Cell) => {
    if (cell.type === "frame") return t.world.mode === "whole" ? "whole" : "fill";
    if (cell.type === "focus") return t.world.focus;
    return t.world.shown[cell.subject.thing as Thing];
  };

  return (
    <div className="divide-y divide-border/60">
      {asked.length > 0 && (
        <section className="space-y-3 bg-amber-500/[0.07] p-4">
          <div>
            <h3 className={TYPE.label}>{S.asks}</h3>
            <p className={TYPE.caption}>{S.asksNote}</p>
          </div>
          {asked.map((cell) => {
            const thing = cell.subject.thing as Thing;
            return (
              <div key={cell.key} className="space-y-2" onMouseEnter={() => setHover(cell.key)} onMouseLeave={() => setHover(null)}>
                <p className="font-serif text-sm leading-relaxed text-foreground">{S.question(S.things[thing], S.keyPart[thing])}</p>
                <div className="flex flex-wrap gap-1.5">
                  {cell.kinds
                    .filter((k) => k !== "crop")
                    .map((k) => (
                      <LabButton key={k} tone="primary" onClick={() => apply(narrow(doc, cell, k, screen, { from: "answered" }))}>
                        {kindName(cell, k)}
                      </LabButton>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn(TYPE.rowMeta, "text-[11px]")}>{S.forAll}:</span>
                  {cell.kinds
                    .filter((k) => k !== "crop")
                    .map((k) => (
                      <LabButton key={k} onClick={() => apply(narrow(doc, cell, k, screen, { scope: "all", from: "answered" }))}>
                        {k === "whole" ? S.kinds.whole_keep : S.kinds.part}
                      </LabButton>
                    ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-4 p-4">
        <div>
          <h3 className={TYPE.label}>{S.intents}</h3>
          <p className={TYPE.caption}>
            {S.intentsNote(`${screenLabel} ${screen.width}×${screen.height}`)} · {capture.label}
          </p>
        </div>
        {cells.map((cell) => {
          const src = sourceOf(cell);
          const decidedKind = typeof t.a[cell.key] === "string" ? (t.a[cell.key] as string) : null;
          const shown = shownKind(cell);
          const p = belief(doc, cell);
          const alts = t.alternatives.filter((a) => a.key === cell.key);
          const decided = !!doc.decisions[cell.key];
          const pick = doc.decisions[cell.key]?.pick;
          const at = pick && typeof pick === "object" && typeof (pick as { at?: unknown }).at === "number" ? (pick as { at: number }).at : null;
          const title = cell.type === "frame" ? S.frame : cell.type === "keep" ? `${S.keep} · ${thingName(cell.subject.thing ?? "")}` : S.focus;
          return (
            <div key={cell.key} className="space-y-2" onMouseEnter={() => setHover(cell.key)} onMouseLeave={() => setHover(null)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={TYPE.meta}>{title}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm text-foreground">
                    {decidedKind
                      ? kindName(cell, decidedKind)
                      : cell.type === "frame"
                        ? `${S.kinds.fill} → ${kindName(cell, ((t.a[cell.key] as { below?: string }).below ?? "whole"))}`
                        : S.unsettled}
                  </span>
                  <SourceBadge src={src} label={S.from[src]} />
                </span>
              </div>
              {(!decidedKind || decidedKind !== shown) && (
                <p className={cn(TYPE.rowMeta, "text-[11px]")}>
                  {!decidedKind && cell.type === "frame" && `${S.crossoverCode} · `}
                  {S.onScreen(kindName(cell, shown))}
                </p>
              )}
              {/* The belief: the model's, weighed by any rule, with what was ruled out at 0. */}
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                {cell.kinds.map((k, i) => (
                  <div
                    key={k}
                    title={`${kindName(cell, k)} ${(p[k] * 100).toFixed(0)}%`}
                    className={cn(i === 0 ? "bg-foreground/70" : i === 1 ? "bg-foreground/40" : "bg-foreground/20")}
                    style={{ width: `${p[k] * 100}%` }}
                  />
                ))}
              </div>
              <div className={cn(TYPE.rowMeta, "flex flex-wrap gap-x-3 text-[11px]")}>
                {cell.kinds.map((k) => (
                  <span key={k}>
                    {kindName(cell, k)} {(p[k] * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
              {at !== null && <p className={cn(TYPE.rowMeta, "text-[11px]")}>{S.crossover(at.toFixed(3))}</p>}
              {alts.length > 0 ? (
                <div className="flex flex-wrap items-end gap-2">
                  {alts.map((alt) => {
                    const lost = THINGS.filter((x) => alt.world.shown[x] === "crop" && t.world.shown[x] !== "crop").map((x) => S.things[x]);
                    const at = sizeOf(screen, 4200);
                    return (
                      <div key={alt.kind} className="space-y-1">
                        <TileView
                          capture={capture}
                          t={{ ...t, world: alt.world, changed: false, broken: [] }}
                          w={at.w}
                          h={at.h}
                          S={S}
                          hover={null}
                          bare
                          onClick={() => apply(narrow(doc, cell, alt.kind, screen, { from: "switched" }))}
                        />
                        <div className="max-w-[10rem] text-[11px] leading-tight text-foreground">{kindName(cell, alt.kind)}</div>
                        {(alt.relaxed.length > 0 || lost.length > 0) && (
                          <div className={cn(TYPE.rowMeta, "max-w-[10rem] text-[10px] leading-tight")}>
                            {alt.relaxed.length > 0 && S.relaxed(alt.relaxed.map((r) => (r === "keep" ? S.keep : r === "focus" ? S.focus : S.frame)).join(" · "))}
                            {lost.length > 0 && ` ${S.cuts(lost.join("、"))}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={cn(TYPE.rowMeta, "text-[11px]")}>{S.noOther}</p>
              )}
              {decided && (
                <LabButton className="-ml-3" onClick={() => apply(forget(doc, cell.key))}>
                  {S.forget}
                </LabButton>
              )}
            </div>
          );
        })}
      </section>

      <section className="space-y-2 p-4">
        <h3 className={TYPE.label}>{S.stored}</h3>
        <p className={TYPE.caption}>{S.storedNote}</p>
        <Stored doc={doc} empty={S.nothingStored} />
        <PrefRows doc={doc} apply={apply} S={S} captures={captures} />
      </section>
    </div>
  );
}

function SourceBadge({ src, label }: { src: string; label: string }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 font-mono text-[10px] leading-4",
        src === "person" || src === "pref" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : src === "asked" ? "bg-red-500/15 text-red-600 dark:text-red-300" : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** The doc as it would be saved: a line per decision, a line per rule. */
function Stored({ doc, empty }: { doc: Doc; empty: string }) {
  const lines: string[] = [];
  for (const [key, d] of Object.entries(doc.decisions)) {
    const [type, of] = key.split("|");
    const pick = d.pick as string | { base: string; below: string | null; at: number } | { not: string[] };
    const attrs =
      typeof pick === "string"
        ? `pick="${pick}"`
        : "not" in pick
          ? `not="${pick.not.join(" ")}"`
          : `base="${pick.base}"${pick.below ? ` below="${pick.below}"` : ""} at="${pick.at}"`;
    lines.push(`<${type} of="${of}" ${attrs} from="${d.from}" />`);
  }
  for (const [type, p] of Object.entries(doc.prefs)) if (p) lines.push(`<prefer type="${type}" pick="${p.pick}" from="${p.from}" />`);
  if (!lines.length) return <p className={cn(TYPE.rowMeta, "text-[11px]")}>{empty}</p>;
  return <pre className="overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-2.5 font-mono text-[11px] leading-5 text-foreground">{lines.join("\n")}</pre>;
}

/** A rule can be taken back here too. */
function PrefRows({ doc, apply, S, captures }: { doc: Doc; apply: (d: Doc) => void; S: ScreensStrings; captures: Captured[] }) {
  const prefs = Object.entries(doc.prefs).filter(([, p]) => p);
  if (!prefs.length || !captures.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {prefs.map(([type]) => (
        <LabButton key={type} className="-ml-3" onClick={() => apply({ ...doc, prefs: { ...doc.prefs, [type]: undefined } })}>
          {S.forget} · {type === "keep" ? S.keep : type}
        </LabButton>
      ))}
    </div>
  );
}
