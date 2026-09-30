"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MousePointerClick } from "lucide-react";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import {
  AXES,
  LANGUAGES,
  SCALE_MAX,
  LABEL_TUCK,
  absColor,
  nameOf,
  placeLabels,
  reachOf,
  tierOf,
  type LabelPlacement,
  type Language,
} from "@/lib/languages";
import { t, type Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { ANCHORED_PRESENTATION, AdaptiveSurface } from "@/systems/surface";
import { LanguageNote, LanguagePeek } from "./language-note";

// =============================================================================
// PLChart — every language I've written, on two personal axes.
//
//   x  interestingness to me   🥱 · 😎 · 🤓 · 🤯
//   y  my experience with it   🤦‍♂️ · 🙇‍♂️ · 👨‍💻 · 👨‍🎓
//   ·  abstraction level       ink, faint (bare metal) → full (pure)
//
// Not a charting library: thirty-one dots on a 10 × 10 grid is a layout, so
// it is one. The field is a box and a dot sits at a percentage of it, which
// makes the chart as fluid as the column it is in with nothing to resize. Each
// dot is a real button — focusable, labelled, pressable — which is what a
// canvas could never be.
//
// A dot behaves the way a thing does everywhere on this site: a pointer that
// rests on it gets the peek (the note's head and first line, following the
// cursor), and a press opens the note itself where it can be read and its
// links followed — a card hanging off the dot, or the sheet on a phone
// (`ANCHORED_PRESENTATION`).
//
// Abstraction is the colour (lib/languages `absColor`), the one place on
// the site that is not grayscale, because here colour is data. The strip
// under the chart is its legend and its filter at once — the original's
// draggable range: press a level to keep only it, drag across to keep a
// range, press the only level again to let everything back.
// =============================================================================

/** The field's inset in the plot, leaving room for the labels at its edges. */
const FIELD: CSSProperties = {
  top: "1.75rem",
  bottom: "4.25rem",
  left: "3.5rem",
  right: "2rem",
};

const CENTERED: LabelPlacement = { side: "below", align: "center" };

const pct = (v: number) => `${(v / SCALE_MAX) * 100}%`;

type Range = readonly [number, number];
const FULL: Range = [0, SCALE_MAX];

function inRange(level: number, [lo, hi]: Range) {
  return level >= lo && level <= hi;
}

/**
 * How a language stands against the kept range: `in` when its own level is
 * in it; `reach` when only its range reaches it (C++ under a filter of 2:
 * "as low as C"); `out` otherwise. What is past the scale is in no range, so
 * any filter sets it aside.
 */
function standing(
  language: Language,
  range: Range,
  filtered: boolean,
): "in" | "reach" | "out" {
  const reach = reachOf(language);
  if (reach === null) return filtered ? "out" : "in";
  if (inRange(language.abs!, range)) return "in";
  return reach[0] <= range[1] && reach[1] >= range[0] ? "reach" : "out";
}

export function PLChart({ locale }: { locale: Locale }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(FULL);
  const [fieldWidth, setFieldWidth] = useState(0);

  // The field's width decides which names fit under their dots; it is
  // measured, not guessed, and follows the column as it resizes.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const observer = new ResizeObserver(([entry]) =>
      setFieldWidth(entry.contentRect.width),
    );
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  const labelSize = fieldWidth > 0 && fieldWidth < 420 ? 10 : 11;
  const placements = useMemo(
    () => placeLabels(LANGUAGES, fieldWidth || 600, labelSize, locale),
    [fieldWidth, labelSize, locale],
  );

  const open = useMemo(
    () => LANGUAGES.find((l) => l.id === openId) ?? null,
    [openId],
  );

  const filtered = range[0] !== FULL[0] || range[1] !== FULL[1];

  return (
    <figure className="not-prose system-voice">
      <div
        role="group"
        aria-label={t(locale, "languagesChart")}
        className="relative h-[29rem] sm:h-[32rem]"
      >
        {/* Experience: the four named steps, up the left edge. */}
        <div
          aria-hidden
          className="absolute left-0 w-9"
          style={{ top: FIELD.top, bottom: FIELD.bottom }}
        >
          {AXES.y.ticks.map((tick) => (
            <span
              key={tick.at}
              title={tick.label[locale]}
              className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 text-lg leading-none sm:text-2xl"
              style={{ bottom: pct(tick.at) }}
            >
              {tick.emoji}
            </span>
          ))}
        </div>

        {/* The y axis's own line, dashed, as it always was. */}
        <div
          aria-hidden
          className="absolute w-px border-l border-dashed border-border"
          style={{ top: FIELD.top, bottom: FIELD.bottom, left: "2.75rem" }}
        />

        {/* Interestingness: the four named steps, along the foot. */}
        <div
          aria-hidden
          className="absolute bottom-0 h-8"
          style={{ left: FIELD.left, right: FIELD.right }}
        >
          {AXES.x.ticks.map((tick) => (
            <span
              key={tick.at}
              title={tick.label[locale]}
              className="absolute bottom-1.5 -translate-x-1/2 text-lg leading-none sm:text-2xl"
              style={{ left: pct(tick.at) }}
            >
              {tick.emoji}
            </span>
          ))}
        </div>

        {/* The axes' names, where each one points. */}
        <span
          aria-hidden
          className={cn(TYPE.labelSm, "absolute left-0 top-0")}
        >
          ↑ {AXES.y.name[locale]}
        </span>
        <span
          aria-hidden
          className={cn(TYPE.labelSm, "absolute bottom-10 right-0")}
        >
          {AXES.x.name[locale]} →
        </span>

        <div ref={fieldRef} className="absolute" style={FIELD}>
          {/* One dashed rule per level of experience. */}
          {Array.from({ length: SCALE_MAX + 1 }, (_, level) => (
            <div
              key={level}
              aria-hidden
              className="absolute -left-3 -right-4 border-t border-dashed border-border"
              style={{ bottom: pct(level) }}
            />
          ))}

          {LANGUAGES.map((language) => {
            const stand = standing(language, range, filtered);
            return (
            <Dot
              key={language.id}
              language={language}
              locale={locale}
              placement={placements.get(language.id) ?? CENTERED}
              labelSize={labelSize}
              dimmed={stand === "out"}
              reached={stand === "reach"}
              selected={openId === language.id}
              peek={openId === null}
              onOpen={(el) => {
                anchorRef.current = el;
                // Its own dot, pressed again, puts the note away.
                setOpenId((id) => (id === language.id ? null : language.id));
              }}
            />
            );
          })}
        </div>
      </div>

      <AbstractionStrip
        locale={locale}
        range={range}
        filtered={filtered}
        reached={LANGUAGES.some((l) => standing(l, range, filtered) === "reach")}
        onChange={setRange}
      />

      <AdaptiveSurface
        id="surface-language"
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        presentation={ANCHORED_PRESENTATION}
        title={open ? nameOf(open, locale) : ""}
        closeLabel={t(locale, "languagesClose")}
        popover={{ anchor: anchorRef, width: "min(92vw, 420px)", align: "center" }}
        maxHeight="min(72dvh, 560px)"
        fitContent
      >
        {open && (
          <LanguageNote
            language={open}
            locale={locale}
            className="pt-1 pb-2"
          />
        )}
      </AdaptiveSurface>
    </figure>
  );
}

