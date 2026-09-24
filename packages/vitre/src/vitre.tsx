"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react";
import type { VitreProps, VitreScroll, VitreState } from "../vitre";
import { readVitreBoot } from "./boot";
import { syncChrome } from "./chrome";
import {
  BAND_VAR,
  BEZEL_LAYER_ATTRIBUTE,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
  SCROLL_CONTAINER_ID,
} from "./constants";
import { ensureBezelStyle } from "./css";
import { keepRoot, type RootState } from "./root";
import { enableStatusTapToTop } from "./status-tap";

// =============================================================================
// <Vitre> — see ../vitre.d.ts for the contract.
//
// Four bands and four quarter-circles in the bezel colour, drawn above
// everything so the page stops on a clean line and is rounded off inside
// them — ryOS's DesktopCornerMask, with bands. The top and bottom bands are
// the band thickness; the sides are the safe area, which in landscape is the
// notch. The top and bottom bands overshoot the viewport by half a screen, so
// a viewport that resizes (a desktop window, a toolbar in window scroll) never
// uncovers a strip.
// =============================================================================

const OVERSHOOT = "50vh";
const OUTSIDE = `calc(-1 * ${OVERSHOOT})`;
const BAND = `var(${BAND_VAR}, ${DEFAULT_BEZEL_BAND}px)`;
const SIDE_LEFT = "env(safe-area-inset-left, 0px)";
const SIDE_RIGHT = "env(safe-area-inset-right, 0px)";

export const BEZEL_INSET: CSSProperties = {
  top: BAND,
  bottom: BAND,
  left: SIDE_LEFT,
  right: SIDE_RIGHT,
};

const CORNERS = [
  { top: 0, left: 0, at: "100% 100%" },
  { top: 0, right: 0, at: "0 100%" },
  { bottom: 0, left: 0, at: "100% 0" },
  { bottom: 0, right: 0, at: "0 0" },
] as const;

const layer: CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 };
const fill = (style: CSSProperties): CSSProperties => ({
  position: "absolute",
  background: "var(--bezel-color)",
  ...style,
});

const DISABLED: VitreState = {
  enabled: false,
  color: "#000",
  band: DEFAULT_BEZEL_BAND,
  radius: DEFAULT_BEZEL_RADIUS,
  scroll: "window",
  ground: "#fff",
};

const VitreContext = createContext<VitreState>(DISABLED);

export function useVitre(): VitreState {
  return useContext(VitreContext);
}

export function Vitre({
  enabled,
  color,
  band = DEFAULT_BEZEL_BAND,
  radius = DEFAULT_BEZEL_RADIUS,
  scroll = "window",
  ground,
  chromeMorph = true,
  backdrop,
  className,
  style,
  children,
}: VitreProps): JSX.Element {
  // The boot record is read after mount: the server cannot see it, and the
  // first client render must match the server's.
  const [boot, setBoot] = useState<ReturnType<typeof readVitreBoot>>(null);
  useLayoutEffect(() => {
    ensureBezelStyle();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: reads the boot record
    setBoot(readVitreBoot());
  }, []);

  // `null` holds whatever the boot script applied.
  const target: RootState | null =
    enabled === null
      ? boot && { enabled: boot.enabled, color: boot.color, band: boot.band, scroll: boot.scroll }
      : { enabled, color, band, scroll };
  const chrome = enabled === null ? null : enabled ? color : ground;

  // <html>: applied on every change and kept against anything that strips it.
  const { enabled: on, color: c, band: b, scroll: s } = target ?? {};
  useLayoutEffect(() => {
    if (on === undefined || c === undefined || b === undefined || s === undefined) return;
    return keepRoot(document.documentElement, {
      enabled: on,
      color: c,
      band: b,
      scroll: s as VitreScroll,
    });
  }, [on, c, b, s]);

  // A tap on the status bar: the container cannot be given the gesture (WebKit
  // turns scrollsToTop off on overflow scrollers), so the window is parked a
  // few pixels down while the page is scrolled and a scroll back to 0 is read
  // as the tap. Off iOS, and while anything else holds <html>, it is a no-op.
  // After paint, not before: it reads the container, which layout effects are
  // still writing.
  useEffect(() => {
    if (s !== "container") return;
    return enableStatusTapToTop();
  }, [s]);

  // The chrome: shown the new colour whenever the colour it should show
  // changes. Not on the first resolution when it matches what the page loaded
  // with — Safari already has that one.
  // The morph starts and ends at the bezel on screen: its band and corners
  // while it is on, nothing while it is off. Read through a ref so a band
  // change alone does not trigger a sync.
  const shape = useRef({ band: 0, radius: 0 });
  useLayoutEffect(() => {
    shape.current = enabled ? { band, radius } : { band: 0, radius: 0 };
  }, [enabled, band, radius]);
  const synced = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (chrome === null) return;
    if (synced.current === null) {
      const loaded = boot ? (boot.enabled ? boot.color : boot.ground) : null;
      synced.current = loaded;
    }
    if (synced.current !== chrome) {
      syncChrome(chrome, { ...shape.current, morph: chromeMorph });
      synced.current = chrome;
    }
  }, [chrome, boot, chromeMorph]);

  const state = useMemo<VitreState>(
    () => ({
      enabled: target?.enabled ?? false,
      color: target?.color ?? color,
      band: target?.band ?? band,
      radius,
      scroll: target?.scroll ?? scroll,
      ground,
    }),
    [target?.enabled, target?.color, target?.band, target?.scroll, color, band, radius, scroll, ground]
  );

  const r = Math.max(0, radius);

  return (
    <VitreContext.Provider value={state}>
      {state.enabled && (
        <div aria-hidden="true" {...{ [BEZEL_LAYER_ATTRIBUTE]: "" }} style={layer}>
          <div style={fill({ left: 0, right: 0, top: OUTSIDE, height: `calc(${OVERSHOOT} + ${BAND})` })} />
          <div style={fill({ left: 0, right: 0, bottom: OUTSIDE, height: `calc(${OVERSHOOT} + ${BAND})` })} />
          <div style={fill({ left: 0, top: OUTSIDE, bottom: OUTSIDE, width: SIDE_LEFT })} />
          <div style={fill({ right: 0, top: OUTSIDE, bottom: OUTSIDE, width: SIDE_RIGHT })} />
          {r > 0 && (
            <div style={{ position: "absolute", ...BEZEL_INSET }}>
              {CORNERS.map(({ at, ...pos }) => (
                <span
                  key={at}
                  style={{
                    position: "absolute",
                    display: "block",
                    width: r,
                    height: r,
                    ...pos,
                    background: `radial-gradient(circle at ${at}, transparent 0 ${r - 0.5}px, var(--bezel-color) ${r}px)`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {backdrop}
      <div id={SCROLL_CONTAINER_ID} className={className} style={{ ...BEZEL_INSET, ...style }}>
        {children}
      </div>
    </VitreContext.Provider>
  );
}
