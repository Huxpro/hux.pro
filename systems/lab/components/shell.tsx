"use client";

import { Popover } from "@base-ui/react/popover";
import { Info, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { BAND_RESERVE, PinnedSlot } from "@/components/ui/pinned-slot";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useOptionalDevtool } from "@/systems/devtool";
import { useBandSelect } from "@/systems/dock";
import { labById, type LabId } from "../catalog";
import { useFrameStrings } from "../i18n";
import { LabNav } from "./nav";

// =============================================================================
// The lab shell — one frame for every lab.
//
// A lab opens on its work, not on a paragraph about it. The top of every lab
// is one sticky bar (LabBar), and everything a lab says about itself lives
// in it:
//
//   λhux / Name ▾ (i)   the way home, the lab's name — which is also the
//                       switcher between labs (LabNav) — and an info
//                       button whose popover holds the catalog's blurb and
//                       the lab's full live readout
//   tools               what drives the stage (the Works Lab's form, the
//                       Glow Lab's on / level / microphone)
//   meta                the live readout, one truncated mono line (wide
//                       screens; always complete in the info popover)
//   actions             what writes (SVG, Reset, Save) — right-aligned
//
// A lab with none of the three still gets the bar: its name and the way to
// the others, pinned.
//
// Under the bar, one of three bodies:
//
//   document   a single column of sections (the Glow Lab)
//   workbench  a stage of specimens beside a panel of knobs (Attachments,
//              Icon, Legibility). Beside the stage from `lg`; narrower, the
//              panel is folded away and the bar's sliders button opens it
//              under the bar — a phone gets the specimens, and the knobs are
//              one tap away rather than a screenful of sliders in the way.
//   canvas     the whole width, for a lab that lays out its own body (the
//              Works Lab: the timeline, an inspector beside it).
//
// The bar is a pinned bar like /works's toolbar: it rides in a PinnedSlot and
// shares the top band with the Dock by whatever composition the band is set
// to (systems/dock/band.ts) — its name kept whole, its tools wrapping under
// it when they do not fit beside it. Its first row is the band's height, so
// it stands level with the Dock's pills. Anything that sticks under it reads
// `--lab-under-bar`. A lab can set the bar aside (`pin="static"`) while
// another bar is the one pinned (the Band Lab, trying /prompt's).
// =============================================================================

/** Where the bar pins, and where a panel under it may pin. */
const BAR_VARS =
  "[--lab-bar-top:max(0.75rem,calc(var(--dock-clear)+0.5rem))] [--lab-under-bar:calc(var(--lab-bar-top)+3.25rem)]";

