import { SurfaceFrame } from "./frame";

/** Six screens by shape, wide to tall: the window across on the widest two, upright on the rest (code's crossover, before anyone decides). */
const SCREENS: [number, number, boolean][] = [
  [2560, 1080, true],
  [844, 390, true],
  [1440, 900, false],
  [800, 800, false],
  [820, 1180, false],
  [390, 844, false],
];

/**
 * The Intent Lab at a glance: the same dream on six screens, each with its
 * window's way, as decided before anyone has. It takes no taps; the card does.
 */
export function IntentSurface() {
  const k = 44 / 1180;
  return (
    <SurfaceFrame className="pointer-events-none flex items-end justify-center gap-2 p-3">
      {SCREENS.map(([w, h, across], i) => {
        const [sw, sh] = [Math.max(14, w * k), Math.max(14, h * k)];
        return (
          <div
            key={i}
            className="relative flex items-center justify-center rounded-[4px] border border-border/70 bg-background/70"
            style={{ width: sw, height: sh }}
          >
            <div
              className="rounded-[2px] border border-foreground/30"
              style={across ? { width: sw * 0.6, height: sh * 0.4 } : { width: sw * 0.4, height: sh * 0.6 }}
            />
          </div>
        );
      })}
    </SurfaceFrame>
  );
}
