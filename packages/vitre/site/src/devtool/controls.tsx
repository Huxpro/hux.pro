import { useState, type ReactNode } from "react";

// The main site's devtool vocabulary — a collapsible section, a row with a
// label, a toggle, a segmented control, a range and a `*` — rebuilt without
// Tailwind so the demo stays standalone. See ../styles.css (`.dt-*`).

export function Section({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="dt-section">
      <button type="button" className="dt-section-head" onClick={() => setOpen((o) => !o)}>
        <span className="dt-chevron" data-open={open || undefined}>›</span>
        <span className="dt-section-title">{title}</span>
        {badge && <span className="dt-badge">{badge}</span>}
      </button>
      {open && <div className="dt-section-body">{children}</div>}
    </section>
  );
}

/** `*` when a row is not at its default; clicking it resets the row. */
export function Star({ show, onReset }: { show: boolean; onReset: () => void }) {
  if (!show) return null;
  return (
    <button type="button" className="dt-star" title="Not the default — reset" onClick={onReset}>
      *
    </button>
  );
}

export function Row({ label, star, children }: { label: ReactNode; star?: ReactNode; children?: ReactNode }) {
  return (
    <div className="dt-row">
      <span className="dt-label">
        {label}
        {star}
      </span>
      {children}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="dt-toggle"
      data-on={on || undefined}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
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
    <div className="dt-segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          data-on={value === o.value || undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Range({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <span className="dt-range">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="dt-mono">{value}px</span>
    </span>
  );
}

export function Readout({ value }: { value: unknown }) {
  return <pre className="dt-readout">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>;
}

export function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="dt-action" onClick={onClick}>
      {children}
    </button>
  );
}
