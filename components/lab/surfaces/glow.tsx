"use client";

import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { Glow } from "@/systems/glow";
import { SurfaceFrame } from "./frame";

/**
 * The Glow Lab at a glance: the production <Glow>, twice — a ring flowing
 * round a card, a line resting under a field. Drawn by the one shared
 * renderer, so it costs nothing while scrolled off screen.
 */
export function GlowSurface() {
  return (
    <SurfaceFrame className="flex items-center justify-center gap-4 px-5">
      <div className="relative flex h-20 flex-1 items-center justify-center rounded-2xl border border-border/50 bg-glass">
        <span className="font-serif text-sm text-foreground">Hey.</span>
        <Glow active motion="flow" shape="ring" reach={4} />
      </div>
      <div className="relative flex h-9 flex-1 items-center overflow-hidden rounded-full border border-border/50 bg-glass-popover px-3">
        <span className={cn(TYPE.rowMeta, "truncate")}>listening…</span>
        <Glow active shape="line" />
      </div>
    </SurfaceFrame>
  );
}
