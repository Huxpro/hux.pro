"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// =============================================================================
// Controls — the two settings widgets the site keeps re-drawing.
//
// A segmented picker and an on/off switch existed three times over: in the
// devtool panel, in the wallpaper picker's compact rows, and now wherever a
// reader changes something. They are one widget each; what differs is the
// voice of the surface they sit on, so that is the only thing parameterised.
// All three call this file — if a fourth copy appears, fold it in rather than
// letting this comment become a claim about the past.
//
//   system  the devtool's voice: mono, uppercase, a hairline box, and green
//           for on — a machine readout, and the green says "live".
//   reader  the article's voice: sans, sentence case, an inset track with a
//           raised thumb, grayscale. iOS's controls, in the site's ink.
//   bare    the log toolbar's voice: no track at all, just glyphs on the
//           line, with the selected one filled. It sits inside a row of
//           other controls rather than on its own, so a box around it would
//           be a second frame in a bar that has none.
//
// Anything that is genuinely per-use — what the options say, whether the
// labels carry their own typeface — stays with the caller.
// =============================================================================

export type ControlTone = "system" | "reader" | "bare";

/** `bare` has no track to fill, so it is a picker tone only. */
export type SwitchTone = Exclude<ControlTone, "bare">;

/**
 * Every difference between the two voices is a class string, so the branch is
 * a table rather than a ternary in the markup: a third tone is one entry here,
 * not four edits spread over two components.
 */
const SEGMENTED_TONE = {
  system: {
    group: "overflow-hidden rounded-md border border-border/60",
    segment: "px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider",
    selected: "bg-accent text-accent-foreground",
    idle: "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
  },
  reader: {
    group: "gap-0.5 rounded-lg bg-muted p-0.5",
    segment: "rounded-[0.4rem] px-3 py-1 text-xs leading-5",
    selected: "bg-background text-foreground shadow-sm",
    idle: "text-muted-foreground hover:text-foreground",
  },
  bare: {
    group: "items-center gap-0.5",
    segment:
      "inline-flex items-center justify-center rounded p-1 duration-200",
    selected: "bg-muted text-foreground",
    idle: "text-tertiary-foreground hover:text-foreground",
  },
} as const;

const SWITCH_TONE = {
  // Green is the devtool saying "live", and it only means that in there.
  system: "bg-green-500/90 border-green-500/70",
  reader: "border-transparent bg-foreground/85",
} as const;

export interface SegmentedOption<T extends string> {
  value: T;
  /** What the segment shows. A node, so an option can name its own typeface. */
  label: ReactNode;
  /** Tooltip, where the label is an abbreviation. */
  title?: string;
  /** Accessible name, where the label is a glyph rather than a word. */
  ariaLabel?: string;
}

/** Single-select, one row of segments. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  tone = "reader",
  label,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  tone?: ControlTone;
  /** Accessible name for the group, where no visible label names it. */
  label?: string;
}) {
  const t = SEGMENTED_TONE[tone];
  return (
    <div role="group" aria-label={label} className={cn("flex shrink-0", t.group)}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            title={o.title}
            aria-label={o.ariaLabel}
            aria-pressed={selected}
            className={cn(
              "transition-colors",
              t.segment,
              selected ? t.selected : t.idle
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pill on/off switch. */
export function Switch({
  on,
  onClick,
  label,
  tone = "reader",
  disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  tone?: SwitchTone;
  /** The setting is kept but has nothing to act on right now. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
        on ? SWITCH_TONE[tone] : "bg-muted/40 border-border/60",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
          on ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
