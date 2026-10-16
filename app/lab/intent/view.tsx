"use client";

import Forget from "@/app/dream/forget/forget.scene";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { LabButton, LabSection, LabShell, Section, Segmented, useLabStrings } from "@/systems/lab";
import { Undo2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StageProvider } from "stage";
import { INTENT_TYPES, KINDS, LOOP, SCREENS, SCRIPT, tallness, type IntentType, type Screen } from "./forget";
import { useLab, useValue, type IntentView, type Lab } from "./model";
import { INTENT_STRINGS, type IntentStrings } from "./strings";

// =============================================================================
// The Intent Lab: a dream's intents, decided per screen.
//
// reintent (packages/reintent, from airtalk) is the intent tier over a stage
// scene. The scene's props are the knobs (the inspector's sliders); an intent
// is what a knob is for, as a closed choice, decided per screen by a person,
// their preference, a model sure enough, or code, in that order. A switch on
// one screen moves a crossover along the screens' shapes; an unsure intent
// that is the dream's meaning is asked once.
//
// Everything drawn is the real /dream/forget scene, boxed at each screen's
// size, giving the same scripted performance (the stage is deterministic, so
// the screens differ only by what was decided for them).
// =============================================================================

const BG = "#f2ede3";

/** The dream at a screen's size, shown at `scale`, with that screen's props over its scene. */
function DreamBox({
  lab,
  screen,
  scale,
  inert,
  className,
}: {
  lab: Lab;
  screen: Screen;
  scale: number;
  /** It only performs; a tap on it is its tile's. */
  inert?: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  const params = useValue(lab.params(screen));
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl border border-border/60", className)}
      style={{ width: screen.w * scale, height: screen.h * scale, background: BG }}
    >
      <div
        className={cn("absolute left-0 top-0 origin-top-left", inert && "pointer-events-none")}
        style={{ width: screen.w, height: screen.h, transform: `scale(${scale})` }}
      >
        <StageProvider locale={locale} onWake={() => {}} box params={params} script={SCRIPT} loop={LOOP}>
          <Forget />
        </StageProvider>
      </div>
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

function Who({ v, S }: { v: IntentView; S: IntentStrings }) {
  const mark = v.who === "person" ? "●" : v.who === "model" ? "◐" : v.who === "pref" ? "◉" : "○";
  const words = v.type === "axis" && v.who === "model" && v.where === "code" ? S.whoWhere : S.who[v.who];
  return (
    <span className="font-mono text-[10px] text-muted-foreground">
      {mark} {words}
    </span>
  );
}

/** Screens by shape, wide to tall, each marked with the way its moments go; and where it crosses over. */
function ShapeRuler({ lab, focus, onFocus, S }: { lab: Lab; focus: Screen; onFocus: (s: Screen) => void; S: IntentStrings }) {
  const stored = useValue(lab.stored);
  const at = (stored["axis|window"]?.pick as { at?: number } | undefined)?.at;
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
  screen,
  left,
  above,
  on,
  onClick,
  S,
}: {
  lab: Lab;
  screen: Screen;
  left: string;
  above: boolean;
  on: boolean;
  onClick: () => void;
  S: IntentStrings;
}) {
  const v = useValue(lab.view("axis", screen));
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
        {v.kind === "up" ? "↑" : "←"}
      </span>
      <span className={cn("whitespace-nowrap", on && "underline underline-offset-2")}>{S.short[screen.id] ?? S.screens[screen.id]}</span>
    </button>
  );
}

function Tile({ lab, screen, on, onClick, S }: { lab: Lab; screen: Screen; on: boolean; onClick: () => void; S: IntentStrings }) {
  const axis = useValue(lab.view("axis", screen));
  const scale = 132 / screen.h;
  // The dream has buttons of its own (the way out), so the tile is a div and its button lies over it.
  return (
    <div className="group relative flex flex-col items-start gap-1.5 text-left">
      <DreamBox
        lab={lab}
        screen={screen}
        scale={scale}
        inert
        className={cn("transition-shadow", on ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "group-hover:ring-1 group-hover:ring-border")}
      />
      <span className="flex flex-col">
        <span className="text-xs text-foreground">{S.screens[screen.id]}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {screen.w}×{screen.h} · {axis.kind === "up" ? "↑" : "←"} {S.kinds[axis.kind]}
        </span>
      </span>
      <button type="button" onClick={onClick} aria-label={S.screens[screen.id]} aria-pressed={on} className="absolute inset-0 rounded-xl" />
    </div>
  );
}

