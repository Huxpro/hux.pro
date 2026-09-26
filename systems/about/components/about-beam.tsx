"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/services";
import { glowTuning, type GlowMotion } from "@/systems/glow";
import { BorderBeam } from "border-beam";
import type { CSSProperties } from "react";
import { VITRE_LAYER_ATTRIBUTE } from "vitre";

// =============================================================================
// AboutBeam — the About's ring drawn by Libraries.dev's border-beam instead.
//
// A devtool engine switch (Glow · About · engine), to judge our light against
// the reference on the one ring that matters. border-beam is used through its
// own API only; the devtool's knobs map onto it as far as it has them:
//
//   motion     rotate → `md` (the arc and its spark), pulse → `pulse-inner`;
//              flow has no border-beam kind and shows as `md`
//   strength   `strength` (× the site-wide strength)
//   depth      `glowSize`, which scales every blur radius it draws. Its
//              colour blobs are fixed pixel sizes tuned for a card, so depth
//              here is an approximation: no share of the gutter, no extent.
//   period     `duration`
//   radius     `borderRadius` — the screen's (`screenRadius`)
//
// Loaded on demand (next/dynamic in the surface), so the page never ships it
// unless the switch is thrown.
// =============================================================================

export interface AboutBeamProps {
  active: boolean;
  motion: GlowMotion;
  strength: number;
  /** The devtool's depth share for the current layout (1.3 on a desk). */
  depth: number;
  radius: number;
  style?: CSSProperties;
  layer?: boolean;
  className?: string;
}

export default function AboutBeam({
  active,
  motion,
  strength,
  depth,
  radius,
  style,
  layer,
  className,
}: AboutBeamProps) {
  const { theme } = useTheme();
  const pulse = motion === "pulse";
  return (
    <div
      aria-hidden
      {...(layer ? { [VITRE_LAYER_ATTRIBUTE]: "" } : {})}
      className={cn("pointer-events-none fixed inset-0", className)}
      style={style}
    >
      <BorderBeam
        size={pulse ? "pulse-inner" : "md"}
        theme={theme}
        active={active}
        strength={Math.min(1, strength * glowTuning().strength)}
        // Its blurs are tuned for a card (8px); the About's depth of 1.3
        // makes them ~4× that across a screen.
        glowSize={Math.max(0.5, depth * 3)}
        borderRadius={Math.max(0, radius)}
        className="h-full w-full"
      >
        <div className="h-full w-full" />
      </BorderBeam>
    </div>
  );
}
