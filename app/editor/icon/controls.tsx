"use client";

/**
 * Small, design-system-aligned form primitives for the icon editor.
 * Mono uppercase labels, subtle borders, grayscale — the "System UI" vocabulary
 * used across the editor surface.
 */

import { cn } from "@/lib/utils";

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
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border border-border/60 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 rounded px-2 py-1 text-xs font-mono transition-colors",
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

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
    />
  );
}

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
      className="w-full rounded-md border border-border/60 bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40"
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
