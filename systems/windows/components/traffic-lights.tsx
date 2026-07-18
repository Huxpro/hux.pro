"use client";

import { cn } from "@/lib/utils";

// =============================================================================
// TrafficLights — the macOS window controls (close · minimize · zoom)
//
// Three coloured lozenges on the left of the title bar. Their glyphs (×, −, +)
// only appear on group hover, exactly like macOS, so at rest they read as calm
// dots. Each is a real <button> for keyboard + a11y.
// =============================================================================

function Light({
  color,
  label,
  onClick,
  glyph,
}: {
  color: string;
  label: string;
  onClick: () => void;
  glyph: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      // Keep the title-bar drag from starting on a control press.
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        "flex h-3 w-3 items-center justify-center rounded-full",
        "text-black/55 transition-transform active:scale-90",
        color,
      )}
    >
      <span className="opacity-0 transition-opacity group-hover/lights:opacity-100">
        {glyph}
      </span>
    </button>
  );
}

export function TrafficLights({
  onClose,
  onMinimize,
  onZoom,
}: {
  onClose: () => void;
  onMinimize: () => void;
  onZoom: () => void;
}) {
  const stroke = "h-2 w-2 stroke-[2.5]";
  return (
    <div className="group/lights flex items-center gap-2">
      <Light
        color="bg-[#ff5f57] hover:brightness-95"
        label="Close"
        onClick={onClose}
        glyph={
          <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" fill="none" strokeLinecap="round" />
          </svg>
        }
      />
      <Light
        color="bg-[#febc2e] hover:brightness-95"
        label="Minimize"
        onClick={onMinimize}
        glyph={
          <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
            <path d="M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
          </svg>
        }
      />
      <Light
        color="bg-[#28c840] hover:brightness-95"
        label="Zoom"
        onClick={onZoom}
        glyph={
          <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
            <path d="M5 2.2v5.6M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
          </svg>
        }
      />
    </div>
  );
}
