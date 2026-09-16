"use client";

import { Segmented, Switch } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  ANCHORED_PRESENTATION,
  AdaptiveSurface,
  useSurfaceContext,
} from "@/systems/surface";
import { useRef, useState } from "react";
import {
  setReadingFocus,
  setReadingFont,
  setReadingMeasure,
  useReadingFocus,
  useReadingFont,
  useReadingMeasure,
  type ReadingFont,
  type ReadingMeasure,
} from "./reading-settings";

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
// What it shows is the reader's half of the module — typeface, measure, focus
// — in the reader's voice rather than the devtool's mono. Media bleed and the
// ruler's dock stay behind in the panel; they are knobs on how the site is
// built, not on how this article reads.
//
// The devtool keeps its module. Both write the same store, so both follow.
// ---------------------------------------------------------------------------

/** The rows. Inside the surface, so it can read the shape it landed in. */
function ReadingSettingsContent() {
  const { locale } = useLocale();
  const { isSheet } = useSurfaceContext();
  const font = useReadingFont();
  const measure = useReadingMeasure();
  const focus = useReadingFocus();

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
        // Content height: three rows, and the article behind them is the point.
        maxHeight="auto"
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
