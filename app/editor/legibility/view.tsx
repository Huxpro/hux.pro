"use client";

// =============================================================================
// Legibility Lab — /editor/legibility
//
// The devtool for the question "can I read this?": every wallpaper (the
// weather set included), both materials, both tints, both themes, and one of
// every surface the site draws text on — with every number in the system a
// slider, and a star wherever a live value differs from what ships.
//
// The stage is not a mock. Choosing a wallpaper here selects it for real,
// through the same setters the picker uses; the specimens are the production
// components and classes; the sliders write the same CSS variables the
// provider and the stylesheet already read. What you see is what the site
// does — and leaving the page puts everything back.
//
// Three layers of knob, top to bottom of the panel:
//   scene    → app state (persisted while here, restored on leave)
//   policy   → `legibilityOverride` on the provider (ephemeral)
//   sheet    → inline custom properties on <html> (ephemeral)
// See lab-state.ts for how each reaches CSS.
// =============================================================================

import { CopyButton, Field, Section, Segmented, Slider, Star } from "@/app/editor/controls";
import { cn } from "@/lib/utils";
import { useGlass, useTheme } from "@/services";
import { useAmbientTime, useLocation, useWallpaper, useWeather } from "@/systems/ambient";
import { t } from "@/lib/i18n";
import { WEATHER_STYLES, WEATHER_STYLE_LABEL } from "@/systems/ambient/lib/wallpaper";
import {
  BACKGROUND_RGB,
  CARD_RGB,
  composite,
  contrastRatio,
  DEFAULT_LEGIBILITY_POLICY,
  INK_RGB,
  type LegibilityVars,
  type Theme,
} from "@/systems/ambient/lib/legibility";
import { BUILT_IN_WALLPAPERS, WALLPAPER_CATEGORIES } from "@/systems/ambient/lib/wallpaper";
import { useDevtool } from "@/systems/devtool";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLabText } from "./i18n";
import {
  GalleryTile,
  sceneKey,
  sceneLabel,
  sceneMinutes,
  sceneProfile,
  WEATHER_SCENES,
  type Scene,
  type SkyContext,
} from "./gallery";
import {
  exportCss,
  formatSheetValue,
  knobActsHere,
  LAB_SESSION,
  mergePolicy,
  OUTPUT_KNOBS,
  parseSheetValue,
  POLICY_KNOBS,
  readOutput,
  resolveForLab,
  sameVars,
  SHEET_GROUPS,
  SHEET_KNOBS,
  type OutputPins,
  without,
  type PolicyKnob,
  type PolicyOverrides,
  type SheetOverrides,
} from "./lab-state";
import {
  ActivitySpecimen,
  BareSpecimen,
  PaletteSpecimen,
  ReadingSpecimen,
  SheetSpecimen,
  SpecimenLabel,
  WidgetSpecimen,
} from "./specimens";

// -----------------------------------------------------------------------------
// Small parts
// -----------------------------------------------------------------------------

function Readout({ k, v, title }: { k: string; v: React.ReactNode; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]" title={title}>
      <span className="font-mono text-muted-foreground">{k}</span>
      <span className="font-mono tabular-nums text-foreground">{v}</span>
    </div>
  );
}

function ContrastBadge({ ratio }: { ratio: number }) {
  const grade = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA·L" : "—";
  return (
    <span
      className={cn(
        "ink-flat rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
        ratio >= 4.5
          ? "bg-green-500/15 text-green-700 dark:text-green-400"
          : ratio >= 3
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            : "bg-red-500/15 text-red-700 dark:text-red-400",
      )}
    >
      {ratio.toFixed(1)} {grade}
    </span>
  );
}

// -----------------------------------------------------------------------------
// The view
// -----------------------------------------------------------------------------

