"use client";

import { useMemo, useRef, useState } from "react";
import type { PokeKind } from "@/systems/ambient/lib/poke";
import Link from "next/link";
import { EditorNav } from "@/app/editor/nav";
import { useRouter } from "next/navigation";
import { useWallpaper } from "@/systems/ambient/provider";
import { AtmosphereWallpaper } from "@/systems/ambient/components/atmosphere-wallpaper";
import { toAtmosphereScene } from "@/systems/ambient/lib/atmosphere/scene";
import { deriveWeatherScene, type SceneWeatherInput } from "@/systems/ambient/lib/scene";
import { WEATHER_CONDITIONS, type WeatherCondition } from "@/systems/ambient/lib/weather";
import { useTheme } from "@/services";

const epoch = Date.UTC(2026, 8, 12);
const codes: Record<WeatherCondition,number> = { clear: 0, cloudy: 2, fog: 45, rain: 63, snow: 73, thunder: 95 };

export function WeatherStudio() {
  const router = useRouter();
  const { selectWeather, setPlacement } = useWallpaper();
  const [lightningKey, setLightningKey] = useState(0);
  const [condition,setCondition] = useState<WeatherCondition>("cloudy");
  const [hour,setHour] = useState(16);
  const [strength,setStrength] = useState(55);
  const [wind,setWind] = useState(16);
  const [paused,setPaused] = useState(false);
  const [reading,setReading] = useState(false);
  const { theme } = useTheme();
  // The shared scene, as the page derives it — the same palette, bodies and
  // theme key — so the studio previews exactly what the wallpaper paints.
  const weather = useMemo<SceneWeatherInput>(() => ({
    condition, weatherCode: codes[condition], temperatureC: condition === "snow" ? -2 : 20,
    cloudCover: (condition === "clear" ? strength*0.15 : condition === "cloudy" ? strength : 70+strength*0.3) / 100,
    precipitationIntensity: condition === "rain" || condition === "thunder" || condition === "snow" ? strength/100 : 0,
    visibilityM: condition === "fog" ? 1000 - strength*8 : 20000,
    windSpeedKmh: wind, windDirectionDeg: 250,
  }), [condition,strength,wind]);
  const scene = useMemo(() => toAtmosphereScene(deriveWeatherScene({
    weather, nowMs: epoch + hour*3600000, lat: 35, lon: 0, theme, seed: 7,
  })), [weather,hour,theme]);
  // The eggs, previewed: a tap on the sky strikes on a thunder day and sends a
  // meteor on a clear night — the engine's own answers, as the home gives them.
  const pokeRef = useRef<((kind: PokeKind, x: number, y: number) => void) | null>(null);
  const poke: PokeKind | null = paused ? null : condition === "thunder" ? "strike"
    : scene.daylight < 0.05 && scene.cloud < 0.6 && scene.fog < 0.3 ? "meteor" : null;
  const time = `${String(Math.floor(hour)).padStart(2,"0")}:${String(Math.round((hour%1)*60)).padStart(2,"0")}`;
  return (
    <main className="relative isolate min-h-svh bg-slate-950 text-white">
      <div className="fixed inset-0"><AtmosphereWallpaper scene={scene} paused={paused} lightningKey={lightningKey} pokeRef={pokeRef} /></div>
      {reading && <div className="fixed inset-0 bg-background/60" />}
      <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col px-6 py-8 sm:px-12 sm:py-12">
        <header className="flex items-center justify-between gap-4 text-xs tracking-wide text-white/85 [text-shadow:0_1px_8px_#102030]">
          <EditorNav appearance="page" className="text-white" />
          <Link href="/" className="rounded focus-visible:outline-2 focus-visible:outline-offset-4">← hux.pro</Link>
        </header>
        <div
          onClick={(e) => { if (poke) pokeRef.current?.(poke, e.clientX / innerWidth, 1 - e.clientY / innerHeight); }}
          className={`flex flex-1 flex-col justify-center py-16 ${poke ? "cursor-crosshair" : ""} ${reading ? "text-foreground" : "[text-shadow:0_2px_24px_#10203060]"}`}
        >
          <p className="mb-3 text-sm opacity-80">September 12 · 35° N</p>
          <h1 className="font-sans text-[clamp(5rem,14vw,10rem)] leading-none font-light tracking-[-0.065em] tabular-nums">{time}</h1>
          <p className="mt-5 font-serif text-2xl sm:text-3xl">{WEATHER_CONDITIONS[condition].label}</p>
          {reading && <p className="mt-6 max-w-sm text-base leading-7">A quiet surface for writing, work, and everything in between. The sky changes with the day.</p>}
        </div>
        <section aria-label="Weather preview controls" className="grid gap-5 rounded-2xl border border-white/20 bg-slate-950/65 p-5 shadow-xl backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2 text-xs">Weather
            <select aria-label="Weather" value={condition} onChange={e=>setCondition(e.target.value as WeatherCondition)} className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-2.5 text-sm">
              {Object.entries(WEATHER_CONDITIONS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>
          <label className="text-xs">Time <span className="float-right tabular-nums">{time}</span>
            <input aria-label="Time" type="range" min="0" max="23.9" step="0.1" value={hour} onChange={e=>setHour(Number(e.target.value))} className="mt-5 w-full accent-white" />
          </label>
          <label className="text-xs">Intensity <span className="float-right tabular-nums">{strength}%</span>
            <input aria-label="Intensity" type="range" min="0" max="100" value={strength} onChange={e=>setStrength(Number(e.target.value))} className="mt-5 w-full accent-white" />
          </label>
          <label className="text-xs">Wind <span className="float-right tabular-nums">{wind} km/h</span>
            <input aria-label="Wind" type="range" min="0" max="80" value={wind} onChange={e=>setWind(Number(e.target.value))} className="mt-5 w-full accent-white" />
          </label>
          <div className="flex flex-wrap items-center gap-5 text-xs sm:col-span-2 lg:col-span-4">
            <button onClick={()=>setPaused(v=>!v)} aria-pressed={paused} className="rounded-md border border-white/25 px-3 py-2 hover:bg-white/10">{paused ? "Resume motion" : "Pause motion"}</button>
            {condition === "thunder" && <button onClick={() => { setPaused(false); setLightningKey(k => k + 1); }} className="rounded-md border border-white/25 px-3 py-2 hover:bg-white/10">Preview lightning</button>}
            <button onClick={() => { selectWeather("atmosphere"); setPlacement("full"); router.push("/"); }} className="rounded-md border border-white/40 bg-white/15 px-3 py-2 hover:bg-white/25">Use live wallpaper →</button>
            <label className="flex items-center gap-2"><input type="checkbox" checked={reading} onChange={e=>setReading(e.target.checked)} /> Reading surface</label>
            <span className="text-white/60">{poke === "strike" ? "Tap the sky to call a bolt down" : poke === "meteor" ? "Tap the sky for a meteor" : "Preview conditions"}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
