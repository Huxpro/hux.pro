"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useWeather } from "../provider";
import { GradientStack } from "./gradient-stack";

/**
 * Duration of the enable/disable fade. Must match the `duration-700` utility
 * below — it is how long the layer has to stay mounted on the way out.
 */
const FADE_MS = 700;

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { gradientLayers, edgeFadeMask } = useWeather();

  // iOS 26 Safari samples fixed elements to tint its Liquid Glass status bar
  // and bottom toolbar — and it does so even when the element is fully
  // transparent. A parked `fixed inset-0` layer sitting at `opacity: 0` with
  // `pointer-events: none` still pulled colour into the Safari chrome, so once
  // the fade-out has finished the layer is taken out of the box tree entirely
  // (display: none, by way of unmounting) rather than merely made invisible.
  // `present` = in the box tree at all. `visible` = faded in. They are separate
  // so the layer can mount transparent and transition in, and can transition
  // out before it leaves.
  const [present, setPresent] = useState(enabled);
  const [visible, setVisible] = useState(enabled);

  useEffect(() => {
    if (enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPresent(true);
      // Two frames: the layer has to be painted at opacity 0 once before the
      // transition to opacity 0.7 has anything to animate from.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }

    setVisible(false);
    const timeout = setTimeout(() => setPresent(false), FADE_MS);
    return () => clearTimeout(timeout);
  }, [enabled]);

  if (gradientLayers.length === 0 || !present) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out",
        visible ? "opacity-70 dark:opacity-85" : "opacity-0"
      )}
    >
      {/* Full-page background is already viewport-fixed, so the edge mask is
          applied statically (no per-frame tracking needed). */}
      <GradientStack layers={gradientLayers} edgeMask={edgeFadeMask} />
    </div>
  );
}