export function LabShell({
  lab,
  layout = "document",
  meta,
  tools,
  actions,
  panel,
  scrollTools,
  pin = "band",
  children,
}: {
  lab: LabId;
  layout?: "document" | "workbench" | "canvas";
  /** Whether the bar holds the top (in the band), or scrolls away. */
  pin?: LabBarPin;
  /** The live readout: what the lab is showing, what is pinned. */
  meta?: ReactNode;
  /** What drives the stage, in the bar after the name. */
  tools?: ReactNode;
  /** What writes, at the bar's right end (SVG, Reset, Save, …). */
  actions?: ReactNode;
  /** The workbench's knobs. */
  panel?: ReactNode;
  /**
   * Tools longer than the bar (a library guide's section tabs): they scroll
   * in the room between the name and the actions rather than wrapping the
   * actions onto a row of their own; on a phone, they take the second row
   * and the actions stay beside the name.
   */
  scrollTools?: boolean;
  children: ReactNode;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  // The bar rests on the Dock's line (0.5rem), as it does once pinned.
  const top = pin === "band" ? "pt-2" : "pt-3";
  const bar = (
    <LabBar
      lab={lab}
      meta={meta}
      tools={tools}
      scrollTools={scrollTools}
      actions={actions}
      panel={layout === "workbench" && panel ? { open: panelOpen, toggle: () => setPanelOpen((o) => !o) } : undefined}
      pin={pin}
    />
  );

  if (layout === "document") {
    return (
      <main className={cn(BAR_VARS, "mx-auto w-full max-w-5xl px-4 pb-32 sm:px-6", top)}>
        {bar}
        <div className="mt-8 space-y-12 sm:mt-10">{children}</div>
      </main>
    );
  }

  if (layout === "canvas") {
    return (
      <main className={cn(BAR_VARS, "mx-auto w-full max-w-[1600px] px-4 pb-32 sm:px-6", top)}>
        {bar}
        <div className="mt-6 sm:mt-8">{children}</div>
      </main>
    );
  }

  return (
    <main className={cn(BAR_VARS, "mx-auto w-full max-w-[1600px] px-4 pb-32 sm:px-6", top)}>
      {bar}
      <div className="mt-6 flex flex-col gap-6 sm:mt-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-10">{children}</div>
        {panel && <LabPanel open={panelOpen}>{panel}</LabPanel>}
      </div>
    </main>
  );
}

export type LabBarPin = "band" | "static";

/** The one sticky bar at the top of every lab. */
export function LabBar({
  lab,
  meta,
  tools,
  scrollTools,
  actions,
  panel,
  pin = "band",
}: {
  lab: LabId;
  meta?: ReactNode;
  tools?: ReactNode;
  scrollTools?: boolean;
  actions?: ReactNode;
  /** A workbench's folded panel: the bar's sliders button opens it below `lg`. */
  panel?: { open: boolean; toggle: () => void };
  pin?: LabBarPin;
}) {
  const F = useFrameStrings();
  // A count opened folds the bar to a ball (PinnedSlot draws it); the bar
  // is its own glass, so it can fade itself without breaking its blur.
  const open = useBandSelect((g) => g.mode === "open");
  const folded = pin === "band" && open;
  // The devtool's floating pill is fixed at the top-right, where the bar's
  // actions end. A lab that turns the devtool on (Legibility, Vitre) would
  // lose its last action under it, so the bar makes room while it shows.
  const devtool = useOptionalDevtool();
  const pill = !!devtool?.isEnabled && devtool.isFloating && !devtool.isOpen;
  const bar = (
    <div
      className={cn(
        "ink-flat z-30",
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border/50 bg-glass-popover px-3 shadow-overlay backdrop-blur-xl sm:px-4",
        // Its first row is a pill's height, level with the Dock's; the
        // tools wrap under it when they do not fit beside it.
        "min-h-9 py-px",
        pin === "band" && [BAND_RESERVE, "origin-left transition-[max-width,opacity,transform]"],
        folded && "pointer-events-none scale-95 opacity-0",
        // Last, so it wins over the padding above.
        pill && "sm:pr-[7.5rem]",
      )}
    >
      <div data-bar-keep className="flex min-w-0 items-center gap-1.5">
        <Link
          href="/"
          className={cn(TYPE.identifier, "shrink-0 rounded-sm transition-colors hover:text-foreground")}
        >
          λhux
        </Link>
        <span className="text-quaternary-foreground">/</span>
        <LabNav appearance="bar" />
        <LabInfo lab={lab} meta={meta} />
      </div>
      {/* One row, never a pile: beside the name when it fits, on a line
          of its own when it does not, and sideways-scrolling there rather
          than wrapping into a third — a pinned bar has to stay short. */}
      {tools && (
        <div
          data-lab-tools
          className={cn(
            "no-scrollbar relative -my-1 flex min-w-0 flex-nowrap items-center gap-x-3 overflow-x-auto py-1 [&>*]:shrink-0",
            // From no width up to its own: it never pushes the actions off
            // the row, and takes no more room than it needs.
            scrollTools && "max-sm:order-last max-sm:w-full sm:max-w-fit sm:flex-1 sm:basis-0",
          )}
        >
          {tools}
        </div>
      )}
      {meta && (
        <div className="hidden min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground xl:block">
          {meta}
        </div>
      )}
      {(actions || panel) && (
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actions}
          {panel && (
            <button
              type="button"
              onClick={panel.toggle}
              aria-expanded={panel.open}
              aria-label={F.controls}
              title={F.controls}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md transition-colors lg:hidden",
                panel.open
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
  if (pin !== "band") return bar;
  return (
    <PinnedSlot
      className="sticky top-[var(--lab-bar-top)] z-30"
      outset={0}
      insetTop="0px"
    >
      {bar}
    </PinnedSlot>
  );
}

/** (i) — what the lab lays open, and its whole live readout. */
function LabInfo({ lab, meta }: { lab: LabId; meta?: ReactNode }) {
  const { locale } = useLocale();
  const F = useFrameStrings();
  const entry = labById(lab);
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={F.about}
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-tertiary-foreground outline-none transition-colors",
          "hover:bg-foreground/[0.06] hover:text-foreground focus-visible:text-foreground data-[popup-open]:text-foreground",
        )}
      >
        <Info className="h-3.5 w-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup
            className={cn(
              "w-[min(24rem,calc(100vw-2rem))] origin-[var(--transform-origin)] space-y-3 rounded-xl border border-border/50",
              "bg-glass-sheet p-4 shadow-overlay backdrop-blur-xl outline-none",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "transition-[transform,opacity] duration-150",
            )}
          >
            <Popover.Title className={TYPE.rowTitle}>{entry.name[locale]}</Popover.Title>
            <Popover.Description className={TYPE.body}>{entry.blurb[locale]}</Popover.Description>
            {meta && (
              <div className="border-t border-border/50 pt-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {meta}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * The workbench's knobs: a glass panel beside the stage on a wide screen
 * (sticky under the bar, scrolling on its own), and folded away on anything
 * narrower until the bar's sliders button opens it above the stage.
 */
export function LabPanel({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={cn(
        "ink-flat order-first w-full shrink-0 self-start overflow-hidden rounded-2xl border border-border/50 bg-glass-sheet shadow-overlay backdrop-blur-xl",
        open ? "block" : "hidden",
        "lg:sticky lg:top-[var(--lab-under-bar)] lg:order-none lg:block lg:max-h-[calc(100svh-var(--lab-under-bar)-1rem)] lg:w-[360px] lg:overflow-y-auto",
        className,
      )}
    >
      {children}
    </aside>
  );
}

/** A titled group of specimens on a lab's stage. */
export function LabSection({
  title,
  note,
  aside,
  className,
  children,
}: {
  title: ReactNode;
  note?: ReactNode;
  /** Controls that belong to this section alone, across from its title. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="ink-bare min-w-0 space-y-1">
          <h2 className={TYPE.label}>{title}</h2>
          {note && <p className={cn(TYPE.caption, "max-w-2xl")}>{note}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The one button's look, for a link that is a lab's action too. */
export function labButtonClass(tone: "ghost" | "primary" = "ghost") {
  return cn(
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:h-3 [&_svg]:w-3",
    tone === "primary"
      ? "bg-foreground text-background hover:bg-foreground/90"
      : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
  );
}

/** A lab's action: mono, small, the one button everywhere. */
export function LabButton({
  tone = "ghost",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "ghost" | "primary" }) {
  return <button type="button" {...props} className={cn(labButtonClass(tone), className)} />;
}

/** A pill that a toggle wears: on is ink, off is a hairline. */
export function LabChip({
  on,
  onClick,
  className,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      {...props}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5",
        "disabled:cursor-default disabled:opacity-45",
        on
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** `unsaved` — the edit is live here and not yet on disk. */
export function LabUnsaved() {
  const F = useFrameStrings();
  return (
    <span className="ink-flat rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-500">
      {F.unsaved}
    </span>
  );
}
