"use client";

/**
 * Sky Engine Lab — a workbench for the sun, moon and weather model.
 *
 * Layout: the three engines and the clock on the left, above the plots and the
 * readouts; the config panels on the right. One instant (`nowMs`) feeds all of
 * it, exactly as one instant feeds the site — which is the invariant the
 * "one clock" panel states and then checks.
 *
 * The lab drives `deriveWeatherScene` directly rather than going through the
 * ambient provider: a month sweep would otherwise have to push 30 days through
 * the provider's minute tick, and the site's own clock would follow the lab
 * around. Nothing here is a second copy of the model — every number comes from
 * `systems/ambient/lib`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  Pause,
  Play,
  RotateCcw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/services";
import { useLocation, useWeather } from "@/systems/ambient";
import { WeatherWallpaper } from "@/systems/ambient/components/wallpaper";
import { deriveAmbientPhase } from "@/systems/ambient/lib/phase";
import {
  getClassicGradient,
  sceneToCssGradient,
} from "@/systems/ambient/lib/gradient";
import {
  deriveWeatherScene,
  mixRGB,
  sampleDay,
  toSceneWeather,
  type SceneOverrides,
  type WeatherScene,
} from "@/systems/ambient/lib/scene";
import {
  activeSkyConfig,
  DEFAULT_SKY_CONFIG,
  normalizeSkyFile,
  skyPresetId,
  type SkyConfig,
  type SkyFile,
} from "@/systems/ambient/lib/sky-config";
import {
  explainMoon,
  explainSun,
  getMoonPhaseName,
  smoothstep,
  startOfLocalDay,
} from "@/systems/ambient/lib/solar";
import type { WeatherCondition } from "@/systems/ambient/lib/weather";
import { Chip, Note, Panel, Readout, Segmented } from "../controls";
import {
  MoonPanel,
  ObserverPanel,
  PresetPanel,
  setIn,
  StagingPanel,
  StarsPanel,
  SunPanel,
  WeatherPanel,
  type PanelContext,
} from "./controls";
import {
  analemma,
  buildPermalink,
  clock,
  DAY_MS,
  date,
  dayEvents,
  dayTrack,
  minutesOfDay,
  moonMonth,
  readPermalink,
  referenceChecks,
  SCALES,
  SPEEDS,
  stamp,
  sweepInstant,
  sweepOrigin,
  sweepPosition,
  type LabLink,
  type Observer,
  type Scenario,
  type SweepScale,
} from "./model";
import { SkyDomePlot, ScreenPlot } from "./plots/dome";
import { DayTimeline, Sparklines, type Series } from "./plots/timeline";
import { AnalemmaPlot, MoonMonthPlot, PhaseDial } from "./plots/year";
import { MOON_COLOR, STAGE_COLOR, SUN_COLOR } from "./plots/primitives";

/** Scenes per day in the lab: one every ten minutes. */
const DAY_SAMPLES = 144;

export function SkyEditorView({ initialFile }: { initialFile: SkyFile }) {
  // The lab is a clock, and a clock cannot be server-rendered without a
  // hydration mismatch. Boot on the client, from the permalink if there is one.
  const [start, setStart] = useState<{ ms: number; link: LabLink } | null>(null);
  useEffect(() => {
    const link = readPermalink(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStart({ ms: link.t ?? Date.now(), link });
  }, []);

  if (!start) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <span className="font-mono text-xs text-muted-foreground">
          sky engine lab…
        </span>
      </div>
    );
  }
  return <SkyLab initialFile={initialFile} startMs={start.ms} link={start.link} />;
}

