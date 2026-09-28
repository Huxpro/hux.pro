"use client";

import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useOptionalWallpaper } from "@/systems/ambient";
import { SurfaceFrame } from "./frame";

/** The ink ladder, top rung to bottom — the four the site sets text in. */
const RUNGS = [
  { name: "ink", className: "text-foreground" },
  { name: "muted", className: "text-muted-foreground" },
  { name: "3rd", className: "text-tertiary-foreground" },
  { name: "4th", className: "text-quaternary-foreground" },
];

/**
 * The Legibility Lab at a glance: the ink ladder over whatever is painting,
 * and what the policy resolved for it — the readout the devtool's Glass row
 * prints, the lab's first question asked of the wallpaper right now.
 *
 * The well is clear here, not the family's muted ground: the question is the
 * wallpaper's, so the wallpaper has to show through.
 */
export function LegibilitySurface() {
  const legibility = useOptionalWallpaper()?.legibility;
  return (
    <SurfaceFrame className="flex flex-col justify-center gap-4 bg-transparent px-4 py-3">
      <div className="grid grid-cols-4 gap-2">
        {RUNGS.map((rung) => (
          <div key={rung.name} className="min-w-0 text-center">
            <div className={cn("font-serif text-2xl leading-tight", rung.className)}>Aa</div>
            <div className={cn(TYPE.labelSm, "truncate")}>{rung.name}</div>
          </div>
        ))}
      </div>
      {legibility && (
        <p className={cn(TYPE.labelSm, "truncate text-center tabular-nums")}>
          {legibility.flip ? "flip" : legibility.flipMid ? "flip·mid" : "ink"} · busy{" "}
          {legibility.busy.toFixed(2)} · relief {legibility.relief.toFixed(2)} · +{legibility.inkBoost}%
        </p>
      )}
    </SurfaceFrame>
  );
}
