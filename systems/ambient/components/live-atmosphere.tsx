"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { WeatherScene } from "../lib/scene";
import type { PokeKind } from "../lib/poke";
import type { WipeHandle } from "../lib/wipe";
import type { WallpaperStats } from "../lib/wallpaper/renderer";
import { sceneGradient, toAtmosphereScene } from "../lib/atmosphere/scene";

const AtmosphereWallpaper = dynamic(() => import("./atmosphere-wallpaper").then(m => m.AtmosphereWallpaper), { ssr: false });

/** The Sky's own theme pace, ms to settled (THEME in wallpaper/renderer.ts, three taus). */
const THEME_EASE_MS = 1500;

/**
 * The Atmosphere engine on the live scene: its gradient underneath (what shows
 * before the first frame, and where WebGL is missing or lost), the engine, and
 * the theme veil over both — which the Sky mixes inside its shader, and which
 * moves here at the same pace, the sun's slower one while the theme hands over.
 */
export function LiveAtmosphere({ scene, active, edgeMask, tile = false, themeEaseMs = null, gyro = false, interactive = false, statsRef, pokeRef, wipeRef }: {
  scene: WeatherScene;
  active: boolean;
  edgeMask?: string | null;
  tile?: boolean;
  themeEaseMs?: number | null;
  gyro?: boolean;
  interactive?: boolean;
  statsRef?: React.MutableRefObject<(() => WallpaperStats) | null>;
  pokeRef?: React.MutableRefObject<((kind: PokeKind, x: number, y: number) => void) | null>;
  wipeRef?: React.MutableRefObject<WipeHandle | null>;
}) {
  const atmosphere = useMemo(() => toAtmosphereScene(scene), [scene]);
  const ease = themeEaseMs ?? THEME_EASE_MS;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{
      backgroundImage: sceneGradient(atmosphere),
      ...(edgeMask ? {
        maskImage: edgeMask, WebkitMaskImage: edgeMask,
        maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
        maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
      } : null),
    }}>
      <AtmosphereWallpaper
        scene={atmosphere}
        active={active}
        // A preview costs a fraction of the page: the Sky's tile budget and rate.
        pixelBudget={tile ? 90_000 : undefined}
        maxFps={tile ? 30 : undefined}
        gyro={gyro}
        interactive={interactive}
        statsRef={statsRef}
        pokeRef={pokeRef}
        wipeRef={wipeRef}
      />
      <div className="pointer-events-none absolute inset-0 motion-reduce:transition-none" style={{
        backgroundColor: `rgb(${scene.veil.color.map(c => Math.round(c * 255)).join(" ")})`,
        opacity: scene.veil.amount,
        transition: `opacity ${ease}ms ease-out, background-color ${ease}ms ease-out`,
      }} />
    </div>
  );
}
