"use client";

/**
 * The editor surface's form vocabulary.
 *
 * Mono uppercase labels, subtle borders, grayscale — the "System UI" dialect
 * shared by the studios under `/editor`: the Icon Studio, the Legibility Lab
 * and the Sky Engine Lab. One set of primitives so a slider means the same
 * thing in all three, and so a new studio is panels and plots rather than
 * another copy of these. (`Slider` itself is the site-wide one from
 * `components/ui/slider.tsx`, re-exported here.)
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-foreground">{label}</span>
        {hint !== undefined && (
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
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
// Denser primitives — for studios with more levers than the icon's twelve
// -----------------------------------------------------------------------------

/**
 * A `Section` that folds.
 *
 * The Sky Engine Lab has six panels over a hundred-odd levers; every one open
 * at once is a wall. `defaultOpen` decides what a first visit shows.
 */
export function Panel({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors hover:bg-muted/20"
      >
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <ChevronDown
            className={cn("h-3 w-3 transition-transform duration-200", !open && "-rotate-90")}
          />
          {title}
        </span>
        {hint && (
          <span className="truncate font-mono text-[10px] tabular-nums text-tertiary-foreground">
            {hint}
          </span>
        )}
      </button>
      {open && <div className="flex flex-col gap-3.5 px-5 pb-5">{children}</div>}
    </section>
  );
}

/** A small outlined button — the editor's chip. */
export function Chip({
  active,
  onClick,
  title,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
        active
          ? "border-foreground/30 bg-foreground text-background"
          : "border-border/60 text-muted-foreground hover:bg-muted/30 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A key/value line: the readout half of the editor's vocabulary. */
export function Readout({
  label,
  value,
  title,
  tone = "normal",
}: {
  label: string;
  value: React.ReactNode;
  title?: string;
  tone?: "normal" | "good" | "bad";
}) {
  return (
    <div
      title={title}
      className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
    >
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "truncate tabular-nums",
          tone === "good" && "text-emerald-500",
          tone === "bad" && "text-amber-500",
          tone === "normal" && "text-foreground/85",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * A slider with its number, and a dot that appears once the value has left the
 * default — click it to go back. The same "what did I change?" affordance the
 * devtool's `*` gives, in the editor's dialect.
 */
export function NumberRow({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  format = (v) => v.toFixed(2),
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const dirty = defaultValue !== undefined && Math.abs(value - defaultValue) > 1e-9;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1 text-xs text-foreground">
          {label}
          {dirty && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onChange(defaultValue);
              }}
              title={`Back to the default (${format(defaultValue)})`}
              aria-label={`Reset ${label}`}
              className="text-[13px] leading-none text-amber-500 transition-opacity hover:opacity-70"
            >
              *
            </button>
          )}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {format(value)}
        </span>
      </span>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
    </label>
  );
}

/** A quiet explanatory line under a group of levers. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] leading-relaxed text-tertiary-foreground">
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
      className="inline-block h-3 w-3 shrink-0 rounded-sm ring-1 ring-border/60"
    />
  );
}
