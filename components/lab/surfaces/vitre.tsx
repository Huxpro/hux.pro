"use client";

import { useLabStrings } from "@/app/lab/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useOptionalWallpaper } from "@/systems/ambient";
import { SurfaceFrame } from "./frame";
import { SURFACE_STRINGS } from "./strings";

/**
 * The frame at the numbers vitre has, drawn at a third of a phone: the band
 * in the bezel colour round the page's ground, its inner corners at the
 * radius. The same numbers as the page's own bezel, scaled — the real one is
 * the edge of this screen.
 */
export function FrameDrawing({
  on,
  color,
  band,
  radius,
  ground,
  scale = 1 / 3,
  className,
}: {
  on: boolean;
  color: string;
  band: number;
  radius: number;
  ground: string;
  scale?: number;
  className?: string;
}) {
  const W = 390 * scale;
  const H = 844 * scale;
  // A band under a pixel still reads as a hairline, so it can be seen at all.
  const b = on ? Math.max(band * scale, 1) : 0;
  const r = on ? radius * scale : 0;
  return (
    <div
      aria-hidden
      className={cn("relative shrink-0 overflow-hidden rounded-[14px] border border-border/60 shadow-raised", className)}
      style={{ width: W, height: H, background: on ? color : ground }}
    >
      <div
        className="absolute overflow-hidden"
        style={{ inset: b, borderRadius: r, background: ground }}
      >
        {/* The page, sketched in shares of its width so it scales with it. */}
        <div className="flex h-full flex-col gap-[5%] p-[10%] opacity-60">
          <span className="h-1.5 w-1/3 rounded-full bg-foreground/30" />
          <span className="mt-[8%] h-3 w-2/3 rounded bg-foreground/20" />
          <span className="h-1.5 w-full shrink-0 rounded-full bg-foreground/10" />
          <span className="h-1.5 w-5/6 shrink-0 rounded-full bg-foreground/10" />
          <span className="h-1.5 w-4/6 shrink-0 rounded-full bg-foreground/10" />
        </div>
      </div>
    </div>
  );
}

/**
 * The Vitre Lab at a glance: the frame this site would put round a phone
 * right now — the saved tint, band and radius, on or off as the wallpaper
 * decides — and where the page scrolls.
 */
export function VitreSurface() {
  const S = useLabStrings(SURFACE_STRINGS);
  const w = useOptionalWallpaper();
  if (!w) return <SurfaceFrame>{null}</SurfaceFrame>;
  return (
    <SurfaceFrame className="flex items-center justify-center gap-5 px-4">
      <FrameDrawing
        on={w.bezel}
        color={w.bezelColor}
        band={w.bezelBand}
        radius={w.bezelRadius}
        ground="var(--background)"
        scale={0.14}
        className="rounded-[9px]"
      />
      <dl className={cn(TYPE.labelSm, "grid grid-cols-[auto_auto] gap-x-3 gap-y-1")}>
        <dt>{S.vitreBezel}</dt>
        <dd className="text-foreground">{w.bezel ? S.vitreOn : S.vitreOff}</dd>
        <dt>{S.vitreTint}</dt>
        <dd className="inline-flex items-center gap-1.5 text-foreground">
          <span className="size-2.5 rounded-sm border border-border/60" style={{ background: w.bezelColor }} />
          {w.bezelColor}
        </dd>
        <dt>{S.vitreBand}</dt>
        <dd className="text-foreground tabular-nums">{w.bezelBand}px · r{w.bezelRadius}</dd>
        <dt>{S.vitreScroll}</dt>
        <dd className="text-foreground">{w.bezelScroll}</dd>
      </dl>
    </SurfaceFrame>
  );
}
