"use client";

// =============================================================================
// Sky Engine Lab — /editor/sky
//
// The workbench for the weather wallpaper's world model: the solar and lunar
// ephemeris, the scene derivation, the two engines, and the composition step
// between "where things are" and "where they are drawn". Every table the look
// depends on is a lever here; every intermediate the derivation computes is a
// readout or a plot.
//
// The stage is not a mock. The page behind this one is the site's own
// full-page wallpaper, painting the lab's scene through `labStage` on the
// provider — the same canvas, the same shader, the same CSS engines a visitor
// gets. The lab drives `deriveWeatherScene` itself, with its own clock and
// observer, so a month sweep never goes through the provider's minute tick
// and the site's clock is untouched.
//
// Two things reach past this page, exactly as in the Legibility Lab:
//   stage    → `labStage` on the provider: the scene the page paints. Lab-only;
//              cleared on leave.
//   config   → `labSkyConfig` on the provider: the tuned world model, in force
//              on every route until Save or Reset all — so a moon staged here
//              can be checked on the real home screen before it is committed.
// Nothing here is a second copy of the model — every number comes from
// `systems/ambient/lib`.
// =============================================================================

import { Chip, CopyButton, Field, LabButton, Note, Readout, Section, Segmented, Slider } from "@/app/editor/controls";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useTheme } from "@/services";
import { useLocation, useWallpaper, useWeather } from "@/systems/ambient";
import { WeatherWallpaper } from "@/systems/ambient/components/wallpaper";
import { getClassicGradient, sceneToCssGradient } from "@/systems/ambient/lib/gradient";
import { deriveAmbientPhase } from "@/systems/ambient/lib/phase";
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
  DEFAULT_PRESET_ID,
  DEFAULT_SKY_CONFIG,
  diffSkyValues,
  normalizeSkyFile,
  skyPresetId,
  type SkyConfig,
  type SkyFile,
  type SkyPreset,
} from "@/systems/ambient/lib/sky-config";
import { explainMoon, explainSun, getMoonPhaseName, smoothstep, startOfLocalDay } from "@/systems/ambient/lib/solar";
import { WEATHER_STYLES, type WeatherStyle } from "@/systems/ambient/lib/wallpaper";
import type { WeatherCondition } from "@/systems/ambient/lib/weather";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ApiReadout,
  CloudsSection,
  ConditionField,
  MoonSection,
  ObserverSection,
  PresetSection,
  setIn,
  StagingSection,
  StarsSection,
  SunSection,
  VeilSection,
  type PanelContext,
} from "./controls";
import { useLabText } from "./i18n";
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
  SYNODIC_SAMPLE,
  type LabLink,
  type Observer,
  type Scenario,
  type SweepScale,
} from "./model";
import { ScreenPlot, SkyDomePlot } from "./plots/dome";
import { MOON_COLOR, STAGE_COLOR, SUN_COLOR } from "./plots/primitives";
import { DayTimeline, Sparklines, type Series } from "./plots/timeline";
import { AnalemmaPlot, MoonMonthPlot, PhaseDial } from "./plots/year";

/** Scenes per day in the lab: one every ten minutes. */
const DAY_SAMPLES = 144;

/** A glass card on the stage — the home screen's widget material. */
const CARD = "ink-flat rounded-2xl border border-border/50 bg-glass p-4 backdrop-blur-xl";

// -----------------------------------------------------------------------------
// Session store — the config as you left it, kept while the tab lives
//
// Leaving the lab keeps the tuned config in force on the site (through the
// provider); coming back should find the panel where you left it, not the
// committed file. It lives in sessionStorage rather than a module variable
// because in dev a Save rewrites `content/sky.json`, which is a static import
// of the scene module, and the hot reload that follows re-executes this module
// and remounts the lab with the props it was first rendered with. The store
// survives that; `pagehide` clears it, so a reload still starts from the
// committed file, as the Legibility Lab does.
//
// A session is trusted when it was taken from the file the server just read,
// or when it was saved after the server read it (the stale-props remount);
// a file that changed on disk by other means wins over it.
// -----------------------------------------------------------------------------

interface LabSession {
  savedJson: string;
  savedAt: number;
  savedFile: SkyFile;
  presets: SkyPreset[];
  activeId: string;
  presetId: string;
  config: SkyConfig;
}

const SESSION_KEY = "hux_sky_lab";
/**
 * Fired with the saved `SkyFile` once `/api/sky` has written it. In dev the
 * write itself triggers the hot reload above, which can remount the lab before
 * the response arrives — so the instance that sent the request may be gone by
 * then. Whichever instance is mounted adopts the saved file.
 */
const SAVED_EVENT = "hux-sky-lab-saved";

function readSession(): LabSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LabSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: LabSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable — the lab simply starts from the file next time.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing to clear.
    }
  });
}

