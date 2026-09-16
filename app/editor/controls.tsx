"use client";

/**
 * The editor surface's form vocabulary.
 *
 * Mono uppercase labels, subtle borders, grayscale — the "System UI" dialect
 * shared by the studios under `/editor`: the Icon Studio, the Legibility Lab
 * and the Sky Engine Lab. One set of primitives so a slider means the same
 * thing in all three, and so a new studio is sections and plots rather than
 * another copy of these. (`Slider` itself is the site-wide one from
 * `components/ui/slider.tsx`, re-exported here.)
 *
 * The labs add a second half — the amber `*` that marks a live value which
 * differs from what ships, the flat chip, the key/value readout, the quiet
 * note — so "this is not what ships" reads the same in every lab.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border/60 px-5 py-5">
      <h2 className="mb-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  as = "label",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  /**
   * A `<label>` labels the one control inside it. A row of chips or a
   * segmented switch is several buttons, and buttons inside a label fall out
   * of the accessibility tree — so a group of them takes a `<div>` and the
   * label is plain text above it.
   */
  as?: "label" | "div";
}) {
  const Tag = as;
  return (
    <Tag className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint !== undefined && (
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {hint}
          </span>
        )}
      </span>
      {children}
    </Tag>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  columns,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Render as an even N-column grid instead of a single flex row. Use when
   *  there are too many options to fit one row (e.g. the texture picker). */
  columns?: number;
}) {
  return (
    <div
      className={cn(
        "gap-1 rounded-md border border-border/60 p-1",
        columns ? "grid" : "flex flex-wrap",
      )}
      style={
        columns
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2 py-1 text-xs font-mono transition-colors",
            columns ? "" : "flex-1",
            value === opt.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// The site's one range input, re-exported so a studio imports its whole
// vocabulary from here.
export { Slider };

export function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-tertiary-foreground focus:border-foreground/40"
    />
  );
}

export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-center justify-between"
    >
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          value ? "bg-foreground" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
            value ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

const SWATCHES = [
  "#1a1a1a",
  "#000000",
  "#ededed",
  "#ffffff",
  "#2a2a2a",
  "#737373",
];

export function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border/60 bg-transparent"
        aria-label="Color picker"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-md border border-border/60 bg-transparent px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-foreground/40"
      />
      <div className="flex gap-1">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            style={{ backgroundColor: c }}
            className="h-5 w-5 rounded-full border border-border/60 transition-transform hover:scale-110"
          />
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// The labs' half
// -----------------------------------------------------------------------------

/**
 * The "this is not what ships" mark, or the space it would take.
 *
 * Amber, beside the slider it belongs to; clicking it puts the value back.
 * The devtool draws the same star (`PanelStar`), so a tuned number reads the
 * same wherever it is met.
 */
export function Star({
  active = true,
  onReset,
  title,
}: {
  active?: boolean;
  onReset: () => void;
  title: string;
}) {
  if (!active) return <span className="w-2.5" />;
  return (
    <button
      type="button"
      onClick={onReset}
      title={title}
      aria-label={title}
      className="ink-flat ml-1 font-mono text-amber-500/90 transition-colors hover:text-amber-400"
    >
      *
    </button>
  );
}

/** A flat chip — the labs' pick-one-of-many, in a row that wraps. */
export function Chip({
  active,
  onClick,
  title,
  disabled,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors disabled:opacity-40",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A key/value line: the readout half of the labs' vocabulary. */
export function Readout({
  k,
  v,
  title,
  tone = "normal",
}: {
  k: React.ReactNode;
  v: React.ReactNode;
  title?: string;
  tone?: "normal" | "good" | "bad";
}) {
  return (
    <div
      title={title}
      className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
    >
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span
        className={cn(
          "truncate text-right tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "bad" && "text-amber-600 dark:text-amber-400",
          tone === "normal" && "text-foreground",
        )}
      >
        {v}
      </span>
    </div>
  );
}

/** A quiet explanatory line under a group of levers. */
export function Note({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] leading-snug text-muted-foreground/60", className)}>
      {children}
    </p>
  );
}

/** A colour, as a dot — for legends and tables where a picker is too heavy. */
export function Swatch({ color, title }: { color: string; title?: string }) {
  return (
    <span
      title={title ?? color}
      style={{ backgroundColor: color }}
      className="inline-block size-3 shrink-0 rounded-sm ring-1 ring-border"
    />
  );
}

/** The labs' outlined action button: copy, reset, save. */
export function LabButton({
  onClick,
  disabled,
  title,
  primary,
  children,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** The one action that commits: filled, not outlined. */
  primary?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "bg-foreground text-background hover:bg-foreground/90"
          : "border border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Copies `text` to the clipboard and says so for a moment. */
export function CopyButton({
  text,
  label,
  title,
}: {
  text: string | (() => string);
  label: string;
  title?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <LabButton
      title={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          // Clipboard unavailable — the export textarea beside it is selectable.
        }
      }}
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label}
    </LabButton>
  );
}
