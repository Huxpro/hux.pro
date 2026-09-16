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
//
//   system  the devtool's voice: mono, uppercase, a hairline box, and green
//           for on — a machine readout, and the green says "live".
//   reader  the article's voice: sans, sentence case, an inset track with a
//           raised thumb, grayscale. iOS's controls, in the site's ink.
//
// Anything that is genuinely per-use — what the options say, whether the
// labels carry their own typeface — stays with the caller.
// =============================================================================

export type ControlTone = "system" | "reader";

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
  className,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  tone?: ControlTone;
  /** Accessible name for the group, where no visible label names it. */
  label?: string;
  className?: string;
}) {
  const system = tone === "system";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "flex shrink-0",
        system
          ? "overflow-hidden rounded-md border border-border/60"
          : "gap-0.5 rounded-lg bg-muted p-0.5",
        className
      )}
    >
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
              system
                ? "px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider"
                : "rounded-[0.4rem] px-3 py-1 text-xs leading-5",
              selected
                ? system
                  ? "bg-accent text-accent-foreground"
                  : "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
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
  tone?: ControlTone;
  /** The setting is kept but has nothing to act on right now. */
  disabled?: boolean;
}) {
  const system = tone === "system";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      aria-label={label}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
        on
          ? system
            ? "bg-green-500/90 border-green-500/70"
            : "border-transparent bg-foreground/85"
          : "bg-muted/40 border-border/60",
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
