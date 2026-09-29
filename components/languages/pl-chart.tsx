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
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import {
  AXES,
  LANGUAGES,
  SCALE_MAX,
  LABEL_TUCK,
  absColor,
  placeLabels,
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
    () => placeLabels(LANGUAGES, fieldWidth || 600, labelSize),
    [fieldWidth, labelSize],
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

          {LANGUAGES.map((language) => (
            <Dot
              key={language.id}
              language={language}
              locale={locale}
              placement={placements.get(language.id) ?? CENTERED}
              labelSize={labelSize}
              dimmed={!inRange(language.abs, range)}
              selected={openId === language.id}
              peek={openId === null}
              onOpen={(el) => {
                anchorRef.current = el;
                // Its own dot, pressed again, puts the note away.
                setOpenId((id) => (id === language.id ? null : language.id));
              }}
            />
          ))}
        </div>
      </div>

      <AbstractionStrip
        locale={locale}
        range={range}
        filtered={filtered}
        onChange={setRange}
      />

      <AdaptiveSurface
        id="surface-language"
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
        presentation={ANCHORED_PRESENTATION}
        title={open?.name ?? ""}
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
  selected,
  peek,
  onOpen,
}: {
  language: Language;
  locale: Locale;
  placement: LabelPlacement;
  labelSize: number;
  dimmed: boolean;
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
        preview={<LanguagePeek language={language} locale={locale} />}
        panelClassName="shadow-raised"
      >
        <button
          type="button"
          onClick={(e) => onOpen(e.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={selected}
          aria-label={`${language.name} — ${AXES.x.name[locale]} ${language.i13s}, ${AXES.y.name[locale]} ${language.exp}, ${AXES.abs.name[locale]} ${language.abs} (${tier.label[locale]})`}
          className={cn(
            "group/dot pressable relative grid size-8 place-items-center rounded-full outline-none",
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
            {language.name}
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
  onChange,
}: {
  locale: Locale;
  range: Range;
  filtered: boolean;
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

  const readout =
    hover !== null
      ? `${hover} · ${tierOf(hover).label[locale]}`
      : range[0] === range[1]
        ? `${range[0]} · ${tierOf(range[0]).label[locale]}`
        : filtered
          ? `${range[0]}–${range[1]}`
          : null;

  return (
    <figcaption className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3 sm:pl-[3.5rem]">
      <span className={TYPE.rowMeta}>{AXES.abs.low[locale]}</span>
      <div
        role="group"
        aria-label={t(locale, "languagesFilterLabel")}
        className="flex touch-pan-y gap-[2px] sm:gap-[3px]"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => setHover(null)}
      >
        {AXES.abs.tiers.map(({ level, label }) => {
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
                aria-label={`${level} · ${label[locale]}`}
                onClick={(e) => {
                  // A pointer's press is handled on pointerup, drags included;
                  // this is the keyboard's.
                  if (e.detail === 0) select(level);
                }}
                onFocus={() => setHover(level)}
                onBlur={() => setHover(null)}
                className="pressable grid h-6 w-4 place-items-center rounded-[5px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-6"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-3 w-full rounded-[3px] transition-opacity duration-200",
                    !kept && "opacity-25",
                  )}
                  style={{ background: absColor(level) }}
                />
              </button>
            </div>
          );
        })}
      </div>
      <span className={TYPE.rowMeta}>{AXES.abs.high[locale]}</span>
      <span
        aria-live="polite"
        className={cn(TYPE.meta, "min-w-0 basis-full sm:basis-auto sm:ml-2")}
      >
        {readout ?? " "}
        {filtered && hover === null && (
          <button
            type="button"
            onClick={() => onChange(FULL)}
            className={cn(TYPE.nav, "pressable ml-3 underline-offset-2 hover:underline")}
          >
            {t(locale, "languagesAll")}
          </button>
        )}
      </span>
    </figcaption>
  );
}
