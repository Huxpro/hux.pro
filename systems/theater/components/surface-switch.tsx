"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize2, Minimize2, PictureInPicture2, Volume2 } from "lucide-react";
import { useId } from "react";
import {
  GLASS_ACTION,
  GLASS_ON_DARK_BTN,
  GLASS_ON_DARK_PILL,
  GLASS_ON_DARK_TRACK,
  GLASS_PILL,
  GLASS_TRACK,
} from "../lib/chrome";

// ---------------------------------------------------------------------------
// SurfaceSwitch — the exclusive player views: Theater · PiP · Audio.
//
// Only one surface can be up at a time. The lifted pill is the *current*
// view (not an action). The other segments are the only legal moves.
// In theater / PiP the Audio move is a Minimize icon (the action) with a
// "keep listening" hint. In the Live Activity the same view shows Volume2
// + Audio / 声音 — that surface already *is* the audio activity.
// ---------------------------------------------------------------------------

export type TheaterSurface = "theater" | "pip" | "mini";

const EASE = [0.32, 0.72, 0, 1] as const;

const ICONS = {
  theater: Maximize2,
  pip: PictureInPicture2,
  /** Live Activity: this *is* the audio view, so Volume2. */
  mini: Volume2,
} as const;

const LABEL_KEY = {
  theater: "theaterSurfaceTheater",
  pip: "theaterSurfacePip",
  mini: "theaterSurfaceMini",
} as const;

interface SurfaceSwitchProps {
  current: TheaterSurface;
  /** Hide Theater on phone-sized viewports. */
  theaterAvailable?: boolean;
  tone?: "default" | "onDark";
  /** Text labels (Live Activity). Icon-only in the tight PiP / theater bars. */
  labels?: boolean;
  /**
   * When false, no outer track — parent already provides the capsule
   * (one window toolbar instead of nested glass).
   */
  framed?: boolean;
  className?: string;
  onSelect: (surface: TheaterSurface) => void;
}

export function SurfaceSwitch({
  current,
  theaterAvailable = true,
  tone = "default",
  labels = false,
  framed = true,
  className,
  onSelect,
}: SurfaceSwitchProps) {
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const pillId = useId();
  const onDark = tone === "onDark";

  const surfaces: TheaterSurface[] = theaterAvailable
    ? ["theater", "pip", "mini"]
    : ["pip", "mini"];

  return (
    <div
      role="radiogroup"
      aria-label={t(locale, "theaterSurfaceGroup")}
      className={cn(
        "inline-flex items-center",
        framed && "rounded-full p-0.5",
        framed && (onDark ? GLASS_ON_DARK_TRACK : GLASS_TRACK),
        labels && "w-full",
        className,
      )}
    >
      {surfaces.map((surface) => {
        const active = surface === current;
        const Icon =
          surface === "mini" && !labels ? Minimize2 : ICONS[surface];
        const label = t(locale, LABEL_KEY[surface]);
        const named = (key: "theaterSurfaceNow" | "theaterSurfaceGo") =>
          t(locale, key).replace("{surface}", label);
        const hint =
          surface === "mini" && !labels
            ? t(locale, "theaterSurfaceMiniHint")
            : undefined;

        return (
          <button
            key={surface}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={
              hint ?? (active ? named("theaterSurfaceNow") : named("theaterSurfaceGo"))
            }
            title={hint}
            tabIndex={active ? -1 : 0}
            onClick={() => {
              if (!active) onSelect(surface);
            }}
            className={cn(
              "relative isolate",
              labels
                ? cn(
                    GLASS_ACTION,
                    "h-7 flex-1",
                    active ? "text-foreground" : "cursor-pointer",
                  )
                : onDark
                  ? cn(
                      GLASS_ON_DARK_BTN,
                      "h-8 w-8",
                      active ? "text-white" : "cursor-pointer",
                    )
                  : cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full",
                      "transition-colors",
                      active
                        ? "text-foreground"
                        : "cursor-pointer text-muted-foreground hover:text-foreground",
                    ),
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className={cn(
                  "absolute inset-0 -z-10 rounded-full",
                  onDark ? GLASS_ON_DARK_PILL : GLASS_PILL,
                )}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "tween", duration: 0.28, ease: EASE }
                }
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {labels && <span>{label}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