function SkyLab({
  initialFile,
  startMs,
  link,
}: {
  initialFile: SkyFile;
  startMs: number;
  link: LabLink;
}) {
  const { theme: siteTheme } = useTheme();
  const { location } = useLocation();
  const { weather } = useWeather();

  // --- The config ---------------------------------------------------------
  const [savedFile, setSavedFile] = useState<SkyFile>(initialFile);
  const [presetId, setPresetId] = useState(
    () =>
      (link.preset && initialFile.presets.some((p) => p.id === link.preset)
        ? link.preset
        : initialFile.active) || "default"
  );
  const [activeId, setActiveId] = useState(initialFile.active);
  const [presets, setPresets] = useState(initialFile.presets);
  const [config, setConfig] = useState<SkyConfig>(() =>
    activeSkyConfig(initialFile, link.preset ?? initialFile.active)
  );
  const [saving, setSaving] = useState(false);

  /** The file as it would be written right now. */
  const composed = useMemo<SkyFile>(
    () => ({
      version: savedFile.version,
      active: activeId,
      presets: presets.map((p) => (p.id === presetId ? { ...p, config } : p)),
    }),
    [savedFile.version, activeId, presets, presetId, config]
  );
  const isDirty = useMemo(
    () => JSON.stringify(composed) !== JSON.stringify(savedFile),
    [composed, savedFile]
  );
  /** What a lever's `*` goes back to: the committed value for this preset. */
  const defaults = useMemo(
    () => activeSkyConfig(savedFile, presetId),
    [savedFile, presetId]
  );

  const update = useCallback(
    (path: (string | number)[], value: unknown) =>
      setConfig((prev) => setIn(prev, path, value)),
    []
  );
  const ctx: PanelContext = useMemo(
    () => ({ config, defaults, update }),
    [config, defaults, update]
  );

  // --- The observer -------------------------------------------------------
  const resolved: Observer | null = location
    ? { label: location.city || "Resolved", lat: location.lat, lon: location.lon }
    : null;
  const [observer, setObserver] = useState<Observer>(() =>
    link.lat !== undefined && link.lon !== undefined
      ? { label: "Permalink", lat: link.lat, lon: link.lon }
      : { label: "London", lat: 51.5074, lon: -0.1278 }
  );
  // Adopt the visitor's own location once, when it arrives and the lab was not
  // opened on a permalink that already named one.
  const adopted = useRef(link.lat !== undefined);
  useEffect(() => {
    if (adopted.current || !location) return;
    adopted.current = true;
    setObserver({
      label: location.city || "Resolved",
      lat: location.lat,
      lon: location.lon,
    });
  }, [location]);
  const { lat, lon } = observer;
  const hemisphere: 1 | -1 = lat < 0 ? -1 : 1;

  // --- The clock ----------------------------------------------------------
  const [scale, setScale] = useState<SweepScale>(link.scale ?? "day");
  const [originMs, setOriginMs] = useState(() =>
    sweepOrigin(link.scale ?? "day", startMs)
  );
  const [t, setT] = useState(() =>
    sweepPosition(link.scale ?? "day", sweepOrigin(link.scale ?? "day", startMs), startMs)
  );
  /**
   * The sweep position, mirrored for the play loop.
   *
   * The rAF loop needs the live position without re-subscribing every frame,
   * and a scrub has to land in both — so every write goes through one setter
   * and the ref is never touched during render.
   */
  const tRef = useRef(t);
  const setPosition = useCallback((next: number) => {
    tRef.current = next;
    setT(next);
  }, []);
  /** The time of day the month and year sweeps hold. */
  const [clockMinutes, setClockMinutes] = useState(() => minutesOfDay(startMs));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [realNowMs, setRealNowMs] = useState(startMs);
  useEffect(() => {
    const id = window.setInterval(() => setRealNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const spec = SCALES[scale];
  const nowMs = sweepInstant(scale, originMs, t, clockMinutes);
  const dayStartMs = startOfLocalDay(nowMs);

  /** Move the clock to an instant, keeping the window that contains it. */
  const jumpTo = useCallback(
    (ms: number, nextScale: SweepScale = scale) => {
      setPlaying(false);
      const origin = sweepOrigin(nextScale, ms);
      setScale(nextScale);
      setOriginMs(origin);
      setPosition(sweepPosition(nextScale, origin, ms));
      if (nextScale !== "day") setClockMinutes(minutesOfDay(ms));
    },
    [scale, setPosition]
  );

  const changeScale = useCallback(
    (next: SweepScale) => {
      setPlaying(false);
      const ms = nowMs;
      const origin = sweepOrigin(next, ms);
      setScale(next);
      setOriginMs(origin);
      setPosition(sweepPosition(next, origin, ms));
      if (next !== "day") setClockMinutes(minutesOfDay(ms));
    },
    [nowMs, setPosition]
  );

  // The sweep. One rAF loop advancing `t` in the scale's own unit, so a day
  // runs at an hour a second and a year at a week a second.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(250, now - last) / 1000;
      last = now;
      let next = tRef.current + dt * spec.rate * speed;
      if (next >= spec.span) {
        if (loop) next -= spec.span;
        else {
          next = spec.span;
          setPlaying(false);
        }
      }
      setPosition(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, spec.rate, spec.span, speed, loop, setPosition]);

  // --- The weather --------------------------------------------------------
  const [forced, setForced] = useState<WeatherCondition | null>(null);
  const [overrides, setOverrides] = useState<SceneOverrides>({});
  const [sceneTheme, setSceneTheme] = useState<"light" | "dark">(siteTheme);
  const [portrait, setPortrait] = useState(false);
  const [seed] = useState(() => Math.floor(Math.random() * 1000) / 10);
  const [fallback, setFallback] = useState<string | null>(null);

  const events = useMemo(() => dayEvents(dayStartMs, lat, lon), [dayStartMs, lat, lon]);

  const sceneWeather = useMemo(
    () =>
      toSceneWeather(weather, forced ? { condition: forced } : null, {
        sunriseMs: events.sun.rise ?? undefined,
        sunsetMs: events.sun.set ?? undefined,
      }),
    [weather, forced, events]
  );

  // --- The scene ----------------------------------------------------------
  const scene: WeatherScene = useMemo(
    () =>
      deriveWeatherScene({
        nowMs,
        lat,
        lon,
        weather: sceneWeather,
        theme: sceneTheme,
        overrides,
        seed,
        config,
      }),
    [nowMs, lat, lon, sceneWeather, sceneTheme, overrides, seed, config]
  );

  const phase = useMemo(
    () =>
      deriveAmbientPhase({
        nowMs,
        sunriseMs: events.sun.rise ?? undefined,
        sunsetMs: events.sun.set ?? undefined,
      }),
    [nowMs, events]
  );

  // --- The day, sampled ---------------------------------------------------
  const daySamples = useMemo(
    () =>
      sampleDay({
        dayMs: dayStartMs,
        lat,
        lon,
        weather: sceneWeather,
        theme: sceneTheme,
        overrides,
        config,
        samples: DAY_SAMPLES,
      }),
    [dayStartMs, lat, lon, sceneWeather, sceneTheme, overrides, config]
  );
  const dayColors = useMemo(
    () => daySamples.map((s) => mixRGB(s.sky.zenith, s.sky.horizon, 0.45)),
    [daySamples]
  );

  const sunTrack = useMemo(() => dayTrack("sun", dayStartMs, lat, lon), [dayStartMs, lat, lon]);
  const moonTrack = useMemo(() => dayTrack("moon", dayStartMs, lat, lon), [dayStartMs, lat, lon]);

  /** The same day after composition — straight off the sampled scenes. */
  const stagedTrack = useMemo(
    () =>
      daySamples.map((s, i) => ({
        ms: dayStartMs + ((i + 0.5) / daySamples.length) * DAY_MS,
        sun: s.sun.screen,
        moon: s.moon.screen,
        moonVisible: s.moon.visible,
      })),
    [daySamples, dayStartMs]
  );

  // --- Long sweeps --------------------------------------------------------
  // Anchored to the calendar year and month containing the day in view, so the
  // plots hold still while a day sweeps and only redraw when the date does.
  const yearOriginMs = useMemo(() => {
    const d = new Date(dayStartMs);
    return startOfLocalDay(new Date(d.getFullYear(), 0, 1).getTime());
  }, [dayStartMs]);
  const monthWindow = useMemo(() => {
    const d = new Date(dayStartMs);
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { first: startOfLocalDay(first), days };
  }, [dayStartMs]);

  const analemmaPoints = useMemo(
    () => analemma(yearOriginMs, clockMinutes, lat, lon),
    [yearOriginMs, clockMinutes, lat, lon]
  );
  const monthDays = useMemo(
    () => moonMonth(monthWindow.first, clockMinutes, lat, lon, monthWindow.days),
    [monthWindow, clockMinutes, lat, lon]
  );

  // --- Readouts -----------------------------------------------------------
  const sunSteps = useMemo(() => explainSun(nowMs, lat, lon), [nowMs, lat, lon]);
  const moonSteps = useMemo(() => explainMoon(nowMs, lat, lon), [nowMs, lat, lon]);
  const references = useMemo(() => referenceChecks(), []);

  /** The gates `moon.visible` is the product of, each on its own. */
  const gates = useMemo(() => {
    const g = config.moon;
    const up = smoothstep(g.up.from, g.up.to, scene.moon.elevation);
    const skyDark = smoothstep(g.skyDark.from, g.skyDark.to, scene.sun.elevation);
    const elongation = 180 - Math.abs(scene.moon.phase * 360 - 180);
    const dayMoon =
      g.day.strength *
      smoothstep(g.day.elevation.from, g.day.elevation.to, scene.moon.elevation) *
      smoothstep(g.day.elongation.from, g.day.elongation.to, elongation);
    const clear =
      (1 - smoothstep(g.cover.from, g.cover.to, scene.clouds.cover)) *
      (1 - scene.fog * g.fogGate);
    return { up, skyDark, dayMoon, clear, elongation };
  }, [config.moon, scene]);

  const series: Series[] = useMemo(() => {
    const g = config.moon;
    const seriesOf = (fn: (s: WeatherScene) => number) => daySamples.map(fn);
    const upOf = (s: WeatherScene) => smoothstep(g.up.from, g.up.to, s.moon.elevation);
    const darkOf = (s: WeatherScene) =>
      smoothstep(g.skyDark.from, g.skyDark.to, s.sun.elevation);
    const clearOf = (s: WeatherScene) =>
      (1 - smoothstep(g.cover.from, g.cover.to, s.clouds.cover)) * (1 - s.fog * g.fogGate);
    const at = (fn: (s: WeatherScene) => number) => fn(scene);
    return [
      { label: "daylight", color: SUN_COLOR, values: seriesOf((s) => s.sun.daylight), now: scene.sun.daylight, title: "Sun elevation mapped across the twilight window." },
      { label: "glow", color: SUN_COLOR, values: seriesOf((s) => s.sky.glowStrength), now: scene.sky.glowStrength, title: "The keyframed glow strength, after cloud cover mutes it." },
      { label: "sky darkness", color: MOON_COLOR, values: seriesOf(darkOf), now: at(darkOf), title: "Gate 2 of moon visibility: how dark the sky is, from the sun alone." },
      { label: "moon up", color: MOON_COLOR, values: seriesOf(upOf), now: at(upOf), title: "Gate 1: the moon's elevation." },
      { label: "moon clear", color: MOON_COLOR, values: seriesOf(clearOf), now: at(clearOf), title: "Gate 3: cloud cover and fog." },
      { label: "moon visible", color: STAGE_COLOR, values: seriesOf((s) => s.moon.visible), now: scene.moon.visible, title: "The product of the three gates — what the shader is handed." },
      { label: "stars", color: STAGE_COLOR, values: seriesOf((s) => s.stars), now: scene.stars, title: "Night × clear × (1 − moonlight wash)." },
      { label: "fog", color: STAGE_COLOR, values: seriesOf((s) => s.fog), now: scene.fog, title: "Profile fog, plus humidity and precipitation." },
      { label: "cloud cover", color: MOON_COLOR, values: seriesOf((s) => s.clouds.cover), now: scene.clouds.cover, title: "Measured cover, floored by the condition's profile." },
      { label: "cloud darkness", color: MOON_COLOR, values: seriesOf((s) => s.clouds.darkness), now: scene.clouds.darkness, title: "How dark the cloud bases read." },
    ];
  }, [daySamples, scene, config.moon]);

  /**
   * The invariants the model relies on, checked at this instant.
   *
   * Each one is re-derived independently and compared with what the scene
   * says — so they are assertions, not captions.
   */
  const invariants = useMemo(() => {
    const sunAgrees = Math.abs(sunSteps.elevation - scene.sun.elevation) < 1e-9;
    const moonAgrees = Math.abs(moonSteps.elevation - scene.moon.elevation) < 1e-9;
    const rev = (d: number) => ((d % 360) + 360) % 360;
    const phaseFromLongitudes =
      rev(moonSteps.eclipticLon - moonSteps.sunEclipticLon) / 360;
    const phaseAgrees = Math.abs(phaseFromLongitudes - scene.moon.phase) < 1e-9;
    // Force a different condition at the same instant: day/night must not move.
    const other: WeatherCondition = scene.condition === "clear" ? "thunder" : "clear";
    const otherScene = deriveWeatherScene({
      nowMs,
      lat,
      lon,
      weather: { condition: other },
      theme: sceneTheme,
      config,
    });
    const dayFromSun = scene.sun.elevation > config.sun.dayElevationDeg;
    return [
      {
        label: "One clock",
        detail: `sun and moon both from ${stamp(nowMs)}`,
        ok: sunAgrees && moonAgrees,
      },
      {
        label: "phase = moon λ − sun λ",
        detail: `${phaseFromLongitudes.toFixed(6)} vs scene ${scene.moon.phase.toFixed(6)}`,
        ok: phaseAgrees,
      },
      {
        label: "Day/night from the sun alone",
        detail: `${scene.condition} and ${other} agree · elevation ${scene.sun.elevation.toFixed(2)}° > ${config.sun.dayElevationDeg}°`,
        ok: otherScene.sun.isDay === scene.sun.isDay && scene.sun.isDay === dayFromSun,
      },
    ];
  }, [sunSteps, moonSteps, scene, nowMs, lat, lon, sceneTheme, config]);

  // --- Actions ------------------------------------------------------------
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/sky", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(composed),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      const file = normalizeSkyFile(json.file);
      setSavedFile(file);
      setPresets(file.presets);
      setActiveId(file.active);
      toast.success(`Saved content/sky.json · active "${file.active}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [composed]);

  const copy = useCallback(async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }, []);

  const selectPreset = useCallback(
    (id: string) => {
      // Keep the edit you were making before switching away.
      setPresets((prev) => prev.map((p) => (p.id === presetId ? { ...p, config } : p)));
      setPresetId(id);
      setConfig(
        presets.find((p) => p.id === id)?.config ?? DEFAULT_SKY_CONFIG
      );
    },
    [presetId, config, presets]
  );

  const createPreset = useCallback(
    (name: string) => {
      let id = skyPresetId(name);
      while (presets.some((p) => p.id === id)) id = `${id}-2`;
      setPresets((prev) => [
        ...prev.map((p) => (p.id === presetId ? { ...p, config } : p)),
        { id, name, config },
      ]);
      setPresetId(id);
      toast.message(`Preset "${name}" added — save to commit it`);
    },
    [presets, presetId, config]
  );

  const deletePreset = useCallback(
    (id: string) => {
      if (id === "default") return;
      const rest = presets.filter((p) => p.id !== id);
      setPresets(rest);
      if (activeId === id) setActiveId("default");
      setPresetId("default");
      setConfig(rest.find((p) => p.id === "default")?.config ?? DEFAULT_SKY_CONFIG);
    },
    [presets, activeId]
  );

  const runScenario = useCallback(
    (scenario: Scenario) => {
      setForced(scenario.condition);
      jumpTo(scenario.instant(nowMs, lat, lon), "day");
    },
    [jumpTo, nowMs, lat, lon]
  );

  // --- Render -------------------------------------------------------------
  const engineAspect = portrait ? "aspect-[9/16]" : "aspect-[16/10]";
  const moonName = getMoonPhaseName(scene.moon.phase).replace(/-/g, " ");
  const nowMinutes = (nowMs - dayStartMs) / 60_000;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/5 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-sm font-medium tracking-wide">sky.json</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {presets.find((p) => p.id === presetId)?.name ?? presetId}
            {presetId === activeId && " · active"}
          </span>
          {isDirty && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-500">
              unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copy(JSON.stringify(config, null, 2), "Config JSON")}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
            JSON
          </button>
          <button
            type="button"
            onClick={() =>
              copy(
                `${window.location.origin}${buildPermalink({ t: nowMs, lat, lon, preset: presetId, scale })}`,
                "Permalink"
              )
            }
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <Link2 className="h-3 w-3" />
            Link
          </button>
          <button
            type="button"
            onClick={() => {
              setConfig(DEFAULT_SKY_CONFIG);
              toast.message("Reset to the built-in defaults (not yet saved)");
            }}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-1.5 rounded bg-foreground px-3 py-1.5 font-mono text-xs text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ---------------------------------------------------------------- */}
        {/* Left: the picture, the clock, the plots, the readouts            */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto bg-muted/10 p-5">
          {/* The three engines, on the same scene. */}
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Engines · one scene, three renderings
              </span>
              <div className="flex items-center gap-2">
                <Segmented
                  value={sceneTheme}
                  onChange={(v) => setSceneTheme(v as "light" | "dark")}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <figure className="flex flex-col gap-1">
                <div
                  className={cn(
                    "relative overflow-hidden rounded-lg ring-1 ring-border/50",
                    engineAspect
                  )}
                >
                  <WeatherWallpaper
                    scene={scene}
                    active
                    quality={{ pixelBudget: 420_000, maxFps: 45 }}
                    onFallback={(reason) => setFallback(reason)}
                  />
                </div>
                <figcaption className="font-mono text-[10px] text-muted-foreground">
                  Sky · WebGL{fallback ? ` — unavailable (${fallback})` : ""}
                </figcaption>
              </figure>
              <figure className="flex flex-col gap-1">
                <div
                  className={cn("rounded-lg ring-1 ring-border/50", engineAspect)}
                  style={{ backgroundImage: sceneToCssGradient(scene) }}
                />
                <figcaption className="font-mono text-[10px] text-muted-foreground">
                  Gradient · CSS fallback
                </figcaption>
              </figure>
              <figure className="flex flex-col gap-1">
                <div
                  className={cn("rounded-lg ring-1 ring-border/50", engineAspect)}
                  style={{ backgroundImage: getClassicGradient(scene, phase) }}
                />
                <figcaption className="font-mono text-[10px] text-muted-foreground">
                  Classic · {phase}
                </figcaption>
              </figure>
            </div>
          </section>

          {/* The clock. */}
          <section className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                value={scale}
                onChange={(v) => changeScale(v as SweepScale)}
                options={[
                  { value: "day", label: "Day" },
                  { value: "month", label: "Month" },
                  { value: "year", label: "Year" },
                ]}
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPosition(Math.max(0, t - spec.step))}
                  aria-label="Step back"
                  className="rounded border border-border/60 p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setPlaying((v) => !v)}
                  aria-pressed={playing}
                  className={cn(
                    "inline-flex items-center gap-1 rounded border px-2.5 py-1 font-mono text-[11px] transition-colors",
                    playing
                      ? "border-foreground/40 bg-accent text-accent-foreground"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {playing ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() => setPosition(Math.min(spec.span, t + spec.step))}
                  aria-label="Step forward"
                  className="rounded border border-border/60 p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
                <div className="ml-1 flex items-center gap-1">
                  {SPEEDS.map((s) => (
                    <Chip key={s} active={speed === s} onClick={() => setSpeed(s)}>
                      {s}×
                    </Chip>
                  ))}
                </div>
                <Chip active={loop} onClick={() => setLoop((v) => !v)} title="Loop the sweep">
                  Loop
                </Chip>
                {Math.round((nowMs - dayStartMs) / 60_000) !== clockMinutes && (
                  <Chip
                    onClick={() => setClockMinutes(Math.round((nowMs - dayStartMs) / 60_000))}
                    title="Hold the month and year sweeps — and the analemma — at this time of day"
                  >
                    Hold {clock(nowMs)}
                  </Chip>
                )}
                <Chip onClick={() => jumpTo(Date.now(), "day")} title="Back to the real instant">
                  Now
                </Chip>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={spec.span}
                step={spec.unit === "day" ? 1 : 1}
                value={Math.min(spec.span, Math.max(0, t))}
                onChange={(e) => {
                  setPlaying(false);
                  setPosition(Number(e.target.value));
                }}
                aria-label={`${spec.label} scrubber`}
                aria-valuetext={stamp(nowMs)}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
              />
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground/85">
                {stamp(nowMs)}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
              <span>{spec.hint}</span>
              {scale !== "day" && (
                <span className="tabular-nums">
                  clock held at {clock(dayStartMs + clockMinutes * 60_000)} ·{" "}
                  {date(originMs)} → {date(originMs + spec.span * DAY_MS)}
                </span>
              )}
            </div>
          </section>

          {/* The day: painted, and the moon's share of it. */}
          <DayTimeline
            colors={dayColors}
            scenes={daySamples}
            dayStartMs={dayStartMs}
            events={events}
            nowMinutes={nowMinutes}
            realNowMinutes={
              startOfLocalDay(realNowMs) === dayStartMs ? minutesOfDay(realNowMs) : null
            }
            onScrub={(m) => jumpTo(dayStartMs + m * 60_000, "day")}
          />

          {/* Trajectories. */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SkyDomePlot
              sunTrack={sunTrack}
              moonTrack={moonTrack}
              sun={scene.sun}
              moon={scene.moon}
              events={events}
              hint={`${date(dayStartMs)} · ${observer.label}`}
            />
            <ScreenPlot
              track={stagedTrack}
              sun={scene.sun.screen}
              moon={scene.moon.screen}
              moonVisible={scene.moon.visible}
              moonSize={scene.moon.size}
              contentTop={config.staging.moon.rise}
              portrait={portrait}
              hint={portrait ? "portrait" : "landscape"}
            />
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AnalemmaPlot
              points={analemmaPoints}
              now={{ ms: nowMs, elevation: sunSteps.elevation, azimuth: sunSteps.azimuth }}
              clockLabel={clock(dayStartMs + clockMinutes * 60_000)}
            />
            <MoonMonthPlot
              days={monthDays}
              nowMs={nowMs}
              mirror={hemisphere === -1}
              onPick={(ms) => jumpTo(ms, scale === "day" ? "day" : scale)}
            />
          </section>

          {/* The world model, made visible. */}
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Derived scalars · across the day
              </span>
              <Sparklines series={series} nowFraction={nowMinutes / 1440} />
              <Note>
                Moon visibility is up × sky × clear, and the three are plotted
                separately above it — a moon that went out has a culprit, not a
                mystery.
              </Note>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Phase
              </span>
              <PhaseDial
                phase={scene.moon.phase}
                illumination={scene.moon.illumination}
                elongation={gates.elongation}
                name={moonName}
                mirror={hemisphere === -1}
              />
              <div className="grid grid-cols-2 gap-x-4">
                <Readout label="up" value={gates.up.toFixed(3)} />
                <Readout label="sky dark" value={gates.skyDark.toFixed(3)} />
                <Readout label="clear" value={gates.clear.toFixed(3)} />
                <Readout label="daytime moon" value={gates.dayMoon.toFixed(3)} />
                <Readout label="visible" value={scene.moon.visible.toFixed(3)} />
                <Readout label="drawn size" value={`${scene.moon.size.toFixed(2)}×`} />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Ephemeris · sun
              </span>
              <Readout label="day (J2000)" value={sunSteps.day.toFixed(4)} />
              <Readout label="mean anomaly" value={`${sunSteps.meanAnomaly.toFixed(3)}°`} />
              <Readout label="mean longitude" value={`${sunSteps.meanLongitude.toFixed(3)}°`} />
              <Readout label="ecliptic λ" value={`${sunSteps.eclipticLon.toFixed(3)}°`} />
              <Readout label="obliquity" value={`${sunSteps.obliquity.toFixed(4)}°`} />
              <Readout label="right ascension" value={`${sunSteps.rightAscension.toFixed(3)}°`} />
              <Readout label="declination" value={`${sunSteps.declination.toFixed(3)}°`} />
              <Readout label="GMST / LST" value={`${sunSteps.gmstHours.toFixed(3)} h / ${sunSteps.lstHours.toFixed(3)} h`} />
              <Readout label="hour angle" value={`${sunSteps.hourAngle.toFixed(3)}°`} />
              <Readout label="elevation / azimuth" value={`${sunSteps.elevation.toFixed(3)}° / ${sunSteps.azimuth.toFixed(3)}°`} />
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Ephemeris · moon
              </span>
              <Readout label="day (Schlyter)" value={moonSteps.ephemeris.day.toFixed(4)} />
              <Readout label="N / i / w" value={`${moonSteps.ephemeris.node.toFixed(2)}° / ${moonSteps.ephemeris.inclination.toFixed(3)}° / ${moonSteps.ephemeris.perigee.toFixed(2)}°`} />
              <Readout label="M / E / v" value={`${moonSteps.ephemeris.meanAnomaly.toFixed(2)}° / ${moonSteps.ephemeris.eccentricAnomaly.toFixed(2)}° / ${moonSteps.ephemeris.trueAnomaly.toFixed(2)}°`} />
              <Readout label="D / F" value={`${moonSteps.ephemeris.elongationD.toFixed(2)}° / ${moonSteps.ephemeris.argumentF.toFixed(2)}°`} />
              <Readout
                label="perturbations λ / β"
                value={`${moonSteps.ephemeris.lonPerturbation >= 0 ? "+" : "−"}${Math.abs(moonSteps.ephemeris.lonPerturbation).toFixed(3)}° / ${moonSteps.ephemeris.latPerturbation >= 0 ? "+" : "−"}${Math.abs(moonSteps.ephemeris.latPerturbation).toFixed(3)}°`}
              />
              <Readout label="ecliptic λ / β" value={`${moonSteps.eclipticLon.toFixed(3)}° / ${moonSteps.eclipticLat.toFixed(3)}°`} />
              <Readout label="distance" value={`${moonSteps.distance.toFixed(3)} R⊕ · ${Math.round(moonSteps.distanceKm).toLocaleString("en-GB")} km`} />
              <Readout label="right ascension / dec" value={`${moonSteps.rightAscension.toFixed(3)}° / ${moonSteps.declination.toFixed(3)}°`} />
              <Readout label="geocentric elevation" value={`${moonSteps.geocentricElevation.toFixed(3)}°`} />
              <Readout label="parallax correction" value={`−${moonSteps.parallax.toFixed(3)}°`} />
              <Readout label="elevation / azimuth" value={`${moonSteps.elevation.toFixed(3)}° / ${moonSteps.azimuth.toFixed(3)}°`} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                The one-clock guarantee
              </span>
              {invariants.map((inv) => (
                <Readout
                  key={inv.label}
                  label={`${inv.ok ? "✓" : "✗"} ${inv.label}`}
                  value={inv.detail}
                  tone={inv.ok ? "good" : "bad"}
                />
              ))}
              <Note>
                Re-derived at this instant and compared with the scene, so these
                are assertions rather than captions. A moon in a daytime sky is
                impossible by construction: the condition cannot reach the sun.
              </Note>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Compared with the literature
              </span>
              {references.map((r) => (
                <Readout
                  key={r.label}
                  label={`${r.ok ? "✓" : "✗"} ${r.label}`}
                  title={`${r.source} · published ${r.published}, model ${r.measured}`}
                  value={`${r.measured} (${r.error})`}
                  tone={r.ok ? "good" : "bad"}
                />
              ))}
              <Note>
                Schlyter-grade is a claim until something measures it. Four
                published constants, recomputed from this repo&rsquo;s ephemeris
                at load — not from a snapshot of itself.
              </Note>
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right: the config                                                */}
        {/* ---------------------------------------------------------------- */}
        <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-l border-border">
          <PresetPanel
            presets={presets}
            editingId={presetId}
            activeId={activeId}
            onSelect={selectPreset}
            onCreate={createPreset}
            onDelete={deletePreset}
            onMakeActive={setActiveId}
          />
          <ObserverPanel
            observer={observer}
            onChange={setObserver}
            resolved={resolved}
            hemisphere={hemisphere}
            onScenario={runScenario}
          />
          <WeatherPanel
            ctx={ctx}
            condition={scene.condition}
            forced={forced}
            onForce={setForced}
            overrides={overrides}
            onOverrides={setOverrides}
            weather={weather}
            cover={scene.clouds.cover}
            precipitation={scene.precipitation.intensity}
          />
          <SunPanel ctx={ctx} />
          <MoonPanel ctx={ctx} />
          <StarsPanel ctx={ctx} />
          <StagingPanel ctx={ctx} portrait={portrait} onPortrait={setPortrait} />
          <Panel title="What this is">
            <Note>
              `/editor/sky` is a consumer of `systems/ambient/lib`, never a fork
              of it. Every lever above is a field of the `SkyConfig` that
              `deriveWeatherScene`, `stageMoon` and the shader take as input;
              Save writes `content/sky.json`, which the site imports at build.
            </Note>
            <Note>
              `pnpm sky:check` fails if that file stops normalising cleanly — a
              removed field, an out-of-range value, a colour that is not a hex
              triple.
            </Note>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
