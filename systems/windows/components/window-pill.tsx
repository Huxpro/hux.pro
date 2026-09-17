"use client";

import { cn } from "@/lib/utils";

// =============================================================================
// The chrome pill — the traffic lights and the glass they sit on
//
// One look, two homes: the floating pill of a desktop window (window-chrome)
// and the grip of a phone window (window-grip), which is the same pill doing
// double duty as the sheet's handle. Both are chromeless at rest and light up
// into glass while something is happening, so the window stays edge-to-edge
// content with nothing that reads as a title bar.
// =============================================================================

/** What a traffic light does. The dispatch lives with the window. */
export type DotAction = "close" | "minimize" | "zoom";

/** A traffic-light dot: dim grey at rest, coloured (active window) on hover. */
function Dot({
  active,
  interacting,
  interactive,
  colorHover,
  label,
  onClick,
  glyph,
}: {
  active: boolean;
  /** Window is being dragged/resized or its menu is open → controls "wake up". */
  interacting: boolean;
  /** False where the dots are an indicator only — a phone window's grip. */
  interactive: boolean;
  colorHover: string;
  label: string;
  onClick: () => void;
  glyph: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-window-control
      aria-label={label}
      title={label}
      tabIndex={interactive ? undefined : -1}
      aria-hidden={interactive ? undefined : true}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex cursor-default items-center justify-center rounded-full text-black/55",
        "transition-all duration-150 active:scale-90",
        // Small on touch; always full-size on desktop.
        "h-[6px] w-[6px] [@media(hover:hover)]:h-3 [@media(hover:hover)]:w-3",
        // Inert on touch → tap reaches the pill (menu); live on pointer devices.
        // On a grip they are never live: the whole pill is one handle, and Base
        // UI would refuse to start a swipe from a <button> anyway.
        interactive
          ? "pointer-events-none [@media(hover:hover)]:pointer-events-auto"
          : "pointer-events-none",
        // Grey base (no `dark:`, to avoid out-specifying the hover colour in
        // dark mode). Dim at rest on both platforms; full when interacting, and
        // coloured (active window only) on desktop hover.
        "bg-zinc-500",
        interacting
          ? "opacity-100"
          : "opacity-40 [@media(hover:hover)]:group-hover/chrome:opacity-100",
        active && interactive && colorHover,
      )}
    >
      <span className="opacity-0 transition-opacity [@media(hover:hover)]:group-hover/chrome:opacity-100">
        {glyph}
      </span>
    </button>
  );
}

const stroke = "h-2 w-2 stroke-[2.5]";

// The three traffic lights, in macOS order (close · minimize · zoom). `action`
// keys into the per-window dispatch the window builds. Colours are the on-hover
// fills (active window only); glyphs show on hover.
const DOTS: {
  label: string;
  action: DotAction;
  colorHover: string;
  glyph: React.ReactNode;
}[] = [
  {
    label: "Close",
    action: "close",
    colorHover: "[@media(hover:hover)]:group-hover/chrome:bg-[#ff5f57]",
    glyph: (
      <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
        <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Minimize",
    action: "minimize",
    colorHover: "[@media(hover:hover)]:group-hover/chrome:bg-[#febc2e]",
    glyph: (
      <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
        <path d="M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Zoom",
    action: "zoom",
    colorHover: "[@media(hover:hover)]:group-hover/chrome:bg-[#28c840]",
    glyph: (
      <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
        <path d="M5 2.2v5.6M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
];

/**
 * The three dots, grouped so the title never adds a gap at rest (mobile
 * symmetry). The order is load-bearing: close · minimize · zoom, like macOS.
 * Omit `onAction` where they are an indicator rather than three targets.
 */
export function TrafficDots({
  focused,
  interacting,
  onAction,
}: {
  focused: boolean;
  interacting: boolean;
  onAction?: (action: DotAction) => void;
}) {
  return (
    <div
      data-window-dots
      className="flex items-center gap-[5px] [@media(hover:hover)]:gap-2"
    >
      {DOTS.map((dot) => (
        <Dot
          key={dot.label}
          active={focused}
          interacting={interacting}
          interactive={!!onAction}
          colorHover={dot.colorHover}
          label={dot.label}
          onClick={() => onAction?.(dot.action)}
          glyph={dot.glyph}
        />
      ))}
    </div>
  );
}

/**
 * The pill the dots sit on. Two states, kept mutually exclusive so light/dark
 * utilities never fight on specificity: chromeless at rest, glass while
 * something is happening — which is what gives a phone pill its glass look,
 * there being no hover to light it.
 *
 * `hoverLights` adds the desktop's hover state; a grip leaves it off, since a
 * press is the only thing that wakes it.
 */
export function pillShell(interacting: boolean, hoverLights = true) {
  return cn(
    "group/chrome flex cursor-default items-center rounded-full px-2.5 py-1.5",
    "touch-none select-none transition-all duration-200",
    interacting
      ? "border-black/10 bg-white/80 shadow-raised backdrop-blur-xl dark:border-white/14 dark:bg-black/60"
      : cn(
          "border-transparent bg-transparent shadow-none",
          hoverLights &&
            cn(
              // `hover:` (not group-hover) since this element *is* the group.
              "[@media(hover:hover)]:hover:border-black/10 [@media(hover:hover)]:hover:bg-white/80 [@media(hover:hover)]:hover:shadow-raised [@media(hover:hover)]:hover:backdrop-blur-xl",
              "dark:[@media(hover:hover)]:hover:border-white/14 dark:[@media(hover:hover)]:hover:bg-black/60",
            ),
        ),
  );
}
