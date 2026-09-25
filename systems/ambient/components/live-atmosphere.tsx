"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { WeatherScene } from "../lib/scene";
import { sceneGradient, toAtmosphereScene } from "../lib/atmosphere/scene";

const AtmosphereWallpaper = dynamic(() => import("./atmosphere-wallpaper").then(m => m.AtmosphereWallpaper), { ssr: false });

/** Isolated alternative engine. Sky's renderer, interactions and fallback stay separate. */
export function LiveAtmosphere({ scene, active, edgeMask, tile = false }: {
  scene: WeatherScene;
  active: boolean;
  edgeMask?: string | null;
  tile?: boolean;
}) {
  const atmosphere = useMemo(() => toAtmosphereScene(scene), [scene]);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{
      backgroundImage: sceneGradient(atmosphere),
      maskImage: edgeMask ?? undefined,
      WebkitMaskImage: edgeMask ?? undefined,
    }}>
      {active && <AtmosphereWallpaper scene={atmosphere} pixelBudget={tile ? 90_000 : undefined} />}
      <div className="pointer-events-none absolute inset-0" style={{
        backgroundColor: `rgb(${scene.veil.color.map(c => Math.round(c * 255)).join(" ")})`,
        opacity: scene.veil.amount,
      }} />
    </div>
  );
}
