"use client";

import { cn } from "@/lib/utils";

// =============================================================================
// TrafficLights — the window control dots (close · minimize · zoom)
//
// iPadOS-style. At rest the three dots are *small* (like a ••• pill) —
//   • passive (unfocused) window → monotone grey dots
//   • active  (focused)  window → red / amber / green dots
// On a pointer device, hovering the pill grows them into full-size buttons and
// fades in the ×/−/+ glyphs (an intentional affordance). On touch they stay
// small and inert, so a tap falls through to the pill and opens the menu.
// =============================================================================

function Light({
  active,
  activeColor,
  label,
  onClick,
  glyph,
}: {
  active: boolean;
  activeColor: string;
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex items-center justify-center rounded-full text-black/55",
        "transition-all duration-150 active:scale-90",
        // Small at rest; grow to a comfortable button on hover (pointer only).
        "h-[6px] w-[6px]",
        "[@media(hover:hover)]:group-hover/chrome:h-3 [@media(hover:hover)]:group-hover/chrome:w-3",
        // Inert on touch → tap reaches the pill (menu); live on pointer devices.
        "pointer-events-none [@media(hover:hover)]:pointer-events-auto",
        active ? activeColor : "bg-black/30 dark:bg-white/35",
      )}
    >
      <span className="opacity-0 transition-opacity [@media(hover:hover)]:group-hover/chrome:opacity-100">
        {glyph}
      </span>
    </button>
  );
}

export function TrafficLights({
  active,
  onClose,
  onMinimize,
  onZoom,
}: {
  active: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onZoom: () => void;
}) {
  const stroke = "h-2 w-2 stroke-[2.5]";
  return (
    <div className="flex items-center gap-[5px] transition-all duration-150 [@media(hover:hover)]:group-hover/chrome:gap-2">
      <Light
        active={active}
        activeColor="bg-[#ff5f57] hover:brightness-95"
        label="Close"
        onClick={onClose}
        glyph={
          <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
            <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" fill="none" strokeLinecap="round" />
          </svg>
        }
      />
      <Light
        active={active}
        activeColor="bg-[#febc2e] hover:brightness-95"
        label="Minimize"
        onClick={onMinimize}
        glyph={
          <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
            <path d="M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
          </svg>
        }
      />
      <Light
        active={active}
        activeColor="bg-[#28c840] hover:brightness-95"
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
