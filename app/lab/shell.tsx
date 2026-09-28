"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { LAB_INDEX, labById, type LabId } from "./catalog";
import { useFrameStrings } from "./i18n";
import { LabNav } from "./nav";

// =============================================================================
// The lab shell — one frame for every lab.
//
// Every lab is the same four things, top to bottom:
//
//   crumbs    λhux / lab — the way out, and the way back to the index
//   title     the lab's name, which is also the switcher (LabNav)
//   blurb     what it lays open, from the catalog, in the reader's language
//   meta      the lab's live readout (what it is showing, what is pinned)
//
// and then one of two bodies:
//
//   document   a single column of sections (the Glow Lab)
//   workbench  a stage of specimens beside a panel of knobs (Attachments,
//              Icon, Legibility). On a phone the panel folds into one
//              `Controls` row under the header, closed: a phone gets the
//              specimens, and the knobs are one tap away rather than a
//              screenful of sliders in the way.
//   canvas     the whole width, for a lab that lays out its own body (the
//              Works Lab: a toolbar, the timeline, an inspector beside it).
//
// The panel is CSS-only responsive — the same markup on the server and in
// the browser — so nothing waits for a media query to paint.
// =============================================================================

export function LabShell({
  lab,
  layout = "document",
  meta,
  actions,
  panel,
  panelTitle,
  children,
}: {
  lab: LabId;
  layout?: "document" | "workbench" | "canvas";
  /** Mono readout under the blurb: live context, pins, unsaved changes. */
  meta?: ReactNode;
  /** Buttons across from the title (Save, Reset, …). */
  actions?: ReactNode;
  /** The workbench's knobs. */
  panel?: ReactNode;
  /** The folded panel's row on a phone; `Controls` by default. */
  panelTitle?: string;
  children: ReactNode;
}) {
  const header = <LabHeader lab={lab} meta={meta} actions={actions} />;

  if (layout === "document") {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-10 px-5 pb-32 pt-6 sm:space-y-12 sm:px-6 sm:pt-10">
        {header}
        {children}
      </main>
    );
  }

  if (layout === "canvas") {
    return (
      <main className="mx-auto w-full max-w-[1600px] px-5 pb-32 pt-6 sm:px-6 sm:pt-10">
        {header}
        <div className="mt-6 sm:mt-8">{children}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-5 pb-32 pt-6 sm:px-6 sm:pt-10">
      {header}
      <div className="mt-6 flex flex-col gap-6 sm:mt-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-10">{children}</div>
        {panel && <LabPanel title={panelTitle}>{panel}</LabPanel>}
      </div>
    </main>
  );
}

/** Crumbs, title-switcher, blurb and readout: the top of every lab. */
export function LabHeader({
  lab,
  meta,
  actions,
  className,
}: {
  lab: LabId;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const { locale } = useLocale();
  const entry = labById(lab);
  return (
    <header className={cn("ink-bare space-y-3", className)}>
      <LabCrumbs />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <LabNav />
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      <p className={cn(TYPE.body, "max-w-2xl")}>{entry.blurb[locale]}</p>
      {meta && <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">{meta}</div>}
    </header>
  );
}

/** `λhux / lab` — home, and the index of labs. */
export function LabCrumbs({ className }: { className?: string }) {
  const F = useFrameStrings();
  const link = "rounded-sm transition-colors hover:text-foreground focus-visible:text-foreground outline-none";
  return (
    <nav aria-label={F.breadcrumb} className={cn(TYPE.identifier, "flex items-center gap-1.5", className)}>
      <Link href="/" className={link}>
        λhux
      </Link>
      <span className="text-quaternary-foreground">/</span>
      <Link href={LAB_INDEX.href} className={link}>
        {LAB_INDEX.mark}
      </Link>
    </nav>
  );
}

/**
 * The workbench's knobs: a glass panel beside the stage on a wide screen
 * (sticky, scrolling on its own), and one folded row under the header on
 * anything narrower.
 */
export function LabPanel({
  title,
  className,
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const F = useFrameStrings();
  const [open, setOpen] = useState(false);
  return (
    <aside
      className={cn(
        "ink-flat order-first w-full shrink-0 self-start overflow-hidden rounded-2xl border border-border/50 bg-glass-sheet shadow-overlay backdrop-blur-xl",
        "lg:sticky lg:top-6 lg:order-none lg:max-h-[calc(100svh-3rem)] lg:w-[360px] lg:overflow-y-auto",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left lg:hidden"
      >
        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        <span className={cn(TYPE.label, "flex-1 text-foreground")}>
          {title ?? F.controls}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <div className={cn(open ? "block" : "hidden", "border-t border-border/60 lg:block lg:border-t-0")}>
        {children}
      </div>
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

/**
 * A strip of controls that stays with the reader: pinned under the top of the
 * page as the stage scrolls. The Glow Lab's drive, the Works Lab's toolbar.
 */
export function LabToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "ink-flat sticky top-3 z-20 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-border/50 bg-glass-popover px-4 py-3 shadow-overlay backdrop-blur-xl sm:gap-x-6 sm:px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A lab's action: mono, small, the one button everywhere. */
export function LabButton({
  tone = "ghost",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "ghost" | "primary" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-xs transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:h-3 [&_svg]:w-3",
        tone === "primary"
          ? "bg-foreground text-background hover:bg-foreground/90"
          : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
        className,
      )}
    />
  );
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
