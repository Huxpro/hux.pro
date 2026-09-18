"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize2, Minimize2, PictureInPicture2, Volume2 } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  GLASS_ACTION,
  GLASS_HIT,
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
//
// The highlight is one absolutely-positioned ball. It animates x/width when
// `current` changes. It does NOT use layoutId — a shared-element projection
// would also tween when the parent PiP window is dragged, so the ball trails
// the finger. A transform on a child stays glued to the track.
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
  /**
   * Hide Audio. A slide deck has no sound to keep listening to, so the move
   * that parks the stage and keeps the audio is not a move it can make.
   */
  audioAvailable?: boolean;
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
  audioAvailable = true,
  tone = "default",
  labels = false,
  framed = true,
  className,
  onSelect,
}: SurfaceSwitchProps) {
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const onDark = tone === "onDark";
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, y: 0, width: 0, height: 0, ready: false });

  const surfaces: TheaterSurface[] = (
    ["theater", "pip", "mini"] as TheaterSurface[]
  ).filter(
    (surface) =>
      (surface !== "theater" || theaterAvailable) &&
      (surface !== "mini" || audioAvailable),
  );

  const measure = useCallback(() => {
    const root = trackRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!active) return;
    setPill({
      x: active.offsetLeft,
      y: active.offsetTop,
      width: active.offsetWidth,
      height: active.offsetHeight,
      ready: true,
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const root = trackRef.current;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [current, labels, locale, theaterAvailable, audioAvailable, measure]);

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={t(locale, "theaterSurfaceGroup")}
      className={cn(
        "system-chrome relative inline-flex items-center",
        framed && "rounded-full p-0.5",
        framed && (onDark ? GLASS_ON_DARK_TRACK : GLASS_TRACK),
        labels && "w-full",
        className,
      )}
    >
      {pill.ready && (
        <motion.span
          aria-hidden
          data-surface-pill
          className={cn(
            "pointer-events-none absolute left-0 top-0 rounded-full",
            onDark ? GLASS_ON_DARK_PILL : GLASS_PILL,
          )}
          initial={false}
          animate={{
            x: pill.x,
            y: pill.y,
            width: pill.width,
            height: pill.height,
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "tween", duration: 0.28, ease: EASE }
          }
        />
      )}
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
              "relative z-10 isolate",
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
                      // Same press contract as GLASS_BTN, minus its hover
                      // fill (the lifted pill is the fill here).
                      "pressable outline-none transition-colors duration-200",
                      GLASS_HIT,
                      "focus-visible:bg-foreground/[0.08] focus-visible:text-foreground",
                      active
                        ? "text-foreground"
                        : cn(
                            "cursor-pointer text-muted-foreground hover:text-foreground",
                            "active:bg-foreground/[0.08] active:text-foreground",
                          ),
                    ),
            )}
          >
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