// -----------------------------------------------------------------------------
// A dot.
// -----------------------------------------------------------------------------

function Dot({
  language,
  locale,
  placement,
  labelSize,
  dimmed,
  reached,
  selected,
  peek,
  onOpen,
}: {
  language: Language;
  locale: Locale;
  placement: LabelPlacement;
  labelSize: number;
  dimmed: boolean;
  /** Kept by its range, not its level: drawn with a dashed ring. */
  reached: boolean;
  selected: boolean;
  /** False while a note is open: the card is already saying it. */
  peek: boolean;
  onOpen: (el: HTMLElement) => void;
}) {
  const tier = tierOf(language.abs);
  return (
    <div
      className="absolute -translate-x-1/2 translate-y-1/2"
      style={{ left: pct(language.i13s), bottom: pct(language.exp) }}
    >
      <MagneticPreview
        enabled={peek && !dimmed}
        preview={
          <LanguagePeek
            language={language}
            locale={locale}
            openHint={t(locale, "languagesPeekOpen")}
          />
        }
        panelClassName="shadow-raised"
      >
        <button
          type="button"
          onClick={(e) => onOpen(e.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={selected}
          aria-label={`${nameOf(language, locale)} — ${AXES.x.name[locale]} ${language.i13s}, ${AXES.y.name[locale]} ${language.exp}, ${AXES.abs.name[locale]} ${tier.level ?? ""} (${tier.label[locale]})`}
          className={cn(
            "group/dot pressable relative grid size-8 cursor-pointer place-items-center rounded-full outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring/50",
            dimmed && "pointer-events-none",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "block size-3 rounded-full ring-2 ring-background transition-[transform,opacity] duration-200",
              "group-hover/dot:scale-[1.35] group-active/dot:scale-110 group-active/dot:duration-0",
              selected && "scale-[1.35] outline-2 outline-offset-2 outline-foreground",
              reached &&
                !selected &&
                "outline-1 outline-offset-2 outline-dashed outline-muted-foreground",
            )}
            style={{
              background: dimmed
                ? "color-mix(in oklab, var(--ink) 12%, transparent)"
                : absColor(language.abs),
            }}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute whitespace-nowrap font-mono leading-none transition-colors duration-200",
              placement.side === "below"
                ? "top-[calc(50%+0.625rem)]"
                : "bottom-[calc(50%+0.625rem)]",
              placement.align === "center" && "left-1/2 -translate-x-1/2",
              dimmed
                ? "text-quaternary-foreground"
                : selected
                  ? "text-foreground"
                  : "text-muted-foreground group-hover/dot:text-foreground",
            )}
            style={{
              fontSize: labelSize,
              ...(placement.align === "start" && { left: `calc(50% - ${LABEL_TUCK}px)` }),
              ...(placement.align === "end" && { right: `calc(50% - ${LABEL_TUCK}px)` }),
            }}
          >
            {nameOf(language, locale)}
          </span>
        </button>
      </MagneticPreview>
    </div>
  );
}

