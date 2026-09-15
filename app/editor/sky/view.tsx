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
  smoothstep,
  startOfLocalDay,
} from "@/systems/ambient/lib/solar";
import type { WeatherCondition } from "@/systems/ambient/lib/weather";
import { Chip, Note, Panel, Readout, Segmented } from "../controls";
import { text } from "./controls";
import { useSkyText } from "./i18n";
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
  DEFAULT_OBSERVER,
  DAY_MS,
  date,
  deg,
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
  const { L } = useSkyText();
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
        <span className="font-mono text-xs text-muted-foreground">{L.booting}</span>
      </div>
    );
  }
  return <SkyLab initialFile={initialFile} startMs={start.ms} link={start.link} />;
}

/** What to call a resolved location: its city, or its coordinates. */
function observerName(location: { city?: string; lat: number; lon: number }): string {
  return location.city || `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`;
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
  const { L, locale, conditionName, phaseName, moonPhaseName } = useSkyText();
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
    () => ({ config, defaults, update, L }),
    [config, defaults, update, L]
  );

  // --- The observer -------------------------------------------------------
  const resolved: Observer | null = location
    ? { label: observerName(location), lat: location.lat, lon: location.lon }
    : null;
  const [observer, setObserver] = useState<Observer>(() =>
    link.lat !== undefined && link.lon !== undefined
      ? { label: L.observerPermalink, lat: link.lat, lon: link.lon }
      : {
          label: L.cityLondon,
          lat: DEFAULT_OBSERVER.lat,
          lon: DEFAULT_OBSERVER.lon,
        }
  );
  // Adopt the visitor's own location once, when it arrives and the lab was not
  // opened on a permalink that already named one.
  const adopted = useRef(link.lat !== undefined);
  useEffect(() => {
    if (adopted.current || !location) return;
    adopted.current = true;
    setObserver({
      label: observerName(location),
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
  // The lab's three formatters, bound to the reader's locale once.
  const fmtClock = useCallback(
    (ms: number | null | undefined) => clock(ms, locale),
    [locale]
  );
  const fmtDate = useCallback((ms: number) => date(ms, locale), [locale]);
  const fmtStamp = useCallback((ms: number) => stamp(ms, locale), [locale]);
  const scaleLabel = { day: L.scaleDay, month: L.scaleMonth, year: L.scaleYear }[scale];
  const scaleHint = { day: L.hintDay, month: L.hintMonth, year: L.hintYear }[scale];
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
      { label: L.seriesDaylight, color: SUN_COLOR, values: seriesOf((s) => s.sun.daylight), now: scene.sun.daylight, title: L.whyDaylight },
      { label: L.seriesGlow, color: SUN_COLOR, values: seriesOf((s) => s.sky.glowStrength), now: scene.sky.glowStrength, title: L.whyGlow },
      { label: L.seriesSkyDark, color: MOON_COLOR, values: seriesOf(darkOf), now: at(darkOf), title: L.whySkyDark },
      { label: L.seriesMoonUp, color: MOON_COLOR, values: seriesOf(upOf), now: at(upOf), title: L.whyMoonUp },
      { label: L.seriesMoonClear, color: MOON_COLOR, values: seriesOf(clearOf), now: at(clearOf), title: L.whyMoonClear },
      { label: L.seriesMoonVisible, color: STAGE_COLOR, values: seriesOf((s) => s.moon.visible), now: scene.moon.visible, title: L.whyMoonVisible },
      { label: L.seriesStars, color: STAGE_COLOR, values: seriesOf((s) => s.stars), now: scene.stars, title: L.whyStars },
      { label: L.seriesFog, color: STAGE_COLOR, values: seriesOf((s) => s.fog), now: scene.fog, title: L.whyFog },
      { label: L.seriesCover, color: MOON_COLOR, values: seriesOf((s) => s.clouds.cover), now: scene.clouds.cover, title: L.whyCover },
      { label: L.seriesCloudDark, color: MOON_COLOR, values: seriesOf((s) => s.clouds.darkness), now: scene.clouds.darkness, title: L.whyCloudDark },
    ];
  }, [daySamples, scene, config.moon, L]);

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
        label: L.invOneClock,
        detail: L.invOneClockDetail(fmtStamp(nowMs)),
        ok: sunAgrees && moonAgrees,
      },
      {
        label: L.invPhase,
        detail: L.invPhaseDetail(
          phaseFromLongitudes.toFixed(6),
          scene.moon.phase.toFixed(6)
        ),
        ok: phaseAgrees,
      },
      {
        label: L.invDayNight,
        detail: L.invDayNightDetail(
          conditionName(scene.condition),
          conditionName(other),
          deg(scene.sun.elevation, 2),
          deg(config.sun.dayElevationDeg, 1)
        ),
        ok: otherScene.sun.isDay === scene.sun.isDay && scene.sun.isDay === dayFromSun,
      },
    ];
  }, [sunSteps, moonSteps, scene, nowMs, lat, lon, sceneTheme, config, L, conditionName, fmtStamp]);

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
      if (!res.ok) throw new Error(json.error || L.saveFailed);
      const file = normalizeSkyFile(json.file);
      setSavedFile(file);
      setPresets(file.presets);
      setActiveId(file.active);
      toast.success(L.savedToast(file.active));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : L.saveFailed);
    } finally {
      setSaving(false);
    }
  }, [composed, L]);

  const copy = useCallback(async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(L.copied(what));
    } catch {
      toast.error(L.clipboardUnavailable);
    }
  }, [L]);

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
      toast.message(L.presetAdded(name));
    },
    [presets, presetId, config, L]
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
  const moonName = moonPhaseName(scene.moon.phase);
  const nowMinutes = (nowMs - dayStartMs) / 60_000;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/5 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-sm font-medium tracking-wide">sky.json</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {presets.find((p) => p.id === presetId)?.name ?? presetId}
            {presetId === activeId && ` · ${L.active}`}
          </span>
          {isDirty && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-500">
              {L.unsaved}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copy(JSON.stringify(config, null, 2), L.configJson)}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
            {L.json}
          </button>
          <button
            type="button"
            onClick={() =>
              copy(
                `${window.location.origin}${buildPermalink({ t: nowMs, lat, lon, preset: presetId, scale })}`,
                L.permalink
              )
            }
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <Link2 className="h-3 w-3" />
            {L.link}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfig(DEFAULT_SKY_CONFIG);
              toast.message(L.resetToast);
            }}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            {L.reset}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-1.5 rounded bg-foreground px-3 py-1.5 font-mono text-xs text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            {saving ? L.saving : L.save}
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
                {L.engines}
              </span>
              <div className="flex items-center gap-2">
                <Segmented
                  value={sceneTheme}
                  onChange={(v) => setSceneTheme(v as "light" | "dark")}
                  options={[
                    { value: "light", label: L.light },
                    { value: "dark", label: L.dark },
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
                  {L.engineSky}{fallback ? L.engineSkyUnavailable(fallback) : ""}
                </figcaption>
              </figure>
              <figure className="flex flex-col gap-1">
                <div
                  className={cn("rounded-lg ring-1 ring-border/50", engineAspect)}
                  style={{ backgroundImage: sceneToCssGradient(scene) }}
                />
                <figcaption className="font-mono text-[10px] text-muted-foreground">
                  {L.engineGradient}
                </figcaption>
              </figure>
              <figure className="flex flex-col gap-1">
                <div
                  className={cn("rounded-lg ring-1 ring-border/50", engineAspect)}
                  style={{ backgroundImage: getClassicGradient(scene, phase) }}
                />
                <figcaption className="font-mono text-[10px] text-muted-foreground">
                  {L.engineClassic(phaseName(phase))}
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
                  { value: "day", label: L.scaleDay },
                  { value: "month", label: L.scaleMonth },
                  { value: "year", label: L.scaleYear },
                ]}
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPosition(Math.max(0, t - spec.step))}
                  aria-label={L.stepBack}
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
                  {playing ? L.pause : L.play}
                </button>
                <button
                  type="button"
                  onClick={() => setPosition(Math.min(spec.span, t + spec.step))}
                  aria-label={L.stepForward}
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
                <Chip active={loop} onClick={() => setLoop((v) => !v)} title={L.loopTitle}>
                  {L.loop}
                </Chip>
                {Math.round((nowMs - dayStartMs) / 60_000) !== clockMinutes && (
                  <Chip
                    onClick={() => setClockMinutes(Math.round((nowMs - dayStartMs) / 60_000))}
                    title={L.holdTitle}
                  >
                    {L.hold(fmtClock(nowMs))}
                  </Chip>
                )}
                <Chip onClick={() => jumpTo(Date.now(), "day")} title={L.nowTitle}>
                  {L.now}
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
                aria-label={L.scrubber(scaleLabel)}
                aria-valuetext={fmtStamp(nowMs)}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-foreground"
              />
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground/85">
                {fmtStamp(nowMs)}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
              <span>{scaleHint}</span>
              {scale !== "day" && (
                <span className="tabular-nums">
                  {L.clockHeld(
                    fmtClock(dayStartMs + clockMinutes * 60_000),
                    fmtDate(originMs),
                    fmtDate(originMs + spec.span * DAY_MS)
                  )}
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
              hint={`${fmtDate(dayStartMs)} · ${observer.label}`}
            />
            <ScreenPlot
              track={stagedTrack}
              sun={scene.sun.screen}
              moon={scene.moon.screen}
              moonVisible={scene.moon.visible}
              moonSize={scene.moon.size}
              contentTop={config.staging.moon.rise}
              portrait={portrait}
              hint={portrait ? L.portrait : L.landscape}
            />
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AnalemmaPlot
              points={analemmaPoints}
              now={{ ms: nowMs, elevation: sunSteps.elevation, azimuth: sunSteps.azimuth }}
              clockLabel={fmtClock(dayStartMs + clockMinutes * 60_000)}
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
                {L.derivedScalars}
              </span>
              <Sparklines series={series} nowFraction={nowMinutes / 1440} />
              <Note>{L.sparkNote}</Note>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {L.phase}
              </span>
              <PhaseDial
                phase={scene.moon.phase}
                illumination={scene.moon.illumination}
                elongation={gates.elongation}
                name={moonName}
                mirror={hemisphere === -1}
              />
              <div className="grid grid-cols-2 gap-x-4">
                <Readout label={L.gateUp} value={gates.up.toFixed(3)} />
                <Readout label={L.gateSkyDark} value={gates.skyDark.toFixed(3)} />
                <Readout label={L.gateClear} value={gates.clear.toFixed(3)} />
                <Readout label={L.gateDayMoon} value={gates.dayMoon.toFixed(3)} />
                <Readout label={L.gateVisible} value={scene.moon.visible.toFixed(3)} />
                <Readout label={L.drawnSize} value={`${scene.moon.size.toFixed(2)}×`} />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {L.ephemerisSun}
              </span>
              <Readout label={L.dayJ2000} value={sunSteps.day.toFixed(4)} />
              <Readout label={L.meanAnomaly} value={deg(sunSteps.meanAnomaly, 3)} />
              <Readout label={L.meanLongitude} value={deg(sunSteps.meanLongitude, 3)} />
              <Readout label={L.eclipticLon} value={deg(sunSteps.eclipticLon, 3)} />
              <Readout label={L.obliquity} value={deg(sunSteps.obliquity, 4)} />
              <Readout label={L.rightAscension} value={deg(sunSteps.rightAscension, 3)} />
              <Readout label={L.declination} value={deg(sunSteps.declination, 3)} />
              <Readout label={L.siderealTime} value={`${sunSteps.gmstHours.toFixed(3)} h / ${sunSteps.lstHours.toFixed(3)} h`} />
              <Readout label={L.hourAngle} value={deg(sunSteps.hourAngle, 3)} />
              <Readout label={L.elevationAzimuth} value={`${deg(sunSteps.elevation, 3)} / ${deg(sunSteps.azimuth, 3)}`} />
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {L.ephemerisMoon}
              </span>
              <Readout label={L.daySchlyter} value={moonSteps.ephemeris.day.toFixed(4)} />
              <Readout label={L.orbitalElements} value={`${deg(moonSteps.ephemeris.node, 2)} / ${deg(moonSteps.ephemeris.inclination, 3)} / ${deg(moonSteps.ephemeris.perigee, 2)}`} />
              <Readout label={L.anomalies} value={`${deg(moonSteps.ephemeris.meanAnomaly, 2)} / ${deg(moonSteps.ephemeris.eccentricAnomaly, 2)} / ${deg(moonSteps.ephemeris.trueAnomaly, 2)}`} />
              <Readout label={L.elongationArgument} value={`${deg(moonSteps.ephemeris.elongationD, 2)} / ${deg(moonSteps.ephemeris.argumentF, 2)}`} />
              <Readout
                label={L.perturbations}
                value={`${moonSteps.ephemeris.lonPerturbation >= 0 ? "+" : "−"}${Math.abs(moonSteps.ephemeris.lonPerturbation).toFixed(3)}° / ${moonSteps.ephemeris.latPerturbation >= 0 ? "+" : "−"}${Math.abs(moonSteps.ephemeris.latPerturbation).toFixed(3)}°`}
              />
              <Readout label={L.eclipticLonLat} value={`${deg(moonSteps.eclipticLon, 3)} / ${deg(moonSteps.eclipticLat, 3)}`} />
              <Readout label={L.distance} value={`${moonSteps.distance.toFixed(3)} R⊕ · ${Math.round(moonSteps.distanceKm).toLocaleString(locale === "zh" ? "zh-CN" : "en-GB")} km`} />
              <Readout label={L.raDec} value={`${deg(moonSteps.rightAscension, 3)} / ${deg(moonSteps.declination, 3)}`} />
              <Readout label={L.geocentricElevation} value={deg(moonSteps.geocentricElevation, 3)} />
              <Readout label={L.parallaxCorrection} value={`−${moonSteps.parallax.toFixed(3)}°`} />
              <Readout label={L.elevationAzimuth} value={`${deg(moonSteps.elevation, 3)} / ${deg(moonSteps.azimuth, 3)}`} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {L.oneClock}
              </span>
              {invariants.map((inv) => (
                <Readout
                  key={inv.label}
                  label={`${inv.ok ? "✓" : "✗"} ${inv.label}`}
                  value={inv.detail}
                  tone={inv.ok ? "good" : "bad"}
                />
              ))}
              <Note>{L.invariantsNote}</Note>
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {L.references}
              </span>
              {references.map((r) => {
                const label =
                  r.sample === undefined
                    ? text(L, r.labelKey)
                    : L.refSynodic(r.sample);
                return (
                  <Readout
                    key={r.labelKey}
                    label={`${r.ok ? "✓" : "✗"} ${label}`}
                    title={L.refRowTitle(text(L, r.sourceKey), r.published, r.measured)}
                    value={`${r.measured} (${r.error})`}
                    tone={r.ok ? "good" : "bad"}
                  />
                );
              })}
              <Note>{L.referencesNote}</Note>
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
          <Panel title={L.whatThisIs}>
            <Note>{L.aboutNote}</Note>
            <Note>{L.checkNote}</Note>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
