"use client";

import { Segmented, Switch } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  ANCHORED_PRESENTATION,
  AdaptiveSurface,
  useSurfaceContext,
} from "@/systems/surface";
import { useEffect, useRef, useState } from "react";
import {
  setBleedEnabled,
  setReadingFocus,
  setReadingFont,
  setReadingMeasure,
  useBleedEnabled,
  useReadingFocus,
  useReadingFont,
  useReadingMeasure,
  type ReadingFont,
  type ReadingMeasure,
} from "./reading-settings";
import { setRulerSide, useRulerSide, type RulerSide } from "./ruler-settings";

// ---------------------------------------------------------------------------
// ReadingSettings — the reader's way into the reading settings.
//
// The settings themselves are old (reading-settings.ts): persisted, global,
// live. Until now the only UI was the devtool's Reading module, which a reader
// has no reason to ever open — so the typeface and the measure were, in
// practice, ours and not theirs. This is the same store with a door on it.
//
// It is Books' "Aa": a sheet on a phone, a popover hanging off the button
// everywhere else (`ANCHORED_PRESENTATION`, systems/surface). The sheet is
// content-height and, like every surface here, non-modal: the article stays
// live behind it, so a tap on Serif is a tap you watch land.
//
// It shows the same five settings the devtool's module does, in the reader's
// voice rather than the devtool's mono, and only where each one does something:
//
//   typeface, column   always — the two that shape the text itself.
//   ruler              always. The ruler is screen furniture the reader can
//                      see and, on a touch screen, scrub with a thumb; which
//                      edge it is docked to is handedness, not configuration.
//   focus mode         not in the sheet. The reading line is at 40% of the
//                      viewport, and a phone screen holds a paragraph or two.
//   wide media         only past the width its CSS lives at. See BLEED_QUERY.
//
// A control that does nothing is worse than a control that is not there, so
// the two conditional rows are gated on the thing they actually drive rather
// than on taste.
//
// The devtool keeps its module. Both write the same store, so both follow.
// ---------------------------------------------------------------------------

/**
 * Media bleed exists only on wide screens: the rule that lets landscape media
 * break out of the reading column is inside `@media (min-width: 900px)` in
 * app/globals.css, and so is the `data-bleed-off` kill switch that undoes it.
 * Below that the setting is real and stored, but nothing reads it — so the row
 * is not offered. This query is that one, and has to keep matching it.
 */
const BLEED_QUERY = "(min-width: 900px)";

/** Whether a media query matches right now. False until mounted, so SSR agrees. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

/** The rows. Inside the surface, so it can read the shape it landed in. */
function ReadingSettingsContent() {
  const { locale } = useLocale();
  const { isSheet } = useSurfaceContext();
  const font = useReadingFont();
  const measure = useReadingMeasure();
  const focus = useReadingFocus();
  const bleed = useBleedEnabled();
  const side = useRulerSide();
  const canBleed = useMediaQuery(BLEED_QUERY);

  return (
    <div className="space-y-1 pt-1">
      <Row label={t(locale, "readingFont")}>
        <Segmented<ReadingFont>
          value={font}
          onChange={setReadingFont}
          label={t(locale, "readingFont")}
          options={[
            // Each option in the face it selects — the control is its own
            // specimen, which is the whole question being asked.
            {
              value: "sans",
              label: <span className="font-sans">{t(locale, "readingFontSans")}</span>,
            },
            {
              value: "serif",
              label: <span className="font-serif">{t(locale, "readingFontSerif")}</span>,
            },
          ]}
        />
      </Row>

      <Row label={t(locale, "readingMeasure")}>
        <Segmented<ReadingMeasure>
          value={measure}
          onChange={setReadingMeasure}
          label={t(locale, "readingMeasure")}
          options={[
            {
              value: "narrow",
              ariaLabel: t(locale, "readingMeasureNarrow"),
              title: t(locale, "readingMeasureNarrow"),
              // The glyph is the setting: the column, at its three widths.
              label: <Measure width={8} />,
            },
            {
              value: "default",
              ariaLabel: t(locale, "readingMeasureDefault"),
              title: t(locale, "readingMeasureDefault"),
              label: <Measure width={14} />,
            },
            {
              value: "wide",
              ariaLabel: t(locale, "readingMeasureWide"),
              title: t(locale, "readingMeasureWide"),
              label: <Measure width={20} />,
            },
          ]}
        />
      </Row>

      {/* Landscape media breaking out of the column — a wide-screen rule, so a
          wide-screen row. See BLEED_QUERY. */}
      {canBleed && (
        <Row label={t(locale, "readingBleed")}>
          <Switch
            on={bleed}
            onClick={() => setBleedEnabled(!bleed)}
            label={t(locale, "readingBleed")}
          />
        </Row>
      )}

      {/* Focus mode dims every block but the one at the reading line — which is
          at 40% of the viewport, and on a phone a screen holds a paragraph or
          two anyway. Nothing to dim, so nothing to offer. */}
      {!isSheet && (
        <Row label={t(locale, "readingFocus")}>
          <Switch
            on={focus}
            onClick={() => setReadingFocus(!focus)}
            label={t(locale, "readingFocus")}
          />
        </Row>
      )}

      {/* Which edge the ruler is docked to. Offered everywhere: the ruler is
          on a phone too, as bare ticks you scrub with a thumb, and that is
          exactly where the side you keep it on matters. */}
      <Row label={t(locale, "readingRuler")}>
        <Segmented<RulerSide>
          value={side}
          onChange={setRulerSide}
          label={t(locale, "readingRuler")}
          options={[
            { value: "left", label: t(locale, "readingRulerLeft") },
            { value: "right", label: t(locale, "readingRulerRight") },
          ]}
        />
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 px-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * A column of text, drawn small: three rules at the measure being offered,
 * the last one short the way a paragraph's last line is. The widths are the
 * whole message, so they are lengths rather than words to translate.
 */
function Measure({ width }: { width: number }) {
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 flex-col items-center justify-center gap-[3px]"
    >
      {[1, 1, 0.6].map((fraction, i) => (
        <span
          key={i}
          className="h-px rounded-full bg-current"
          style={{ width: width * fraction }}
        />
      ))}
    </span>
  );
}

/**
 * The "Aa" button and the surface it opens. Drop it anywhere on an article
 * page; it owns its own open state and anchors the popover to itself.
 */
export function ReadingSettings({ className }: { className?: string }) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t(locale, "readingSettings")}
        aria-expanded={open}
        className={cn(
          "inline-flex shrink-0 items-baseline gap-px rounded-md px-1.5 py-1",
          "transition-colors hover:bg-accent/40 hover:text-foreground",
          open ? "bg-accent text-foreground" : "text-muted-foreground",
          className
        )}
      >
        {/* Both faces in the mark, so the button says what it is for. */}
        <span className="font-sans text-[13px] leading-none">A</span>
        <span className="font-serif text-[15px] leading-none">a</span>
      </button>

      <AdaptiveSurface
        id="reading-settings"
        open={open}
        onOpenChange={setOpen}
        presentation={ANCHORED_PRESENTATION}
        anchor={anchor}
        title={t(locale, "readingSettingsTitle")}
        closeLabel={t(locale, "readingSettingsClose")}
        // A few rows, and the article behind them is the point: the sheet
        // takes the height of what it holds rather than a slab of the screen.
        fitContent
        popoverWidth="min(92vw, 288px)"
        // The button sits at the trailing edge of the header row; the card
        // hangs back over the article rather than out into the margin.
        popoverAlign="end"
      >
        <ReadingSettingsContent />
      </AdaptiveSurface>
    </>
  );
}
