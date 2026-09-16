"use client";

import { Segmented, Switch } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  ANCHORED_PRESENTATION,
  AdaptiveSurface,
  HEADER_BUTTON,
} from "@/systems/surface";
import { useRef, useState } from "react";
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
// voice rather than the devtool's mono. Four of them are offered everywhere.
//
// Wide media is the one exception, and it is not a taste call: the rule that
// lets landscape media break out of the column lives entirely inside the
// `bleed` breakpoint (app/globals.css), so under that width the switch would
// be wired to nothing. The row hides itself with the `bleed:` variant of that
// same breakpoint — one number, so the control and the rule it drives cannot
// drift apart, and nothing has to be measured in JS to know.
//
// Everything else is shown at every width even where it is less useful. These
// are single, global, persisted settings: hiding focus mode on a phone would
// mean a reader who turned it on at a desk had no way to turn it off in a
// pocket, and the devtool is not a door a reader opens.
//
// The devtool keeps its module. Both write the same store, so both follow.
// ---------------------------------------------------------------------------

/** The rows. */
function ReadingSettingsContent() {
  const { locale } = useLocale();
  const font = useReadingFont();
  const measure = useReadingMeasure();
  const focus = useReadingFocus();
  const bleed = useBleedEnabled();
  const side = useRulerSide();

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

      {/* Hidden by the same breakpoint that carries the rule it switches, so
          the two cannot drift. See the note at the top of this file. */}
      <Row label={t(locale, "readingBleed")} className="hidden bleed:flex">
        <Switch
          on={bleed}
          onClick={() => setBleedEnabled(!bleed)}
          label={t(locale, "readingBleed")}
        />
      </Row>

      <Row label={t(locale, "readingFocus")}>
        <Switch
          on={focus}
          onClick={() => setReadingFocus(!focus)}
          label={t(locale, "readingFocus")}
        />
      </Row>

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

function Row({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 items-center justify-between gap-4 px-1",
        className
      )}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Full, full, and a short last line — a paragraph's shape in three rules. */
const MEASURE_RULES = [1, 1, 0.6];

/**
 * A column of text, drawn small, at the measure being offered. The widths are
 * the whole message, so they are lengths rather than words to translate.
 */
function Measure({ width }: { width: number }) {
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 flex-col items-center justify-center gap-[3px]"
    >
      {MEASURE_RULES.map((fraction, i) => (
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
          // The same button every surface header uses, at meta-row size, so it
          // brightens and presses like the close button it will sit next to.
          HEADER_BUTTON,
          "inline-flex items-baseline gap-px px-1.5 py-1",
          open && "bg-accent text-foreground",
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
        popover={{
          anchor,
          width: "min(92vw, 288px)",
          // The button sits at the trailing edge of the header row; the card
          // hangs back over the article rather than out into the margin.
          align: "end",
        }}
        title={t(locale, "readingSettingsTitle")}
        closeLabel={t(locale, "readingSettingsClose")}
        // A few rows, and the article behind them is the point: the sheet
        // takes the height of what it holds rather than a slab of the screen.
        fitContent
      >
        <ReadingSettingsContent />
      </AdaptiveSurface>
    </>
  );
}
