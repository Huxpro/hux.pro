"use client";

import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

/**
 * Spotlight — a small, self-contained interactive demo.
 *
 * A card with a soft radial light that tracks the cursor. Serves as the
 * reference "inline" lab demo: a live React component mounted into the
 * on-page canvas (Stage), no iframe, no external dependency.
 */
export function SpotlightDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0.5, y: 0.4 });
  const [active, setActive] = useState(false);

  const handleMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      className="relative h-72 w-full overflow-hidden rounded-2xl bg-neutral-950 select-none cursor-crosshair"
      style={{
        backgroundImage: `radial-gradient(240px circle at ${pos.x * 100}% ${
          pos.y * 100
        }%, oklch(0.7 0.16 264 / ${active ? 0.45 : 0.18}), transparent 70%)`,
      }}
    >
      {/* dotted grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(oklch(1 0 0 / 0.6) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2 text-center">
        <span
          className={cn(
            "font-mono text-xs tracking-widest uppercase transition-colors duration-300",
            active ? "text-white" : "text-white/40"
          )}
        >
          move your cursor
        </span>
        <span className="text-white/70 text-sm">
          {Math.round(pos.x * 100)}, {Math.round(pos.y * 100)}
        </span>
      </div>
    </div>
  );
}