/** The "this is what you are looking at" line above a stage element. */
function Caption({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="ink-bare mb-2 flex flex-wrap items-baseline justify-between gap-3">
      <div className={TYPE.label}>{children}</div>
      {right}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Boot
// -----------------------------------------------------------------------------

export function SkyEditorView({ initialFile, readAtMs }: { initialFile: SkyFile; readAtMs: number }) {
  const { L } = useLabText();
  // The lab is a clock, and a clock cannot be server-rendered without a
  // hydration mismatch. Boot on the client, from the permalink if there is
  // one, and from the session store if the tab has one worth keeping.
  const [start, setStart] = useState<{ ms: number; link: LabLink; session: LabSession | null } | null>(null);
  useEffect(() => {
    const link = readPermalink(window.location.search);
    const stored = readSession();
    const session =
      stored &&
      (stored.savedJson === JSON.stringify(initialFile) || stored.savedAt > readAtMs)
        ? stored
        : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock, the permalink and the session only exist on the client
    setStart({ ms: link.t ?? Date.now(), link, session });
  }, [initialFile, readAtMs]);

  if (!start) {
    return (
      <main className="flex min-h-[60svh] items-center justify-center">
        <span className="ink-bare font-mono text-xs text-muted-foreground">{L.booting}</span>
      </main>
    );
  }
  return <SkyLab initialFile={initialFile} session={start.session} startMs={start.ms} link={start.link} />;
}

// -----------------------------------------------------------------------------
// The lab
// -----------------------------------------------------------------------------

function SkyLab({
  initialFile,
  session,
  startMs,
  link,
}: {
  initialFile: SkyFile;
  session: LabSession | null;
  startMs: number;
  link: LabLink;
}) {
  const T = useLabText();
  const { L, themeName, styleName, conditionName } = T;
  const { theme, setThemePreference } = useTheme();
  const { location } = useLocation();
  const { weather, scene: siteScene } = useWeather();
  const wallpaper = useWallpaper();
  const { setLabStage, setLabSkyConfig, effectiveStyle } = wallpaper;

  // --- The config ---------------------------------------------------------
  // Restored from the session when there is one to trust (see the store
  // above); otherwise the committed file, opened on the permalink's preset.
  const [savedFile, setSavedFile] = useState<SkyFile>(() => session?.savedFile ?? initialFile);
  const [presets, setPresets] = useState<SkyPreset[]>(() => session?.presets ?? initialFile.presets);
  const [activeId, setActiveId] = useState(() => session?.activeId ?? initialFile.active);
  const [presetId, setPresetId] = useState(() => {
    if (session) return session.presetId;
    const wanted = link.preset && initialFile.presets.some((p) => p.id === link.preset) ? link.preset : null;
    return wanted ?? initialFile.active ?? DEFAULT_PRESET_ID;
  });
  const [config, setConfig] = useState<SkyConfig>(
    () => session?.config ?? activeSkyConfig(initialFile, link.preset ?? initialFile.active),
  );
  const [saving, setSaving] = useState(false);

  /** The file as it would be written right now. */
  const composed = useMemo<SkyFile>(
    () => ({
      version: savedFile.version,
      active: activeId,
      presets: presets.map((p) => (p.id === presetId ? { ...p, config } : p)),
    }),
    [savedFile.version, activeId, presets, presetId, config],
  );
  const savedJson = useMemo(() => JSON.stringify(savedFile), [savedFile]);
  const isDirty = useMemo(() => JSON.stringify(composed) !== savedJson, [composed, savedJson]);
  /** When `savedFile` last changed — a Save, or the file the lab opened on. */
  const savedAt = useRef(session?.savedAt ?? 0);
  useEffect(() => {
    writeSession({ savedJson, savedAt: savedAt.current, savedFile, presets, activeId, presetId, config });
  }, [savedJson, savedFile, presets, activeId, presetId, config]);

  /** What a lever's star goes back to: the committed value for this preset. */
  const defaults = useMemo(() => activeSkyConfig(savedFile, presetId), [savedFile, presetId]);
  /** How many leaves of the config differ from the committed preset. */
  const changes = useMemo(() => diffSkyValues(defaults, config).length, [defaults, config]);

  const update = useCallback(
    (path: (string | number)[], value: unknown) => setConfig((prev) => setIn(prev, path, value)),
    [],
  );
  const ctx: PanelContext = useMemo(() => ({ config, defaults, update, T }), [config, defaults, update, T]);

  // The tuned config reaches the provider, which paints every route with it
  // until Reset all — that is how a moon staged here reaches the home screen.
  // What the site would otherwise paint is the committed active preset.
  const committedActive = useMemo(() => activeSkyConfig(savedFile), [savedFile]);
  const inForce = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(committedActive),
    [config, committedActive],
  );
  useEffect(() => {
    setLabSkyConfig(inForce ? config : null);
  }, [setLabSkyConfig, inForce, config]);

  // --- The observer -------------------------------------------------------
  const resolved: Observer | null = location
    ? { label: location.city || L.resolved, lat: location.lat, lon: location.lon }
    : null;
  const [observer, setObserver] = useState<Observer>(() =>
    link.lat !== undefined && link.lon !== undefined
      ? { label: L.permalink, lat: link.lat, lon: link.lon }
      : { label: "London", lat: 51.5074, lon: -0.1278 },
  );
  // Adopt the visitor's own location once, when it arrives and the lab was not
  // opened on a permalink that already named one.
  const adopted = useRef(link.lat !== undefined);
  useEffect(() => {
    if (adopted.current || !location) return;
    adopted.current = true;
    setObserver({ label: location.city || L.resolved, lat: location.lat, lon: location.lon });
  }, [location, L.resolved]);
  const { lat, lon } = observer;
  const hemisphere: 1 | -1 = lat < 0 ? -1 : 1;

  // --- The clock ----------------------------------------------------------
  const [scale, setScale] = useState<SweepScale>(link.scale ?? "day");
  const [originMs, setOriginMs] = useState(() => sweepOrigin(link.scale ?? "day", startMs));
  const [t, setT] = useState(() =>
    sweepPosition(link.scale ?? "day", sweepOrigin(link.scale ?? "day", startMs), startMs),
  );
  /**
   * The sweep position, mirrored for the play loop. The rAF loop needs the
   * live position without re-subscribing every frame, and a scrub has to land
   * in both — so every write goes through one setter.
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
  const nowMinutes = (nowMs - dayStartMs) / 60_000;

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
    [scale, setPosition],
  );
  const changeScale = useCallback((next: SweepScale) => jumpTo(nowMs, next), [jumpTo, nowMs]);
  const step = useCallback(
    (direction: 1 | -1) => {
      setPlaying(false);
      setPosition(Math.max(0, Math.min(spec.span, tRef.current + direction * spec.step)));
    },
    [spec, setPosition],
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

  // Keyboard: space plays, the arrows step — unless a field has the focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.closest("input, textarea, select, button, [contenteditable]") || e.metaKey || e.ctrlKey)) return;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((v) => !v);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  // --- The weather --------------------------------------------------------
  const [forced, setForced] = useState<WeatherCondition | null>(null);
  const [overrides, setOverrides] = useState<SceneOverrides>({});
  const [portrait, setPortrait] = useState(false);
  const [stageStyle, setStageStyle] = useState<WeatherStyle>("sky");
  // The site's own cloud layout, so entering the lab does not reshuffle the sky.
  const [seed] = useState(() => siteScene.seed);
  const [fallback, setFallback] = useState<string | null>(null);

  const events = useMemo(() => dayEvents(dayStartMs, lat, lon), [dayStartMs, lat, lon]);

  const sceneWeather = useMemo(
    () =>
      toSceneWeather(weather, forced ? { condition: forced } : null, {
        sunriseMs: events.sun.rise ?? undefined,
        sunsetMs: events.sun.set ?? undefined,
      }),
    [weather, forced, events],
  );

  // --- The scene ----------------------------------------------------------
  const scene: WeatherScene = useMemo(
    () => deriveWeatherScene({ nowMs, lat, lon, weather: sceneWeather, theme, overrides, seed, config }),
    [nowMs, lat, lon, sceneWeather, theme, overrides, seed, config],
  );

  // The stage: the page behind paints this scene with this engine. Cleared on
  // leave, so the visitor's own wallpaper comes back.
  useEffect(() => {
    setLabStage({ scene, style: stageStyle });
  }, [setLabStage, scene, stageStyle]);
  useEffect(() => () => setLabStage(null), [setLabStage]);

  const phase = useMemo(
    () =>
      deriveAmbientPhase({
        nowMs,
        sunriseMs: events.sun.rise ?? undefined,
        sunsetMs: events.sun.set ?? undefined,
      }),
    [nowMs, events],
  );

  // --- The day, sampled ---------------------------------------------------
  const daySamples = useMemo(
    () =>
      sampleDay({
        dayMs: dayStartMs,
        lat,
        lon,
        weather: sceneWeather,
        theme,
        overrides,
        config,
        samples: DAY_SAMPLES,
      }),
    [dayStartMs, lat, lon, sceneWeather, theme, overrides, config],
  );
  const dayColors = useMemo(() => daySamples.map((s) => mixRGB(s.sky.zenith, s.sky.horizon, 0.45)), [daySamples]);

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
    [daySamples, dayStartMs],
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
    [yearOriginMs, clockMinutes, lat, lon],
  );
  const monthDays = useMemo(
    () => moonMonth(monthWindow.first, clockMinutes, lat, lon, monthWindow.days),
    [monthWindow, clockMinutes, lat, lon],
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
    const clear = (1 - smoothstep(g.cover.from, g.cover.to, scene.clouds.cover)) * (1 - scene.fog * g.fogGate);
    return { up, skyDark, dayMoon, clear, elongation };
  }, [config.moon, scene]);

  const series: Series[] = useMemo(() => {
    const g = config.moon;
    const upOf = (s: WeatherScene) => smoothstep(g.up.from, g.up.to, s.moon.elevation);
    const darkOf = (s: WeatherScene) => smoothstep(g.skyDark.from, g.skyDark.to, s.sun.elevation);
    const clearOf = (s: WeatherScene) =>
      (1 - smoothstep(g.cover.from, g.cover.to, s.clouds.cover)) * (1 - s.fog * g.fogGate);
    const row = (key: string, color: string, fn: (s: WeatherScene) => number): Series => ({
      label: L.series[key][0],
      title: L.series[key][1],
      color,
      values: daySamples.map(fn),
      now: fn(scene),
    });
    return [
      row("daylight", SUN_COLOR, (s) => s.sun.daylight),
      row("glow", SUN_COLOR, (s) => s.sky.glowStrength),
      row("skyDark", MOON_COLOR, darkOf),
      row("moonUp", MOON_COLOR, upOf),
      row("moonClear", MOON_COLOR, clearOf),
      row("moonVisible", STAGE_COLOR, (s) => s.moon.visible),
      row("stars", STAGE_COLOR, (s) => s.stars),
      row("fog", STAGE_COLOR, (s) => s.fog),
      row("cover", MOON_COLOR, (s) => s.clouds.cover),
      row("darkness", MOON_COLOR, (s) => s.clouds.darkness),
    ];
  }, [daySamples, scene, config.moon, L.series]);

  /**
   * The invariants the model relies on, checked at this instant. Each one is
   * re-derived independently and compared with what the scene says — so they
   * are assertions, not captions.
   */
  const invariants = useMemo(() => {
    const sunAgrees = Math.abs(sunSteps.elevation - scene.sun.elevation) < 1e-9;
    const moonAgrees = Math.abs(moonSteps.elevation - scene.moon.elevation) < 1e-9;
    const rev = (d: number) => ((d % 360) + 360) % 360;
    const phaseFromLongitudes = rev(moonSteps.eclipticLon - moonSteps.sunEclipticLon) / 360;
    const phaseAgrees = Math.abs(phaseFromLongitudes - scene.moon.phase) < 1e-9;
    // Force a different condition at the same instant: day/night must not move.
    const other: WeatherCondition = scene.condition === "clear" ? "thunder" : "clear";
    const otherScene = deriveWeatherScene({ nowMs, lat, lon, weather: { condition: other }, theme, config });
    const dayFromSun = scene.sun.elevation > config.sun.dayElevationDeg;
    return [
      { label: L.invOneClock, detail: L.invOneClockDetail(stamp(nowMs)), ok: sunAgrees && moonAgrees },
      {
        label: L.invPhase,
        detail: L.invPhaseDetail(phaseFromLongitudes.toFixed(6), scene.moon.phase.toFixed(6)),
        ok: phaseAgrees,
      },
      {
        label: L.invDayNight,
        detail: L.invDayNightDetail(
          conditionName(scene.condition),
          conditionName(other),
          `${scene.sun.elevation.toFixed(2)}°`,
          `${config.sun.dayElevationDeg}°`,
        ),
        ok: otherScene.sun.isDay === scene.sun.isDay && scene.sun.isDay === dayFromSun,
      },
    ];
  }, [sunSteps, moonSteps, scene, nowMs, lat, lon, theme, config, L, conditionName]);

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
      // Write the session now, so a remount that beats the state updates
      // below still finds the preset you were on; then let whichever lab
      // instance is mounted adopt the saved file (see SAVED_EVENT).
      writeSession({
        savedJson: JSON.stringify(file),
        savedAt: Date.now(),
        savedFile: file,
        presets: file.presets,
        activeId: file.active,
        presetId,
        config,
      });
      window.dispatchEvent(new CustomEvent<SkyFile>(SAVED_EVENT, { detail: file }));
      toast.success(L.saved(file.active));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : L.saveFailed);
    } finally {
      setSaving(false);
    }
  }, [composed, presetId, config, L]);

  // The saved file lands here — from this instance's own Save, or from the
  // one that was unmounted under it by the hot reload the write triggered.
  useEffect(() => {
    const onSaved = (e: Event) => {
      const file = (e as CustomEvent<SkyFile>).detail;
      savedAt.current = Date.now();
      setSavedFile(file);
      setPresets(file.presets);
      setActiveId(file.active);
    };
    window.addEventListener(SAVED_EVENT, onSaved);
    return () => window.removeEventListener(SAVED_EVENT, onSaved);
  }, []);

  const selectPreset = useCallback(
    (id: string) => {
      // Keep the edit you were making before switching away.
      setPresets((prev) => prev.map((p) => (p.id === presetId ? { ...p, config } : p)));
      setPresetId(id);
      setConfig(presets.find((p) => p.id === id)?.config ?? DEFAULT_SKY_CONFIG);
    },
    [presetId, config, presets],
  );

  // "Add" saves the current config as a NEW preset and moves the editing
  // there. The preset you were on keeps its stored config — the edit was for
  // the new one, and baking it into both is how a default gets overwritten
  // by accident.
  const createPreset = useCallback(
    (name: string) => {
      let id = skyPresetId(name);
      while (presets.some((p) => p.id === id)) id = `${id}-2`;
      setPresets((prev) => [...prev, { id, name, config }]);
      setPresetId(id);
      toast.message(L.presetAdded(name));
    },
    [presets, config, L],
  );

  const deletePreset = useCallback(
    (id: string) => {
      if (id === DEFAULT_PRESET_ID) return;
      const rest = presets.filter((p) => p.id !== id);
      setPresets(rest);
      if (activeId === id) setActiveId(DEFAULT_PRESET_ID);
      setPresetId(DEFAULT_PRESET_ID);
      setConfig(rest.find((p) => p.id === DEFAULT_PRESET_ID)?.config ?? DEFAULT_SKY_CONFIG);
    },
    [presets, activeId],
  );

  const runScenario = useCallback(
    (scenario: Scenario) => {
      setForced(scenario.condition);
      jumpTo(scenario.instant(nowMs, lat, lon), "day");
    },
    [jumpTo, nowMs, lat, lon],
  );

  const resetAll = useCallback(() => {
    setConfig(defaults);
    setOverrides({});
    setForced(null);
    setLabSkyConfig(null);
  }, [defaults, setLabSkyConfig]);

  const permalink = useCallback(
    () => `${window.location.origin}${buildPermalink({ t: nowMs, lat, lon, preset: presetId, scale })}`,
    [nowMs, lat, lon, presetId, scale],
  );
  const exported = useMemo(() => JSON.stringify(config, null, 2), [config]);

  // --- Render -------------------------------------------------------------
  const tileAspect = portrait ? "aspect-[9/16]" : "aspect-[16/10]";
  const moonName = L.moonName[getMoonPhaseName(scene.moon.phase)];
  const presetName = presets.find((p) => p.id === presetId)?.name ?? presetId;
  const heldMinutes = Math.round(nowMinutes);
  const canSave = process.env.NODE_ENV !== "production";

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-6 pb-40 pt-8 lg:flex-row lg:items-start">
      {/* ------------------------------------------------------------------ */}
      {/* Stage                                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="min-w-0 flex-1 space-y-8">
        <header className="ink-bare flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <Link href="/" className="text-xs font-mono tracking-wide text-muted-foreground hover:text-foreground">
              λhux
            </Link>
            <h1 className="mt-1 font-serif text-2xl tracking-tight text-foreground">{L.title}</h1>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {stamp(nowMs)} · {observer.label} · {conditionName(scene.condition)} · {styleName(effectiveStyle)} ·{" "}
            {themeName(theme)} · {presetName}
            {presetId === activeId && ` · ${L.active}`}
            {changes > 0 && <span className="ml-2 text-amber-500/90">{L.changes(changes)}</span>}
            {isDirty && <span className="ml-2 text-amber-500/90">{L.unsaved}</span>}
          </div>
        </header>

        {/* The three engines, on the same scene. */}
        <section>
          <Caption>{L.engines}</Caption>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <figure className="flex flex-col gap-1.5">
              {/* Rounded on the canvas itself, as the picker's tile is, rather
                  than clipped by the frame: clipping a WebGL layer is what
                  some compositors get wrong. */}
              <div className={cn("relative", tileAspect)}>
                <WeatherWallpaper
                  scene={scene}
                  active
                  quality={{ pixelBudget: 420_000, maxFps: 45 }}
                  onFallback={(reason) => setFallback(reason)}
                  className="rounded-2xl ring-1 ring-border/50"
                />
              </div>
              <figcaption className={cn("ink-bare", TYPE.rowMeta)}>
                {fallback ? L.engineSkyDown(fallback) : L.engineSky}
              </figcaption>
            </figure>
            <figure className="flex flex-col gap-1.5">
              <div
                className={cn("rounded-2xl ring-1 ring-border/50", tileAspect)}
                style={{ backgroundImage: sceneToCssGradient(scene) }}
              />
              <figcaption className={cn("ink-bare", TYPE.rowMeta)}>{L.engineGradient}</figcaption>
            </figure>
            <figure className="flex flex-col gap-1.5">
              <div
                className={cn("rounded-2xl ring-1 ring-border/50", tileAspect)}
                style={{ backgroundImage: getClassicGradient(scene, phase) }}
              />
              <figcaption className={cn("ink-bare", TYPE.rowMeta)}>{L.engineClassic(phase)}</figcaption>
            </figure>
          </div>
        </section>

        {/* The clock. */}
        <section>
          <Caption right={<span className={cn("ink-bare", TYPE.rowMeta)}>{L.keys}</span>}>{L.clock}</Caption>
          <div className={cn(CARD, "flex flex-col gap-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="w-56">
                <Segmented
                  value={scale}
                  onChange={changeScale}
                  options={(["day", "month", "year"] as SweepScale[]).map((s) => ({ value: s, label: L.scale[s] }))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Chip onClick={() => step(-1)} title={L.stepBack}>
                  <ChevronLeft className="h-3 w-3" />
                </Chip>
                <Chip active={playing} onClick={() => setPlaying((v) => !v)}>
                  <span className="inline-flex items-center gap-1">
                    {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {playing ? L.pause : L.play}
                  </span>
                </Chip>
                <Chip onClick={() => step(1)} title={L.stepForward}>
                  <ChevronRight className="h-3 w-3" />
                </Chip>
                <span className="mx-1 h-3 w-px bg-border/60" />
                {SPEEDS.map((s) => (
                  <Chip key={s} active={speed === s} onClick={() => setSpeed(s)}>
                    {s}×
                  </Chip>
                ))}
                <span className="mx-1 h-3 w-px bg-border/60" />
                <Chip active={loop} onClick={() => setLoop((v) => !v)} title={L.loopHint}>
                  {L.loop}
                </Chip>
                {heldMinutes !== clockMinutes && (
                  <Chip onClick={() => setClockMinutes(heldMinutes)} title={L.holdHint}>
                    {L.hold(clock(nowMs))}
                  </Chip>
                )}
                <Chip onClick={() => jumpTo(Date.now(), "day")} title={L.nowHint}>
                  {L.now}
                </Chip>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Slider
                value={Math.min(spec.span, Math.max(0, t))}
                min={0}
                max={spec.span}
                step={1}
                aria-label={L.scale[scale]}
                aria-valuetext={stamp(nowMs)}
                onChange={(v) => {
                  setPlaying(false);
                  setPosition(v);
                }}
              />
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">{stamp(nowMs)}</span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] text-muted-foreground">
              <span>{L.scaleHint[scale]}</span>
              {scale !== "day" && (
                <span className="tabular-nums">
                  {L.held(clock(dayStartMs + clockMinutes * 60_000), date(originMs), date(originMs + spec.span * DAY_MS))}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* The day: painted, and the moon's share of it. */}
        <section>
          <Caption>{L.day}</Caption>
          <div className={CARD}>
            <DayTimeline
              colors={dayColors}
              scenes={daySamples}
              dayStartMs={dayStartMs}
              events={events}
              nowMinutes={nowMinutes}
              realNowMinutes={startOfLocalDay(realNowMs) === dayStartMs ? minutesOfDay(realNowMs) : null}
              onScrub={(m) => jumpTo(dayStartMs + m * 60_000, "day")}
              text={{
                title: L.day,
                realNow: L.realNow,
                scrub: L.scrub,
                track: L.moonTrack,
                neverSets: L.sunNeverSets,
                neverRises: L.sunNeverRises,
              }}
            />
          </div>
        </section>

        {/* Trajectories: where the bodies are, and where they are drawn. */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={CARD}>
            <SkyDomePlot
              sunTrack={sunTrack}
              moonTrack={moonTrack}
              sun={scene.sun}
              moon={scene.moon}
              events={events}
              hint={`${date(dayStartMs)} · ${observer.label}`}
              text={{ title: L.dome, legend: [L.legendSun, L.legendMoon] }}
              horizonLabel={L.domeHorizon}
              nightLabel={L.domeNight}
            />
          </div>
          <div className={CARD}>
            <ScreenPlot
              track={stagedTrack}
              sun={scene.sun.screen}
              moon={scene.moon.screen}
              moonVisible={scene.moon.visible}
              moonSize={scene.moon.size}
              contentTop={config.staging.moon.rise}
              portrait={portrait}
              hint={portrait ? L.portrait : L.landscape}
              text={{ title: L.screen, legend: [L.legendSun, L.legendMoonShown, L.legendMoonHidden] }}
              bandLabel={L.screenBand}
            />
          </div>
        </section>

        {/* The long sweeps. */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={CARD}>
            <AnalemmaPlot
              points={analemmaPoints}
              now={{ ms: nowMs, elevation: sunSteps.elevation, azimuth: sunSteps.azimuth }}
              title={L.analemma}
              hint={L.analemmaHint(clock(dayStartMs + clockMinutes * 60_000))}
              footer={L.analemmaFooter}
            />
          </div>
          <div className={CARD}>
            <MoonMonthPlot
              days={monthDays}
              nowMs={nowMs}
              mirror={hemisphere === -1}
              onPick={(ms) => jumpTo(ms, scale)}
              title={L.month}
              peak={L.monthPeak}
              tileTitle={L.monthTile}
            />
          </div>
        </section>

        {/* The world model, made visible. */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className={cn(CARD, "flex flex-col gap-3")}>
            <span className={TYPE.labelSm}>{L.scalars}</span>
            <Sparklines series={series} nowFraction={nowMinutes / 1440} />
            <Note>{L.scalarsNote}</Note>
          </div>
          <div className={cn(CARD, "flex flex-col gap-3")}>
            <span className={TYPE.labelSm}>{L.phase}</span>
            <PhaseDial
              phase={scene.moon.phase}
              illumination={scene.moon.illumination}
              elongation={gates.elongation}
              name={moonName}
              mirror={hemisphere === -1}
              line={L.phaseLine}
              newLabel={L.dialNew}
              fullLabel={L.dialFull}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <Readout k={L.gateUp} v={gates.up.toFixed(3)} />
              <Readout k={L.gateSkyDark} v={gates.skyDark.toFixed(3)} />
              <Readout k={L.gateClear} v={gates.clear.toFixed(3)} />
              <Readout k={L.gateDayMoon} v={gates.dayMoon.toFixed(3)} />
              <Readout k={L.gateVisible} v={scene.moon.visible.toFixed(3)} />
              <Readout k={L.drawnSize} v={`${scene.moon.size.toFixed(2)}×`} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className={cn(CARD, "flex flex-col gap-1.5")}>
            <span className={cn("mb-1", TYPE.labelSm)}>{L.ephemerisSun}</span>
            <Readout k={L.eph.dayJ2000} v={sunSteps.day.toFixed(4)} />
            <Readout k={L.eph.meanAnomaly} v={`${sunSteps.meanAnomaly.toFixed(3)}°`} />
            <Readout k={L.eph.meanLongitude} v={`${sunSteps.meanLongitude.toFixed(3)}°`} />
            <Readout k={L.eph.eclipticLon} v={`${sunSteps.eclipticLon.toFixed(3)}°`} />
            <Readout k={L.eph.obliquity} v={`${sunSteps.obliquity.toFixed(4)}°`} />
            <Readout k={L.eph.ra} v={`${sunSteps.rightAscension.toFixed(3)}°`} />
            <Readout k={L.eph.dec} v={`${sunSteps.declination.toFixed(3)}°`} />
            <Readout k={L.eph.sidereal} v={`${sunSteps.gmstHours.toFixed(3)} h / ${sunSteps.lstHours.toFixed(3)} h`} />
            <Readout k={L.eph.hourAngle} v={`${sunSteps.hourAngle.toFixed(3)}°`} />
            <Readout k={L.eph.elAz} v={`${sunSteps.elevation.toFixed(3)}° / ${sunSteps.azimuth.toFixed(3)}°`} />
          </div>
          <div className={cn(CARD, "flex flex-col gap-1.5")}>
            <span className={cn("mb-1", TYPE.labelSm)}>{L.ephemerisMoon}</span>
            <Readout k={L.eph.daySchlyter} v={moonSteps.ephemeris.day.toFixed(4)} />
            <Readout
              k={L.eph.elements}
              v={`${moonSteps.ephemeris.node.toFixed(2)}° / ${moonSteps.ephemeris.inclination.toFixed(3)}° / ${moonSteps.ephemeris.perigee.toFixed(2)}°`}
            />
            <Readout
              k={L.eph.anomalies}
              v={`${moonSteps.ephemeris.meanAnomaly.toFixed(2)}° / ${moonSteps.ephemeris.eccentricAnomaly.toFixed(2)}° / ${moonSteps.ephemeris.trueAnomaly.toFixed(2)}°`}
            />
            <Readout
              k={L.eph.arguments}
              v={`${moonSteps.ephemeris.elongationD.toFixed(2)}° / ${moonSteps.ephemeris.argumentF.toFixed(2)}°`}
            />
            <Readout
              k={L.eph.perturbations}
              v={`${moonSteps.ephemeris.lonPerturbation >= 0 ? "+" : "−"}${Math.abs(moonSteps.ephemeris.lonPerturbation).toFixed(3)}° / ${moonSteps.ephemeris.latPerturbation >= 0 ? "+" : "−"}${Math.abs(moonSteps.ephemeris.latPerturbation).toFixed(3)}°`}
            />
            <Readout k={L.eph.eclipticLonLat} v={`${moonSteps.eclipticLon.toFixed(3)}° / ${moonSteps.eclipticLat.toFixed(3)}°`} />
            <Readout
              k={L.eph.distance}
              v={`${moonSteps.distance.toFixed(3)} R⊕ · ${Math.round(moonSteps.distanceKm).toLocaleString("en-GB")} km`}
            />
            <Readout k={L.eph.raDec} v={`${moonSteps.rightAscension.toFixed(3)}° / ${moonSteps.declination.toFixed(3)}°`} />
            <Readout k={L.eph.geocentric} v={`${moonSteps.geocentricElevation.toFixed(3)}°`} />
            <Readout k={L.eph.parallax} v={`−${moonSteps.parallax.toFixed(3)}°`} />
            <Readout k={L.eph.elAz} v={`${moonSteps.elevation.toFixed(3)}° / ${moonSteps.azimuth.toFixed(3)}°`} />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className={cn(CARD, "flex flex-col gap-1.5")}>
            <span className={cn("mb-1", TYPE.labelSm)}>{L.invariants}</span>
            {invariants.map((inv) => (
              <Readout key={inv.label} k={`${inv.ok ? "✓" : "✗"} ${inv.label}`} v={inv.detail} tone={inv.ok ? "good" : "bad"} />
            ))}
            <Note className="mt-1">{L.invNote}</Note>
          </div>
          <div className={cn(CARD, "flex flex-col gap-1.5")}>
            <span className={cn("mb-1", TYPE.labelSm)}>{L.references}</span>
            {references.map((r) => (
              <Readout
                key={r.key}
                k={`${r.ok ? "✓" : "✗"} ${r.key === "synodic" ? L.ref.synodic(SYNODIC_SAMPLE) : L.ref[r.key]}`}
                title={L.refTitle(r.source, r.published, r.measured)}
                v={`${r.measured} (${r.error})`}
                tone={r.ok ? "good" : "bad"}
              />
            ))}
            <Note className="mt-1">{L.refNote}</Note>
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Panel                                                                */}
      {/* ------------------------------------------------------------------ */}
      <aside className="ink-flat w-full shrink-0 self-start rounded-2xl border border-border/50 bg-glass-sheet shadow-overlay backdrop-blur-xl lg:sticky lg:top-6 lg:max-h-[calc(100svh-3rem)] lg:w-[380px] lg:overflow-y-auto">
        <Section title={L.scene}>
          <Field as="div" label={L.theme}>
            <Segmented
              value={theme}
              onChange={(v) => setThemePreference(v)}
              options={[
                { value: "light", label: themeName("light") },
                { value: "dark", label: themeName("dark") },
              ]}
            />
          </Field>
          <Field as="div" label={L.stage} hint={effectiveStyle !== stageStyle ? L.fellBack : L.stageHint}>
            <Segmented
              value={stageStyle}
              onChange={setStageStyle}
              options={WEATHER_STYLES.map((style) => ({ value: style, label: styleName(style) }))}
            />
          </Field>
          <ConditionField
            T={T}
            forced={forced}
            onForce={setForced}
            overrides={overrides}
            onOverrides={setOverrides}
            weather={weather}
            cover={scene.clouds.cover}
            precipitation={scene.precipitation.intensity}
            defaultWindKmh={config.clouds.defaultWindKmh}
          />
          <ApiReadout T={T} weather={weather} />
        </Section>

        <ObserverSection
          T={T}
          observer={observer}
          onChange={setObserver}
          resolved={resolved}
          hemisphere={hemisphere}
          onScenario={runScenario}
        />

        <PresetSection
          T={T}
          presets={presets}
          editingId={presetId}
          activeId={activeId}
          onSelect={selectPreset}
          onCreate={createPreset}
          onDelete={deletePreset}
          onMakeActive={setActiveId}
        />

        <SunSection ctx={ctx} />
        <MoonSection ctx={ctx} />
        <StarsSection ctx={ctx} />
        <CloudsSection ctx={ctx} condition={scene.condition} />
        <VeilSection ctx={ctx} />
        <StagingSection ctx={ctx} portrait={portrait} onPortrait={setPortrait} />

        <Section title={L.export}>
          <div className="flex flex-wrap gap-2">
            <LabButton primary onClick={save} disabled={!canSave || !isDirty || saving} title={L.saveHint}>
              <Save className="h-3 w-3" />
              {saving ? L.saving : L.save}
            </LabButton>
            <CopyButton text={exported} label={L.copyJson} />
            <CopyButton text={permalink} label={L.copyLink} />
          </div>
          <div className="flex flex-wrap gap-2">
            <LabButton onClick={() => setConfig(defaults)} disabled={changes === 0}>
              <RotateCcw className="h-3 w-3" />
              {L.resetCommitted}
            </LabButton>
            <LabButton
              onClick={() => {
                setConfig(DEFAULT_SKY_CONFIG);
                toast.message(L.resetDefaultsToast);
              }}
            >
              {L.resetDefaults}
            </LabButton>
            <LabButton onClick={resetAll}>{L.resetAll}</LabButton>
          </div>
          {inForce && <span className="font-mono text-[10px] text-amber-500/90">* {L.inForce}</span>}
          <textarea
            readOnly
            value={exported}
            className="h-40 w-full rounded-md border border-border/60 bg-transparent p-2 text-[10px] font-mono text-muted-foreground outline-none"
          />
          <Note>{L.exportNote}</Note>
        </Section>

        <Section title={L.what}>
          <Note>{L.whatNote}</Note>
        </Section>
      </aside>
    </main>
  );
}
