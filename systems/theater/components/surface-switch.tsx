"use client";

import { GLASS_ACTION, GLASS_PILL, GLASS_TRACK } from "@/components/ui/glass";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { SURFACE_ICON, SURFACE_LABEL_KEY, type TheaterSurface } from "../lib/surfaces";

// ---------------------------------------------------------------------------
// SurfaceSwitch — the exclusive player views: Theater · PiP · Audio.
//
// A labelled segmented control (AlbumTabs material): the lifted pill is the
// *current* view, the other segments are the only legal moves. Only rendered
// where there is room for labels — the Live Activity panel. Icon-only bars
// (theater toolbar, PiP window) show just the moves as plain cluster buttons,
// because a highlighted-but-inert icon next to real actions reads as a
// pressed button, not as state.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

interface SurfaceSwitchProps {
  current: TheaterSurface;
  /** Hide Theater on phone-sized viewports. */
  theaterAvailable?: boolean;
  className?: string;
  onSelect: (surface: TheaterSurface) => void;
}

export function SurfaceSwitch({
  current,
  theaterAvailable = true,
  className,
  onSelect,
}: SurfaceSwitchProps) {
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const pillId = useId();

  const surfaces: TheaterSurface[] = theaterAvailable
    ? ["theater", "pip", "mini"]
    : ["pip", "mini"];

  return (
    <div
      role="radiogroup"
      aria-label={t(locale, "theaterSurfaceGroup")}
      className={cn(
        "flex w-full items-center rounded-full p-0.5",
        GLASS_TRACK,
        className,
      )}
    >
      {surfaces.map((surface) => {
        const active = surface === current;
        const Icon = SURFACE_ICON[surface];
        const label = t(locale, SURFACE_LABEL_KEY[surface]);
        const named = (key: "theaterSurfaceNow" | "theaterSurfaceGo") =>
          t(locale, key).replace("{surface}", label);

        return (
          <button
            key={surface}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={active ? named("theaterSurfaceNow") : named("theaterSurfaceGo")}
            tabIndex={active ? -1 : 0}
            onClick={() => {
              if (!active) onSelect(surface);
            }}
            className={cn(
              "relative isolate h-8 flex-1",
              GLASS_ACTION,
              active ? "text-foreground" : "cursor-pointer",
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className={cn("absolute inset-0 -z-10 rounded-full", GLASS_PILL)}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "tween", duration: 0.28, ease: EASE }
                }
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