export function LegibilityLabView() {
  const wallpaper = useWallpaper();
  const { setLabPolicy, setLegibilityOverride } = wallpaper;
  const weather = useWeather();
  const time = useAmbientTime();
  const { location } = useLocation();
  const devtool = useDevtool();
  const { theme, setThemePreference } = useTheme();
  const glass = useGlass();
  const { locale, L, knobLabel, knobHint, outputName, groupTitle, groupNote, themeName, materialName, tintName } = useLabText();

  // --- The stage needs the devtool on (the condition and clock overrides only
  // apply then) and the wallpaper full-page whatever the visitor's placement.
  // Both, and any condition / clock the scene chips force, are ephemeral
  // devtool state — they go back to what they were on leave, or the picker's
  // placement and the live sky would look broken afterwards. What stays is
  // what the visitor could have set anyway (the wallpaper, theme, material,
  // tint) and the tuning (the policy through the provider, the sheet inline).
  const setters = useRef({ wallpaper, weather, time, devtool });
  useEffect(() => {
    setters.current = { wallpaper, weather, time, devtool };
  });
  const initial = useRef<{
    devtool: boolean;
    overrides: typeof wallpaper.devtoolOverrides;
    condition: typeof weather.debugOverride;
    scrub: number | null;
    dayOffset: number;
  } | null>(null);
  useEffect(() => {
    const s = setters.current;
    if (!initial.current) {
      initial.current = {
        devtool: s.devtool.isEnabled,
        overrides: s.wallpaper.devtoolOverrides,
        condition: s.weather.debugOverride,
        scrub: s.time.timeScrubMinutes,
        dayOffset: s.time.dayOffset,
      };
    }
    s.devtool.setEnabled(true);
    if (!s.wallpaper.devtoolOverrides.full) {
      s.wallpaper.setDevtoolOverrides({ ...s.wallpaper.devtoolOverrides, full: true });
    }
    return () => {
      const i = initial.current;
      const t = setters.current;
      t.wallpaper.setLegibilityOverride(null);
      if (!i) return;
      t.wallpaper.setDevtoolOverrides(i.overrides);
      t.weather.setDebugOverride(i.condition);
      t.time.setTimeScrubMinutes(i.scrub);
      t.time.setDayOffset(i.dayOffset);
      t.devtool.setEnabled(i.devtool);
    };
  }, []);

  // --- Scene ---------------------------------------------------------------
  // A weather scene is a condition at a time of day. Selecting one forces the
  // condition and scrubs the clock, through the same overrides the Sky module
  // uses; the sun and moon still come from the real ephemeris at that clock.
  const skyCtx: SkyContext = useMemo(
    () => ({
      style: wallpaper.effectiveStyle,
      lat: location?.lat,
      lon: location?.lon,
      dayMs: time.nowMs,
      sunriseMs: time.sunriseMs,
      sunsetMs: time.sunsetMs,
    }),
    [wallpaper.effectiveStyle, location?.lat, location?.lon, time.nowMs, time.sunriseMs, time.sunsetMs],
  );

  const scene: Scene = useMemo(() => {
    if (wallpaper.kind === "image") return { kind: "image", id: wallpaper.wallpaper.id };
    const condition = weather.debugOverride?.condition ?? weather.weather?.condition ?? "clear";
    const timeOfDay =
      time.phase === "sunrise" || time.phase === "sunset"
        ? time.phase
        : weather.scene.sun.isDay
          ? "day"
          : "night";
    return { kind: "weather", condition, time: timeOfDay };
  }, [wallpaper.kind, wallpaper.wallpaper.id, weather.debugOverride, weather.weather, weather.scene.sun.isDay, time.phase]);

  const selectScene = useCallback(
    (next: Scene) => {
      if (next.kind === "image") {
        wallpaper.selectWallpaper(next.id);
        return;
      }
      wallpaper.setKind("weather");
      weather.setDebugOverride({ condition: next.condition });
      time.setTimeScrubMinutes(sceneMinutes(next.time, skyCtx));
    },
    [wallpaper, weather, time, skyCtx],
  );

  const goLive = useCallback(() => {
    weather.setDebugOverride(null);
    time.resetTimeTravel();
  }, [weather, time]);
  const isLive = weather.debugOverride === null && !time.isTimeTravelActive;

  // --- Policy → provider override -----------------------------------------
  const [policyOverrides, setPolicyOverrides] = useState<PolicyOverrides>(() => LAB_SESSION.policy);
  const [pins, setPins] = useState<OutputPins>(() => LAB_SESSION.pins);
  const policy = useMemo(() => mergePolicy(policyOverrides), [policyOverrides]);
  useEffect(() => {
    LAB_SESSION.policy = policyOverrides;
    LAB_SESSION.pins = pins;
  }, [policyOverrides, pins]);

  // The tuned policy goes to the provider, which resolves every route with it
  // until Reset all — that is how a veil tuned here reaches /writing.
  useEffect(() => {
    setLabPolicy(Object.keys(policyOverrides).length ? policy : null);
  }, [setLabPolicy, policy, policyOverrides]);

  const reading = wallpaper.reading;
  const shipped = useMemo(
    () => resolveForLab({ profile: wallpaper.profile, theme, reading, policy: DEFAULT_LEGIBILITY_POLICY, pins: {} }),
    [wallpaper.profile, theme, reading],
  );
  const resolved = useMemo(
    () => resolveForLab({ profile: wallpaper.profile, theme, reading, policy, pins }),
    [wallpaper.profile, theme, reading, policy, pins],
  );
  // The policy's own answer, before any pin — what a pin's star goes back to.
  const unpinned = useMemo(
    () => resolveForLab({ profile: wallpaper.profile, theme, reading, policy, pins: {} }),
    [wallpaper.profile, theme, reading, policy],
  );
  // Which policy knobs can move anything for this picture.
  const acts = useMemo(() => {
    const out: Partial<Record<PolicyKnob["key"], boolean>> = {};
    for (const knob of POLICY_KNOBS) out[knob.key] = knobActsHere(knob, { profile: wallpaper.profile, theme, policy });
    return out;
  }, [wallpaper.profile, theme, policy]);
  // The reading specimen carries the policy as a reading route resolves it —
  // no flip, relief × reliefReading, and the veil and blur it will get.
  const readingVars = useMemo(
    () => resolveForLab({ profile: wallpaper.profile, theme, reading: true, policy, pins }),
    [wallpaper.profile, theme, policy, pins],
  );

  useEffect(() => {
    setLegibilityOverride(sameVars(resolved, shipped) ? null : resolved);
  }, [setLegibilityOverride, resolved, shipped]);

  const live: LegibilityVars = wallpaper.legibility;

  // --- Sheet inputs → inline on <html> ------------------------------------
  const [sheet, setSheet] = useState<SheetOverrides>(() => LAB_SESSION.sheet);
  const [defaults, setDefaults] = useState<Record<string, number>>({});
  useEffect(() => {
    LAB_SESSION.sheet = sheet;
  }, [sheet]);

  // Defaults come from the stylesheet itself: lift every override, read the
  // computed values, put the overrides back. Re-read whenever the theme or
  // material changes, since both redefine some of these; a slider drag does
  // not, so it only writes its own property below.
  useEffect(() => {
    const root = document.documentElement;
    const current = LAB_SESSION.sheet;
    for (const knob of SHEET_KNOBS) root.style.removeProperty(knob.name);
    const cs = getComputedStyle(root);
    const next: Record<string, number> = {};
    for (const knob of SHEET_KNOBS) {
      const v = parseSheetValue(cs.getPropertyValue(knob.name));
      if (v !== null) next[knob.name] = v;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the defaults are read off the stylesheet, which only exists after mount
    setDefaults(next);
    for (const knob of SHEET_KNOBS) {
      if (knob.name in current) root.style.setProperty(knob.name, formatSheetValue(knob, current[knob.name]));
    }
  }, [theme, glass.material, glass.tint]);
  useEffect(() => {
    const root = document.documentElement;
    for (const knob of SHEET_KNOBS) {
      if (knob.name in sheet) root.style.setProperty(knob.name, formatSheetValue(knob, sheet[knob.name]));
      else root.style.removeProperty(knob.name);
    }
  }, [sheet]);

  // --- Readouts ------------------------------------------------------------
  const profile = wallpaper.profile;

  const contrast = useMemo(() => {
    // The sheet's inputs as the lab holds them: an override, else what the
    // stylesheet declared (read once per theme/material above).
    const pct = (name: string, fallback: number) => sheet[name] ?? defaults[name] ?? fallback;
    const secondaryAlpha = (pct("--ink-alpha-secondary", 54) + live.inkBoost) / 100;
    const bareAlpha = secondaryAlpha + live.bareBoost / 100;
    const glassFill = (pct("--glass-fill", 50) + pct("--glass-dark-add", 0) + live.glassAdd * pct("--glass-add-k", 0.5)) / 100;
    const sheetFill = (pct("--glass-fill-sheet", 85) + pct("--glass-dark-add", 0) + live.glassAdd * pct("--glass-add-k", 0.5)) / 100;

    const inverse: Theme = theme === "dark" ? "light" : "dark";
    const bareInk = INK_RGB[live.flip ? inverse : theme];
    const bareMidInk = INK_RGB[live.flipMid ? inverse : theme];
    // A band, approximated by scaling the mean colour to its lightness.
    const band = (l: number) => {
      const scale = profile.lum > 0 ? l / profile.lum : 1;
      return profile.mean.map((c) => Math.min(255, Math.round(c * scale))) as [number, number, number];
    };
    const top = band(profile.zones.top);
    const mid = band(profile.zones.mid);
    const onGlass = composite(CARD_RGB[theme], glassFill, profile.mean);
    const onSheet = composite(CARD_RGB[theme], sheetFill, profile.mean);
    const onVeil = composite(BACKGROUND_RGB[theme], readingVars.veil, profile.mean);
    const ink = INK_RGB[theme];
    const row = (bg: [number, number, number], text: [number, number, number], alpha = secondaryAlpha) => ({
      primary: contrastRatio(text, bg),
      secondary: contrastRatio(composite(text, alpha, bg), bg),
    });
    return {
      bare: row(top, bareInk, bareAlpha),
      bareMid: row(mid, bareMidInk, bareAlpha),
      glass: row(onGlass, ink),
      sheet: row(onSheet, ink),
      reading: row(onVeil, composite(ink, 0.85, onVeil)),
    };
  }, [profile, theme, live, readingVars, sheet, defaults]);

  // --- Gallery ---------------------------------------------------------------
  const [galleryCategory, setGalleryCategory] = useState<"weather" | "apple" | "nature">("apple");
  const galleryScenes: Scene[] = useMemo(() => {
    if (galleryCategory === "weather") return WEATHER_SCENES;
    return BUILT_IN_WALLPAPERS.filter((w) => w.category === galleryCategory).map((w) => ({ kind: "image", id: w.id }));
  }, [galleryCategory]);
  // Each tile's profile is derived once per scene set and sky, not per render.
  const galleryTiles = useMemo(
    () =>
      galleryScenes.flatMap((s) => {
        const p = sceneProfile(s, theme, skyCtx);
        return p ? [{ scene: s, profile: p }] : [];
      }),
    [galleryScenes, theme, skyCtx],
  );

  const exported = useMemo(
    () =>
      JSON.stringify(
        {
          policy: policyOverrides,
          pins,
          sheet,
          resolved: live,
          wallpaper: sceneLabel(scene, "en"),
          theme,
          material: glass.material,
          tint: glass.tint,
        },
        null,
        2,
      ),
    [policyOverrides, pins, sheet, live, scene, theme, glass.material, glass.tint],
  );

  const dirty =
    Object.keys(policyOverrides).length + Object.keys(pins).length + Object.keys(sheet).length;

  /** The reset star for a per-theme or paired policy field. */
  const pairStar = (keys: (keyof PolicyOverrides)[], back: string) => (
    <Star
      active={keys.some((k) => k in policyOverrides)}
      title={L.backTo(back)}
      onReset={() => setPolicyOverrides((o) => without(o, ...keys))}
    />
  );

  /** One policy knob: slider, star, hint, what it moves, and whether it can here. */
  const policyKnobRow = (knob: PolicyKnob) => {
    const value = policy[knob.key] as number;
    const actsHere = acts[knob.key] ?? true;
    return (
      <Field key={knob.key} label={knobLabel(knob.key, knob.label)} hint={actsHere ? String(value) : `${value} · ${L.inertHere}`}>
        <div className="flex items-center gap-2">
          <Slider
            value={value}
            min={knob.min}
            max={knob.max}
            step={knob.step}
            onChange={(v) => setPolicyOverrides((o) => ({ ...o, [knob.key]: v }))}
          />
          <Star
            active={knob.key in policyOverrides}
            title={L.backTo(DEFAULT_LEGIBILITY_POLICY[knob.key] as number)}
            onReset={() => setPolicyOverrides((o) => without(o, knob.key))}
          />
        </div>
        <span className={cn("text-[10px]", actsHere ? "text-muted-foreground/60" : "text-muted-foreground/35")}>
          {knobHint(knob.key, knob.hint)}
          <span className="ml-1.5 font-mono text-muted-foreground/40">
            {L.affects} {knob.affects.map(outputName).join(" · ")}
          </span>
        </span>
      </Field>
    );
  };

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
            {sceneLabel(scene, locale)}
            {wallpaper.kind === "weather" && ` · ${t(locale, WEATHER_STYLE_LABEL[wallpaper.effectiveStyle])}`} · {themeName(theme)} · {materialName(glass.material)} · {tintName(glass.tint)}
            {live.flip && ` · ${L.flipped}`}
            {live.flipMid && ` · ${L.flippedMid}`}
            {dirty > 0 && <span className="ml-2 text-amber-500/90">{L.liveChanges(dirty)}</span>}
          </div>
        </header>

        <section>
          <SpecimenLabel>{L.bare}</SpecimenLabel>
          <BareSpecimen />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <SpecimenLabel>{L.widget}</SpecimenLabel>
            <WidgetSpecimen />
          </div>
          <div>
            <SpecimenLabel>{L.activity}</SpecimenLabel>
            <ActivitySpecimen />
          </div>
          <div>
            <SpecimenLabel>{L.palette}</SpecimenLabel>
            <PaletteSpecimen />
          </div>
          <div>
            <SpecimenLabel>{L.sheet}</SpecimenLabel>
            <SheetSpecimen />
          </div>
        </section>

        <section>
          <SpecimenLabel>
            {L.reading(readingVars.veil.toFixed(2), readingVars.blur, readingVars.relief.toFixed(2), readingVars.inkBoost)}
          </SpecimenLabel>
          <ReadingSpecimen vars={readingVars} />
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SpecimenLabel>{L.gallery}</SpecimenLabel>
            <div className="w-64">
              <Segmented
                value={galleryCategory}
                onChange={setGalleryCategory}
                options={[
                  { value: "weather", label: L.galleryWeather },
                  { value: "apple", label: L.galleryApple },
                  { value: "nature", label: L.galleryNature },
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {galleryTiles.map(({ scene: s, profile: p }) => {
              const vars = resolveForLab({ profile: p, theme, reading: false, policy, pins: {} });
              return (
                <GalleryTile
                  key={sceneKey(s)}
                  scene={s}
                  theme={theme}
                  vars={vars}
                  selected={sceneKey(s) === sceneKey(scene)}
                  onSelect={() => selectScene(s)}
                  locale={locale}
                  ctx={skyCtx}
                />
              );
            })}
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
          <Field as="div" label={L.material}>
            <Segmented
              value={glass.material}
              onChange={glass.setMaterial}
              options={[
                { value: "tinted", label: materialName("tinted") },
                { value: "clear", label: materialName("clear") },
              ]}
            />
          </Field>
          <Field as="div" label={L.tint}>
            <Segmented
              value={glass.tint}
              onChange={glass.setTint}
              options={[
                { value: "neutral", label: tintName("neutral") },
                { value: "wallpaper", label: tintName("wallpaper") },
              ]}
            />
          </Field>
          <Field as="div" label={L.weatherStyle} hint={wallpaper.effectiveStyle !== wallpaper.weatherStyle ? L.fellBack : undefined}>
            <Segmented
              value={wallpaper.weatherStyle}
              onChange={wallpaper.selectWeather}
              options={WEATHER_STYLES.map((style) => ({ value: style, label: t(locale, WEATHER_STYLE_LABEL[style]) }))}
            />
          </Field>
          <Field as="div" label={L.wallpaper} hint={sceneLabel(scene, locale)}>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={goLive}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                    wallpaper.kind === "weather" && isLive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  {L.live}
                </button>
                {WEATHER_SCENES.map((s) => (
                  <button
                    key={sceneKey(s)}
                    type="button"
                    onClick={() => selectScene(s)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                      sceneKey(s) === sceneKey(scene)
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    {sceneLabel(s, locale)}
                  </button>
                ))}
              </div>
              {WALLPAPER_CATEGORIES.map((category) => (
                <div key={category} className="flex flex-wrap gap-1">
                  {BUILT_IN_WALLPAPERS.filter((w) => w.category === category).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => selectScene({ kind: "image", id: w.id })}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors",
                        scene.kind === "image" && scene.id === w.id
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Field>
        </Section>

        <Section title={L.profile}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Readout k={L.lum} v={profile.lum.toFixed(2)} />
            <Readout k={L.contrast} v={profile.contrast.toFixed(2)} />
            <Readout k={L.zones} v={`${profile.zones.top.toFixed(2)} / ${profile.zones.mid.toFixed(2)} / ${profile.zones.bottom.toFixed(2)}`} />
            <Readout k={L.edges} v={profile.edges.toFixed(3)} />
            <Readout k={L.busyConflict} v={`${live.busy.toFixed(2)} / ${live.conflict.toFixed(2)}`} />
            <Readout k={L.chroma} v={profile.chroma.toFixed(2)} />
            <Readout
              k={L.tintRow}
              v={
                profile.tint ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block size-3 rounded-sm ring-1 ring-border"
                      style={{ background: `oklch(${profile.tint.l} ${profile.tint.c} ${profile.tint.h})` }}
                    />
                    {profile.tint.h.toFixed(0)}° · {profile.tint.c.toFixed(2)}
                  </span>
                ) : (
                  L.grey
                )
              }
            />
          </div>
        </Section>

        <Section title={L.contrastTitle}>
          <div className="space-y-1.5">
            {(
              [
                [L.contrastBare, contrast.bare],
                [L.contrastBareMid, contrast.bareMid],
                [L.contrastGlass, contrast.glass],
                [L.contrastSheet, contrast.sheet],
                [L.contrastReading, contrast.reading],
              ] as const
            ).map(([label, c]) => (
              <div key={label} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono text-muted-foreground">{label}</span>
                <span className="flex gap-1.5">
                  <ContrastBadge ratio={c.primary} />
                  <ContrastBadge ratio={c.secondary} />
                </span>
              </div>
            ))}
            <p className="text-[10px] leading-snug text-muted-foreground/70">
              {L.contrastNote}
            </p>
          </div>
        </Section>

        <Section title={L.policy}>
          {POLICY_KNOBS.filter((knob) => knob.group === "desktop").map(policyKnobRow)}
          <Field label={L.toneRange} hint={`${policy.toneSafe[theme]} → ${policy.toneWorst[theme]}`}>
            <div className="flex items-center gap-2">
              <Slider
                value={policy.toneSafe[theme]}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setPolicyOverrides((o) => ({
                    ...o,
                    toneSafe: { ...(o.toneSafe ?? DEFAULT_LEGIBILITY_POLICY.toneSafe), [theme]: v },
                  }))
                }
              />
              <Slider
                value={policy.toneWorst[theme]}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) =>
                  setPolicyOverrides((o) => ({
                    ...o,
                    toneWorst: { ...(o.toneWorst ?? DEFAULT_LEGIBILITY_POLICY.toneWorst), [theme]: v },
                  }))
                }
              />
              {pairStar(["toneSafe", "toneWorst"], `${DEFAULT_LEGIBILITY_POLICY.toneSafe[theme]} → ${DEFAULT_LEGIBILITY_POLICY.toneWorst[theme]}`)}
            </div>
            <span className="text-[10px] text-muted-foreground/60">{L.toneRangeHint(themeName(theme))}</span>
          </Field>
          <Field label={L.tintL} hint={`${policy.tintLightness[theme][0]} – ${policy.tintLightness[theme][1]}`}>
            <div className="flex items-center gap-2">
              {([0, 1] as const).map((i) => (
                <Slider
                  key={i}
                  value={policy.tintLightness[theme][i]}
                  min={0.2}
                  max={0.9}
                  step={0.01}
                  onChange={(v) =>
                    setPolicyOverrides((o) => {
                      const cur = o.tintLightness ?? DEFAULT_LEGIBILITY_POLICY.tintLightness;
                      const pair = [...cur[theme]] as [number, number];
                      pair[i] = v;
                      return { ...o, tintLightness: { ...cur, [theme]: pair } };
                    })
                  }
                />
              ))}
              {pairStar(["tintLightness"], DEFAULT_LEGIBILITY_POLICY.tintLightness[theme].join(" – "))}
            </div>
          </Field>
          <Field label={L.tintC} hint={`${policy.tintChroma[0]} – ${policy.tintChroma[1]}`}>
            <div className="flex items-center gap-2">
              {([0, 1] as const).map((i) => (
                <Slider
                  key={i}
                  value={policy.tintChroma[i]}
                  min={0}
                  max={0.3}
                  step={0.005}
                  onChange={(v) =>
                    setPolicyOverrides((o) => {
                      const pair = [...(o.tintChroma ?? DEFAULT_LEGIBILITY_POLICY.tintChroma)] as [number, number];
                      pair[i] = v;
                      return { ...o, tintChroma: pair };
                    })
                  }
                />
              ))}
              {pairStar(["tintChroma"], DEFAULT_LEGIBILITY_POLICY.tintChroma.join(" – "))}
            </div>
          </Field>
        </Section>

        <Section title={L.policyReading}>
          <Field label={L.veilBase} hint={`${policy.veilBase[theme]} (${themeName(theme)})`}>
            <div className="flex items-center gap-2">
              <Slider
                value={policy.veilBase[theme]}
                min={0}
                max={0.9}
                step={0.01}
                onChange={(v) =>
                  setPolicyOverrides((o) => ({
                    ...o,
                    veilBase: { ...(o.veilBase ?? DEFAULT_LEGIBILITY_POLICY.veilBase), [theme]: v },
                  }))
                }
              />
              {pairStar(["veilBase"], String(DEFAULT_LEGIBILITY_POLICY.veilBase[theme]))}
            </div>
            <span className="text-[10px] text-muted-foreground/60">
              {L.veilBaseHint}
              <span className="ml-1.5 font-mono text-muted-foreground/40">{L.affects} {outputName("veil")}</span>
            </span>
          </Field>
          {POLICY_KNOBS.filter((knob) => knob.group === "reading").map(policyKnobRow)}
        </Section>

        <Section title={L.resolved}>
          {(
            [
              ["flip", L.flipBare, live.flip],
              ["flipMid", L.flipMid, live.flipMid],
            ] as const
          ).map(([key, label, on]) => (
            <Field key={key} as="div" label={label} hint={on ? L.on : L.off}>
              <div className="flex items-center gap-2">
                <Segmented
                  value={on ? "on" : "off"}
                  onChange={(v) => setPins((p) => ({ ...p, [key]: v === "on" }))}
                  options={[
                    { value: "off", label: L.Off },
                    { value: "on", label: L.On },
                  ]}
                />
                <Star active={key in pins} title={L.backToPolicy} onReset={() => setPins((p) => without(p, key))} />
              </div>
            </Field>
          ))}
          {OUTPUT_KNOBS.map((knob) => {
            const value = readOutput(live, knob.key);
            const policyValue = readOutput(unpinned, knob.key);
            return (
              <Field key={knob.key} label={knobLabel(knob.key, knob.label)} hint={String(value)}>
                <div className="flex items-center gap-2">
                  <Slider
                    value={value}
                    min={knob.min}
                    max={knob.max}
                    step={knob.step}
                    onChange={(v) => setPins((p) => ({ ...p, [knob.key]: v }))}
                  />
                  <Star
                    active={knob.key in pins}
                    title={L.backToPolicyValue(policyValue)}
                    onReset={() => setPins((p) => without(p, knob.key))}
                  />
                </div>
              </Field>
            );
          })}
          <p className="text-[10px] leading-snug text-muted-foreground/60">
            {L.pinsNote}
          </p>
        </Section>

        {SHEET_GROUPS.map((group) => (
          <Section key={group.title} title={L.sheetSection(groupTitle(group.title))}>
            {group.note && (
              <p className="-mt-2 text-[10px] leading-snug text-muted-foreground/60">{groupNote(group.title, group.note)}</p>
            )}
            {group.knobs.map((knob) => {
              const overridden = knob.name in sheet;
              const value = overridden ? sheet[knob.name] : (defaults[knob.name] ?? knob.min);
              return (
                <Field key={knob.name} label={knobLabel(knob.name, knob.label)} hint={formatSheetValue(knob, value)}>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={value}
                      min={knob.min}
                      max={knob.max}
                      step={knob.step}
                      onChange={(v) => setSheet((s) => ({ ...s, [knob.name]: v }))}
                    />
                    <Star
                      active={overridden}
                      title={L.backTo(formatSheetValue(knob, defaults[knob.name] ?? 0))}
                      onReset={() => setSheet((s) => without(s, knob.name))}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/50">{knob.name}</span>
                </Field>
              );
            })}
          </Section>
        ))}

        <Section title={L.export}>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={exported} label={L.copyJson} />
            <CopyButton text={exportCss(sheet)} label={L.copyCss} />
            <button
              type="button"
              onClick={() => {
                setPolicyOverrides({});
                setPins({});
                setSheet({});
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-mono text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              {L.resetAll}
            </button>
          </div>
          <textarea
            readOnly
            value={exported}
            className="h-40 w-full rounded-md border border-border/60 bg-transparent p-2 text-[10px] font-mono text-muted-foreground outline-none"
          />
          <p className="text-[10px] leading-snug text-muted-foreground/60">
            {L.exportNote}
          </p>
        </Section>
      </aside>
    </main>
  );
}