function IntentRow({ lab, type, screen, S }: { lab: Lab; type: IntentType; screen: Screen; S: IntentStrings }) {
  const v = useValue(lab.view(type, screen));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{S.types[type]}</span>
        <span className="flex items-baseline gap-2">
          <Who v={v} S={S} />
          {v.who === "person" && (
            <button type="button" onClick={() => lab.forget(type)} className="font-mono text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
              {S.forget}
            </button>
          )}
        </span>
      </div>
      <Segmented
        value={v.kind}
        options={KINDS[type].map((k) => ({ value: k, label: S.kinds[k] + (v.asks && k === v.kind ? " ?" : "") }))}
        onChange={(k) => k !== v.kind && lab.choose(type, k, screen)}
      />
    </div>
  );
}

function Question({ lab, screen, S }: { lab: Lab; screen: Screen; S: IntentStrings }) {
  const qs = useValue(lab.questions(screen));
  if (!qs.length) return null;
  return (
    <Section title={S.asking}>
      <p className="text-sm text-foreground">{S.question}</p>
      <p className={TYPE.captionQuiet}>{S.questionNote}</p>
      <div className="flex gap-2">
        {KINDS.holding.map((k) => (
          <LabButton key={k} tone="primary" onClick={() => lab.choose("holding", k, screen, "asked")}>
            {S.kinds[k]}
          </LabButton>
        ))}
      </div>
    </Section>
  );
}

/** The decisions as they would sit beside the scene: one element each, literals only. */
function Stored({ lab, S }: { lab: Lab; S: IntentStrings }) {
  const stored = useValue(lab.stored);
  const lines = Object.entries(stored).map(([key, d]) => {
    const [type, of] = key.split("|");
    const pick = d.pick as string | { base: string; below: string | null; at: number };
    const attrs =
      typeof pick === "string"
        ? `pick="${pick}"`
        : `base="${pick.base}"${pick.below ? ` below="${pick.below}"` : ""} at={${pick.at}}`;
    return `<Intent id="${type}" of="${of}" ${attrs} from="${d.from ?? "resolved"}" />`;
  });
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

export function IntentLabView() {
  const S = useLabStrings(INTENT_STRINGS);
  const lab = useLab();
  const [focusId, setFocusId] = useState("landscape");
  const focus = SCREENS.find((s) => s.id === focusId) ?? SCREENS[0];
  const [stageRef, stageW] = useWidth<HTMLDivElement>();
  const asks = useValue(lab.questions(focus)).length;
  const stored = useValue(lab.stored);
  const history = useValue(lab.history);
  // As large as the column allows, and no taller than most of a laptop's screen.
  const scale = stageW ? Math.min(1, stageW / focus.w, 440 / focus.h) : 0;

  return (
    <LabShell
      lab="intent"
      layout="workbench"
      meta={S.meta(SCREENS.length, asks, Object.keys(stored).length)}
      actions={
        <>
          <LabButton onClick={lab.undo} disabled={!history.length}>
            <Undo2 /> {S.undo}
          </LabButton>
          <LabButton onClick={lab.reset} disabled={!Object.keys(stored).length}>
            <RotateCcw /> {S.reset}
          </LabButton>
        </>
      }
      panel={
        <>
          <Question lab={lab} screen={focus} S={S} />
          <Section title={S.intents(S.screens[focus.id])}>
            <p className={TYPE.captionQuiet}>{S.intentsNote}</p>
            {INTENT_TYPES.map((t) => (
              <IntentRow key={t} lab={lab} type={t} screen={focus} S={S} />
            ))}
          </Section>
          <Stored lab={lab} S={S} />
          <Props lab={lab} screen={focus} S={S} />
        </>
      }
    >
      <LabSection title={`${S.focus} · ${S.screens[focus.id]} · ${focus.w}×${focus.h}`} note={S.focusNote}>
        <div ref={stageRef} className="flex w-full justify-center">
          {scale > 0 && <DreamBox key={focus.id} lab={lab} screen={focus} scale={scale} />}
        </div>
      </LabSection>
      <LabSection title={S.shape} note={S.shapeNote}>
        <ShapeRuler lab={lab} focus={focus} onFocus={(s) => setFocusId(s.id)} S={S} />
      </LabSection>
      <LabSection title={S.wall} note={S.wallNote}>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-6">
          {SCREENS.map((s) => (
            <Tile key={s.id} lab={lab} screen={s} on={s.id === focus.id} onClick={() => setFocusId(s.id)} S={S} />
          ))}
        </div>
      </LabSection>
    </LabShell>
  );
}
