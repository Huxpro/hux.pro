"use client";

import { CAPSULE, GAP, OUTSET_X, PRESETS, bandGeometry, strip, useBandSelect, type BandState } from "@/systems/dock";
import { SurfaceFrame } from "./frame";

const W = 390;
const NATURALS = [96, 76, 36];
const BAR = { left: 24, right: 366, outset: OUTSET_X, natural: 300, min: 150 };

/**
 * The Band Lab at a glance: a phone's top edge as the band is composed right
 * now (the lab's configuration, or the tray when the site is stacking) — laid
 * out by the band's own geometry (systems/dock/band.ts), for a pinned bar and
 * three occupants. It takes no taps; the card does.
 */
export function BandSurface() {
  const config = useBandSelect((_, band) => band.config);
  const band: BandState = {
    config: config.share ? config : PRESETS.tray,
    vw: W,
    met: true,
    open: false,
    samples: 0,
    naturals: NATURALS,
    clear: 0,
    bar: BAR,
  };
  const g = bandGeometry(band);
  const barRight = BAR.right - g.reserve + BAR.outset;
  const win = g.window;
  const widths = NATURALS.map((w) => (g.form === "ball" ? CAPSULE : w));
  const start = win ? win.left + win.padStart : 0;
  const pills = widths.map((w, i) => ({ left: start + strip(widths.slice(0, i)) + (i > 0 ? GAP : 0), w }));
  const scale = 0.72;
  return (
    <SurfaceFrame className="pointer-events-none flex items-center justify-center">
      <div style={{ width: W * scale, height: 64 * scale }} className="relative overflow-hidden rounded-lg bg-background/60">
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: W, height: 64, transform: `scale(${scale})` }}>
          <div
            className="absolute top-[14px] h-9 rounded-full border border-border/60 bg-glass-popover"
            style={{ left: BAR.left - BAR.outset, width: barRight - (BAR.left - BAR.outset) }}
          />
          {g.mode === "count" && win ? (
            <div
              className="absolute top-[14px] flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-glass-popover font-mono text-sm font-semibold"
              style={{ left: win.left }}
            >
              {NATURALS.length}
            </div>
          ) : (
            win && (
              <div className="absolute top-[14px] h-9 overflow-hidden" style={{ left: win.left, width: win.width }}>
                {pills.map((p, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-9 rounded-full border border-border/60 bg-glass-popover"
                    style={{ left: p.left - win.left, width: p.w }}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </SurfaceFrame>
  );
}
