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
//
// Anything that is genuinely per-use — what the options say, whether the
// labels carry their own typeface — stays with the caller.
// =============================================================================

export type ControlTone = "system" | "reader";

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
  tone?: ControlTone;
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

// =============================================================================
// HeaderAction — the chips a page puts under its big title.
//
// /writing and /docs already had these: the language filter's two segments.
// They are the site's word for "something you can do to this page", and they
// are mono because they belong to the machine layer, not to the prose. An
// article's header has its own — switch language, open reading settings — and
// until now they were each drawn differently and one of them floated off to
// the right margin, where the ruler lives.
//
// Same spec as the filter had inline, lifted here so there is one of it:
// mono xs, a soft chip, tertiary until you point at it, `bg-muted` when it is
// the state you are in.
//
// Not the only one yet. `components/log/works-toolbar.tsx` (#203) draws two
// more of these -- the pathspec chips and the density stops -- and arrived at
// the same rest state independently: nothing filled until something is
// chosen. Its inks are taken here, since it is the later and more worked-out
// reading of the same control: `text-foreground` for the chosen chip rather
// than `text-muted-foreground`, and hover going to `foreground` rather than
// stopping at `muted`. Two differences are left, for whoever folds the
// toolbar onto this: it pads `px-1.5` against this file's `px-2`, and while
// filtering it drops unchosen chips to quaternary, which is a third state
// this has no use for yet.
// =============================================================================

export function HeaderAction({
  active = false,
  variant = "segment",
  onClick,
  children,
  label,
  title,
  expanded,
  controls,
  className,
  ref,
}: {
  /** The chip is the state the page is in, not just a thing to press. */
  active?: boolean;
  /**
   * `segment` is a chip in a group where one of them is always the answer, so
   * the unpicked ones can sit back on tertiary -- the picked one anchors the
   * pair. `action` is a chip standing on its own with nothing lit beside it,
   * so it keeps the ink of the row it sits in and only paints its chip under
   * a pointer. Same shape either way; what differs is whether anything else
   * in the group is already bright.
   */
  variant?: "segment" | "action";
  onClick: () => void;
  children: ReactNode;
  /** Accessible name, where the chip's own text is not enough. */
  label?: string;
  title?: string;
  /** For a chip that opens something. */
  expanded?: boolean;
  controls?: string;
  className?: string;
  /** For a chip something is anchored to. React 19 takes `ref` as a prop. */
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      title={title}
      className={cn(
        // `pressable` is the touch contract any chip with a hover wash gets
        // (docs/design-system.md, "Touch"): the wash lands on the touch-down
        // frame instead of easing in behind a tap that is already over.
        "pressable inline-flex shrink-0 items-center gap-1 rounded px-2 py-1",
        "transition-colors duration-200",
        // An `action` sits in a line of running text, so its padding must not
        // show up as space: the negative margin cancels it exactly, leaving
        // the row's own gap as the only distance between one item and the
        // next. The chip is still there to be pressed and to paint on hover,
        // it just stops pushing its neighbours apart -- which it did
        // asymmetrically, since plain text either side has no padding to
        // match. `segment` keeps its padding: it stands in a group of its own.
        variant === "action" && "-mx-2",
        active && "bg-muted",
        variant === "segment"
          ? active
            ? "text-foreground"
            : "text-tertiary-foreground hover:text-foreground"
          : active
            ? "text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}