// -----------------------------------------------------------------------------
// The abstraction strip — legend and filter.
// -----------------------------------------------------------------------------

function AbstractionStrip({
  locale,
  range,
  filtered,
  reached,
  onChange,
}: {
  locale: Locale;
  range: Range;
  filtered: boolean;
  /** Some dot is kept by its range alone: say what its dashed ring means. */
  reached: boolean;
  onChange: (range: Range) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ anchor: number; pointer: number; moved: boolean } | null>(
    null,
  );

  const levelAt = (x: number, y: number): number | null => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-abs-level]");
    return el ? Number(el.dataset.absLevel) : null;
  };

  const select = useCallback(
    (level: number) => {
      // The only level kept, pressed again: everything comes back.
      if (range[0] === level && range[1] === level) onChange(FULL);
      else onChange([level, level]);
    },
    [range, onChange],
  );

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, level: number) => {
    if (e.button !== 0) return;
    drag.current = { anchor: level, pointer: e.pointerId, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    // Released somewhere we never heard about: the drag is over.
    if (e.buttons === 0) {
      drag.current = null;
      return;
    }
    const level = levelAt(e.clientX, e.clientY);
    if (level === null || (level === d.anchor && !d.moved)) return;
    if (!d.moved) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    onChange([Math.min(d.anchor, level), Math.max(d.anchor, level)]);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.pointer !== e.pointerId) return;
    if (!d.moved) select(d.anchor);
  };

  // What the strip says beside it: the level under the pointer, else what is
  // kept, else how to use it — a row of swatches does not look pressable on
  // its own, so until it has been used it says so.
  const tierName = (level: number) => `${level} · ${tierOf(level).label[locale]}`;
  const readout =
    hover !== null
      ? tierName(hover)
      : range[0] === range[1]
        ? tierName(range[0])
        : filtered
          ? `${range[0]}–${range[1]} · ${tierOf(range[0]).label[locale]} → ${tierOf(range[1]).label[locale]}`
          : null;

  return (
    <figcaption className="mt-5 sm:pl-[3.5rem]">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={cn(TYPE.rowMeta, "shrink-0")}>{AXES.abs.low[locale]}</span>
        {/* The track: a control's shape, so it reads as one. */}
        <div
          role="group"
          aria-label={t(locale, "languagesFilterLabel")}
          className="flex shrink-0 cursor-pointer touch-pan-y gap-[3px] rounded-full bg-muted p-1 ring-1 ring-inset ring-border"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onPointerLeave={() => setHover(null)}
        >
          {AXES.abs.tiers.map(({ level: tierLevel }) => {
            const level = tierLevel!;
            const kept = inRange(level, range);
            return (
              <div
                key={level}
                data-abs-level={level}
                onPointerDown={(e) => onPointerDown(e, level)}
                onPointerEnter={() => setHover(level)}
              >
                <button
                  type="button"
                  aria-pressed={filtered && kept}
                  aria-label={tierName(level)}
                  onClick={(e) => {
                    // A pointer's press is handled on pointerup, drags included;
                    // this is the keyboard's.
                    if (e.detail === 0) select(level);
                  }}
                  onFocus={() => setHover(level)}
                  onBlur={() => setHover(null)}
                  className="group/swatch pressable grid h-6 w-4 cursor-pointer place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-6"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "block h-3.5 w-full rounded-full transition-[opacity,transform] duration-200",
                      "group-hover/swatch:scale-y-[1.3] group-active/swatch:scale-y-100 group-active/swatch:duration-0",
                      !kept && "opacity-25",
                      hover === level && "scale-y-[1.3]",
                    )}
                    style={{ background: absColor(level) }}
                  />
                </button>
              </div>
            );
          })}
        </div>
        <span className={cn(TYPE.rowMeta, "shrink-0")}>{AXES.abs.high[locale]}</span>
      </div>
      <p
        aria-live="polite"
        className={cn(
          "mt-2 flex min-h-5 items-center gap-1.5",
          readout ? TYPE.meta : TYPE.rowMeta,
        )}
      >
        {readout ?? (
          <>
            <MousePointerClick aria-hidden className="size-3.5 shrink-0" />
            {t(locale, "languagesFilterHint")}
          </>
        )}
        {filtered && hover === null && reached && (
          <span className={cn(TYPE.rowMeta, "ml-2 hidden sm:inline")}>
            · {t(locale, "languagesReached")}
          </span>
        )}
        {filtered && hover === null && (
          <button
            type="button"
            onClick={() => onChange(FULL)}
            className={cn(TYPE.nav, "pressable ml-2 underline underline-offset-2 decoration-ink-line")}
          >
            {t(locale, "languagesAll")}
          </button>
        )}
      </p>
    </figcaption>
  );
}
