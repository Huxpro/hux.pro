"use client";

import { useLabStrings } from "@/app/lab/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useOptionalWallpaper } from "@/systems/ambient";
import { SurfaceFrame } from "./frame";
import { SURFACE_STRINGS } from "./strings";

/** The ink ladder, top rung to bottom — the four the site sets text in. */
const RUNGS = [
  { name: "ink", className: "text-foreground" },
  { name: "muted", className: "text-muted-foreground" },
  { name: "tertiary", className: "text-tertiary-foreground" },
  { name: "quaternary", className: "text-quaternary-foreground" },
] as const;

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
  const S = useLabStrings(SURFACE_STRINGS);
  return (
    <SurfaceFrame className="flex flex-col justify-center gap-4 bg-transparent px-4 py-3">
      <div className="grid grid-cols-4 gap-2">
        {RUNGS.map((rung) => (
          <div key={rung.name} className="min-w-0 text-center">
            <div className={cn("font-serif text-2xl leading-tight", rung.className)}>Aa</div>
            <div className={cn(TYPE.labelSm, "truncate")}>{S.rungs[rung.name]}</div>
          </div>
        ))}
      </div>
      {legibility && (
        <p className={cn(TYPE.labelSm, "truncate text-center tabular-nums")}>
          {legibility.flip ? S.flip : legibility.flipMid ? S.flipMid : S.noFlip} · {S.busy}{" "}
          {legibility.busy.toFixed(2)} · {S.relief} {legibility.relief.toFixed(2)} · +{legibility.inkBoost}%
        </p>
      )}
    </SurfaceFrame>
  );
}
