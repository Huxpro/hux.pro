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

import { Field, Section, Segmented, Slider } from "@/app/editor/icon/controls";
import { cn } from "@/lib/utils";
import { useGlass, useTheme } from "@/services";
import { useAmbientTime, useWallpaper, useWeather } from "@/systems/ambient";
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
import type { BlogPostSummary } from "@/lib/content";
import { useDevtool } from "@/systems/devtool";
import { Check, Copy, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GalleryTile,
  sceneKey,
  sceneLabel,
  sceneProfile,
  WEATHER_SCENES,
  type Scene,
} from "./gallery";
import {
  exportCss,
  exportJson,
  formatSheetValue,
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
  type PolicyOverrides,
  type SheetOverrides,
} from "./lab-state";
import {
  ActivitySpecimen,
  BareSpecimen,
  PaletteSpecimen,
  ReadingSpecimen,
  RealSurfacesSpecimen,
  SheetSpecimen,
  SpecimenLabel,
  WidgetSpecimen,
} from "./specimens";

// -----------------------------------------------------------------------------
// Small parts
// -----------------------------------------------------------------------------

function Star({ onReset, title }: { onReset: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onReset}
      title={title}
      aria-label={title}
      className="ink-flat ml-1 font-mono text-amber-500/90 transition-colors hover:text-amber-400"
    >
      *
    </button>
  );
}

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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {
          // Clipboard unavailable — the textarea below is selectable.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-mono text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label}
    </button>
  );
}

// -----------------------------------------------------------------------------
// The view
// -----------------------------------------------------------------------------

export function LegibilityLabView({ posts }: { posts: BlogPostSummary[] }) {
  const wallpaper = useWallpaper();
  const weather = useWeather();
  const time = useAmbientTime();
  const devtool = useDevtool();
  const { theme, preference, setThemePreference } = useTheme();
  const glass = useGlass();

  // --- Take over the app state for the visit, and give it back after -------
  const initial = useRef<{
    kind: typeof wallpaper.kind;
    id: string;
    preference: typeof preference;
    material: typeof glass.material;
    tint: typeof glass.tint;
    devtool: boolean;
    overrides: typeof wallpaper.devtoolOverrides;
  } | null>(null);
  const setters = useRef({ wallpaper, weather, time, devtool, glass, setThemePreference });
  setters.current = { wallpaper, weather, time, devtool, glass, setThemePreference };

  useEffect(() => {
    if (initial.current) return;
    const s = setters.current;
    initial.current = {
      kind: s.wallpaper.kind,
      id: s.wallpaper.wallpaper.id,
      preference,
      material: s.glass.material,
      tint: s.glass.tint,
      devtool: s.devtool.isEnabled,
      overrides: s.wallpaper.devtoolOverrides,
    };
    // The weather and phase overrides only apply with the devtool on, and the
    // stage wants the wallpaper full-page whatever the visitor's placement.
    s.devtool.setEnabled(true);
    s.wallpaper.setDevtoolOverrides({ ...s.wallpaper.devtoolOverrides, full: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    return () => {
      const s = setters.current;
      const i = initial.current;
      if (!i) return;
      s.wallpaper.setLegibilityOverride(null);
      s.weather.setOverrideEnabled(false);
      s.time.setOverrideEnabled(false);
      s.wallpaper.setDevtoolOverrides(i.overrides);
      if (i.kind === "image") s.wallpaper.selectWallpaper(i.id);
      else s.wallpaper.setKind("weather");
      s.setThemePreference(i.preference);
      s.glass.setMaterial(i.material);
      s.glass.setTint(i.tint);
      s.devtool.setEnabled(i.devtool);
      for (const knob of SHEET_KNOBS) document.documentElement.style.removeProperty(knob.name);
    };
  }, []);

  // --- Scene ---------------------------------------------------------------
  const scene: Scene = useMemo(() => {
    if (wallpaper.kind === "image") return { kind: "image", id: wallpaper.wallpaper.id };
    if (time.isOverrideEnabled && (time.overridePhase === "sunrise" || time.overridePhase === "sunset")) {
      return { kind: "sun", event: time.overridePhase };
    }
    if (weather.isOverrideEnabled && weather.debugOverride) {
      return { kind: "weather", condition: weather.debugOverride.condition, isDay: weather.debugOverride.isDay };
    }
    return {
      kind: "weather",
      condition: weather.weather?.condition ?? "clear",
      isDay: weather.weather?.isDay ?? true,
    };
  }, [wallpaper.kind, wallpaper.wallpaper.id, time.isOverrideEnabled, time.overridePhase, weather.isOverrideEnabled, weather.debugOverride, weather.weather]);

  const selectScene = useCallback(
    (next: Scene) => {
      if (next.kind === "image") {
        wallpaper.selectWallpaper(next.id);
        return;
      }
      wallpaper.setKind("weather");
      if (next.kind === "sun") {
        time.setOverridePhase(next.event);
        time.setOverrideEnabled(true);
        weather.setOverrideEnabled(false);
      } else {
        time.setOverrideEnabled(false);
        weather.setDebugOverride({ condition: next.condition, isDay: next.isDay });
        weather.setOverrideEnabled(true);
      }
    },
    [wallpaper, time, weather],
  );

  // --- Policy → provider override -----------------------------------------
  const [policyOverrides, setPolicyOverrides] = useState<PolicyOverrides>({});
  const [pins, setPins] = useState<OutputPins>({});
  const policy = useMemo(() => mergePolicy(policyOverrides), [policyOverrides]);

  const reading = wallpaper.reading;
  const shipped = useMemo(
    () => resolveForLab({ profile: wallpaper.profile, theme, reading, policy: DEFAULT_LEGIBILITY_POLICY, pins: {} }),
    [wallpaper.profile, theme, reading],
  );
  const resolved = useMemo(
    () => resolveForLab({ profile: wallpaper.profile, theme, reading, policy, pins }),
    [wallpaper.profile, theme, reading, policy, pins],
  );

  useEffect(() => {
    wallpaper.setLegibilityOverride(sameVars(resolved, shipped) ? null : resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setter is stable; `wallpaper` identity churns
  }, [resolved, shipped]);

  const live: LegibilityVars = wallpaper.legibility;

  // --- Sheet inputs → inline on <html> ------------------------------------
  const [sheet, setSheet] = useState<SheetOverrides>({});
  const [defaults, setDefaults] = useState<Record<string, number>>({});

  // Defaults come from the stylesheet itself: lift every override, read the
  // computed values, put the overrides back. Re-read whenever the theme or
  // material changes, since both redefine some of these.
  useEffect(() => {
    const root = document.documentElement;
    for (const knob of SHEET_KNOBS) root.style.removeProperty(knob.name);
    const cs = getComputedStyle(root);
    const next: Record<string, number> = {};
    for (const knob of SHEET_KNOBS) {
      const v = parseSheetValue(cs.getPropertyValue(knob.name));
      if (v !== null) next[knob.name] = v;
    }
    setDefaults(next);
    for (const knob of SHEET_KNOBS) {
      if (knob.name in sheet) root.style.setProperty(knob.name, formatSheetValue(knob, sheet[knob.name]));
    }
  }, [theme, glass.material, glass.tint, sheet]);

  // --- Readouts ------------------------------------------------------------
  const profile = wallpaper.profile;
  const veil = live.veil;
  const surface: "desktop" | "reading" = wallpaper.reading ? "reading" : "desktop";
  const setSurface = (v: "desktop" | "reading") =>
    wallpaper.setDevtoolOverrides({ ...wallpaper.devtoolOverrides, reading: v === "reading" });

  const contrast = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- the sheet overrides and material change the computed values read below
    [sheet, glass.material];
    const cs = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
    const pct = (name: string, fallback: number) =>
      (cs && parseSheetValue(cs.getPropertyValue(name))) ?? fallback;
    const secondaryAlpha = (pct("--ink-alpha-secondary", 54) + live.inkBoost) / 100;
    const glassFill = (pct("--glass-fill", 50) + pct("--glass-dark-add", 0) + live.glassAdd * pct("--glass-add-k", 0.5)) / 100;
    const sheetFill = (pct("--glass-fill-sheet", 85) + pct("--glass-dark-add", 0) + live.glassAdd * pct("--glass-add-k", 0.5)) / 100;

    const inverse: Theme = theme === "dark" ? "light" : "dark";
    const bareInk = INK_RGB[live.flip ? inverse : theme];
    // The top band, approximated by scaling the mean colour to its lightness.
    const scale = profile.lum > 0 ? profile.zones.top / profile.lum : 1;
    const top = profile.mean.map((c) => Math.min(255, Math.round(c * scale))) as [number, number, number];
    const onGlass = composite(CARD_RGB[theme], glassFill, profile.mean);
    const onSheet = composite(CARD_RGB[theme], sheetFill, profile.mean);
    const onVeil = composite(BACKGROUND_RGB[theme], Math.min(0.85, veil), profile.mean);
    const ink = INK_RGB[theme];
    const row = (bg: [number, number, number], text: [number, number, number]) => ({
      primary: contrastRatio(text, bg),
      secondary: contrastRatio(composite(text, secondaryAlpha, bg), bg),
    });
    return {
      bare: row(top, bareInk),
      glass: row(onGlass, ink),
      sheet: row(onSheet, ink),
      reading: row(onVeil, composite(ink, 0.85, onVeil)),
    };
  }, [profile, theme, live, veil, sheet, glass.material]);

  // --- Gallery ---------------------------------------------------------------
  const [galleryCategory, setGalleryCategory] = useState<"weather" | "apple" | "nature">("apple");
  const galleryScenes: Scene[] = useMemo(() => {
    if (galleryCategory === "weather") return WEATHER_SCENES;
    return BUILT_IN_WALLPAPERS.filter((w) => w.category === galleryCategory).map((w) => ({ kind: "image", id: w.id }));
  }, [galleryCategory]);

  const exported = useMemo(
    () =>
      exportJson({
        policy: policyOverrides,
        pins,
        sheet,
        resolved: live,
        wallpaper: sceneLabel(scene),
        theme,
        material: glass.material,
        tint: glass.tint,
      }),
    [policyOverrides, pins, sheet, live, scene, theme, glass.material, glass.tint],
  );

  const dirty =
    Object.keys(policyOverrides).length + Object.keys(pins).length + Object.keys(sheet).length;

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
            <h1 className="mt-1 font-serif text-2xl tracking-tight text-foreground">legibility lab</h1>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {sceneLabel(scene)} · {theme} · {glass.material} · {glass.tint} · {surface}
            {live.flip && " · flipped"}
            {dirty > 0 && <span className="ml-2 text-amber-500/90">{dirty} live change{dirty > 1 && "s"}</span>}
          </div>
        </header>

        <section>
          <SpecimenLabel>bare — text with nothing behind it but the wallpaper</SpecimenLabel>
          <BareSpecimen />
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <SpecimenLabel>widget — bg-glass</SpecimenLabel>
            <WidgetSpecimen />
          </div>
          <div>
            <SpecimenLabel>live activity — bg-glass, pill and panel</SpecimenLabel>
            <ActivitySpecimen />
          </div>
          <div>
            <SpecimenLabel>command palette — bg-glass-popover</SpecimenLabel>
            <PaletteSpecimen />
          </div>
          <div>
            <SpecimenLabel>secondary surface — bg-glass-sheet</SpecimenLabel>
            <SheetSpecimen />
          </div>
        </section>

        <section>
          <SpecimenLabel>
            {surface === "reading"
              ? `reading page — the real treatment: veil ${veil.toFixed(2)} over a ${live.blur}px defocus (Surface: Reading)`
              : "reading page — switch Surface to Reading in the panel to see the veil and defocus applied to this whole page"}
          </SpecimenLabel>
          <ReadingSpecimen />
        </section>

        <section>
          <SpecimenLabel>the real surfaces — production widgets, as the home screen renders them</SpecimenLabel>
          <RealSurfacesSpecimen posts={posts} />
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <SpecimenLabel>gallery — every wallpaper under its own resolved policy</SpecimenLabel>
            <div className="w-64">
              <Segmented
                value={galleryCategory}
                onChange={setGalleryCategory}
                options={[
                  { value: "weather", label: "Weather" },
                  { value: "apple", label: "Apple" },
                  { value: "nature", label: "Nature" },
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {galleryScenes.map((s) => {
              const p = sceneProfile(s, theme);
              if (!p) return null;
              const vars = resolveForLab({ profile: p, theme, reading: false, policy, pins: {} });
              return (
                <GalleryTile
                  key={sceneKey(s)}
                  scene={s}
                  theme={theme}
                  vars={vars}
                  selected={sceneKey(s) === sceneKey(scene)}
                  onSelect={() => selectScene(s)}
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
        <Section title="Scene">
          <Field label="Theme">
            <Segmented
              value={theme}
              onChange={(v) => setThemePreference(v)}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </Field>
          <Field label="Material">
            <Segmented
              value={glass.material}
              onChange={glass.setMaterial}
              options={[
                { value: "tinted", label: "Tinted" },
                { value: "clear", label: "Clear" },
              ]}
            />
          </Field>
          <Field label="Tint">
            <Segmented
              value={glass.tint}
              onChange={glass.setTint}
              options={[
                { value: "neutral", label: "Neutral" },
                { value: "wallpaper", label: "Wallpaper" },
              ]}
            />
          </Field>
          <Field label="Surface">
            <Segmented
              value={surface}
              onChange={setSurface}
              options={[
                { value: "desktop", label: "Desktop" },
                { value: "reading", label: "Reading" },
              ]}
            />
            <span className="text-[10px] text-muted-foreground/60">
              Reading applies the veil and defocus to this page, as /writing and /works get them. Bare text never flips there.
            </span>
          </Field>
          <Field label="Wallpaper" hint={sceneLabel(scene)}>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
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
                    {sceneLabel(s)}
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

        <Section title="Profile — measured once, committed">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <Readout k="lum" v={profile.lum.toFixed(2)} />
            <Readout k="contrast" v={profile.contrast.toFixed(2)} />
            <Readout k="top / mid / bot" v={`${profile.zones.top.toFixed(2)} / ${profile.zones.mid.toFixed(2)} / ${profile.zones.bottom.toFixed(2)}`} />
            <Readout k="edges" v={profile.edges.toFixed(3)} />
            <Readout k="busy / conflict" v={`${live.busy.toFixed(2)} / ${live.conflict.toFixed(2)}`} />
            <Readout k="chroma" v={profile.chroma.toFixed(2)} />
            <Readout
              k="tint"
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
                  "grey"
                )
              }
            />
          </div>
        </Section>

        <Section title="Contrast — estimate from the profile">
          <div className="space-y-1.5">
            {(
              [
                ["bare · top band", contrast.bare],
                ["glass · bg-glass", contrast.glass],
                ["sheet · bg-glass-sheet", contrast.sheet],
                ["reading · veil", contrast.reading],
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
              Primary, then secondary ink, against the mean colour composited under each surface. WCAG ratios; AA·L is large text.
            </p>
          </div>
        </Section>

        <Section title="Policy — profile → variables">
          {POLICY_KNOBS.map((knob) => {
            const value = policy[knob.key] as number;
            const overridden = knob.key in policyOverrides;
            return (
              <Field
                key={knob.key}
                label={knob.label}
                hint={`${value}${overridden ? "" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <Slider
                    value={value}
                    min={knob.min}
                    max={knob.max}
                    step={knob.step}
                    onChange={(v) => setPolicyOverrides((o) => ({ ...o, [knob.key]: v }))}
                  />
                  {overridden ? (
                    <Star
                      title={`Back to ${DEFAULT_LEGIBILITY_POLICY[knob.key] as number}`}
                      onReset={() =>
                        setPolicyOverrides((o) => {
                          const next = { ...o };
                          delete next[knob.key];
                          return next;
                        })
                      }
                    />
                  ) : (
                    <span className="w-2.5" />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/60">{knob.hint}</span>
              </Field>
            );
          })}
          <Field label="Tone safe → worst" hint={`${policy.toneSafe[theme]} → ${policy.toneWorst[theme]}`}>
            <div className="flex gap-2">
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
            </div>
            <span className="text-[10px] text-muted-foreground/60">picture lightness where the card-colour conflict is nil → total ({theme})</span>
          </Field>
          <Field label="Veil base" hint={`${policy.veilBase[theme]} (${theme})`}>
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
            <span className="text-[10px] text-muted-foreground/60">reading veil alpha on a calm picture, per theme</span>
          </Field>
          <Field label="Tint L range" hint={`${policy.tintLightness[theme][0]} – ${policy.tintLightness[theme][1]}`}>
            <div className="flex gap-2">
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
            </div>
          </Field>
          <Field label="Tint C range" hint={`${policy.tintChroma[0]} – ${policy.tintChroma[1]}`}>
            <div className="flex gap-2">
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
            </div>
          </Field>
        </Section>

        <Section title="Resolved — the variables on <html>">
          <Field label="Flip bare ink" hint={live.flip ? "on" : "off"}>
            <div className="flex items-center gap-2">
              <Segmented
                value={live.flip ? "on" : "off"}
                onChange={(v) => setPins((p) => ({ ...p, flip: v === "on" }))}
                options={[
                  { value: "off", label: "Off" },
                  { value: "on", label: "On" },
                ]}
              />
              {"flip" in pins ? (
                <Star
                  title="Back to the policy"
                  onReset={() =>
                    setPins((p) => {
                      const next = { ...p };
                      delete next.flip;
                      return next;
                    })
                  }
                />
              ) : (
                <span className="w-2.5" />
              )}
            </div>
          </Field>
          {OUTPUT_KNOBS.map((knob) => {
            const value = readOutput(live, knob.key);
            const policyValue = readOutput(
              resolveForLab({ profile, theme, reading, policy, pins: {} }),
              knob.key,
            );
            const pinned = knob.key in pins;
            return (
              <Field key={knob.key} label={knob.label} hint={String(value)}>
                <div className="flex items-center gap-2">
                  <Slider
                    value={value}
                    min={knob.min}
                    max={knob.max}
                    step={knob.step}
                    onChange={(v) => setPins((p) => ({ ...p, [knob.key]: v }))}
                  />
                  {pinned ? (
                    <Star
                      title={`Back to the policy (${policyValue})`}
                      onReset={() =>
                        setPins((p) => {
                          const next = { ...p };
                          delete next[knob.key];
                          return next;
                        })
                      }
                    />
                  ) : (
                    <span className="w-2.5" />
                  )}
                </div>
              </Field>
            );
          })}
          <p className="text-[10px] leading-snug text-muted-foreground/60">
            Pinning a value overrides the policy for this scene only. The gallery always shows the policy.
          </p>
        </Section>

        {SHEET_GROUPS.map((group) => (
          <Section key={group.title} title={`Sheet — ${group.title}`}>
            {group.note && (
              <p className="-mt-2 text-[10px] leading-snug text-muted-foreground/60">{group.note}</p>
            )}
            {group.knobs.map((knob) => {
              const overridden = knob.name in sheet;
              const value = overridden ? sheet[knob.name] : (defaults[knob.name] ?? knob.min);
              return (
                <Field key={knob.name} label={knob.label} hint={formatSheetValue(knob, value)}>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={value}
                      min={knob.min}
                      max={knob.max}
                      step={knob.step}
                      onChange={(v) => setSheet((s) => ({ ...s, [knob.name]: v }))}
                    />
                    {overridden ? (
                      <Star
                        title={`Back to ${formatSheetValue(knob, defaults[knob.name] ?? 0)}`}
                        onReset={() =>
                          setSheet((s) => {
                            const next = { ...s };
                            delete next[knob.name];
                            return next;
                          })
                        }
                      />
                    ) : (
                      <span className="w-2.5" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/50">{knob.name}</span>
                </Field>
              );
            })}
          </Section>
        ))}

        <Section title="Export">
          <div className="flex flex-wrap gap-2">
            <CopyButton text={exported} label="Copy JSON" />
            <CopyButton text={exportCss(sheet)} label="Copy CSS overrides" />
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
              Reset all
            </button>
          </div>
          <textarea
            readOnly
            value={exported}
            className="h-40 w-full rounded-md border border-border/60 bg-transparent p-2 text-[10px] font-mono text-muted-foreground outline-none"
          />
          <p className="text-[10px] leading-snug text-muted-foreground/60">
            Policy values go in <code>DEFAULT_LEGIBILITY_POLICY</code> (legibility.ts); sheet values in the <code>:root</code> inputs of globals.css. Nothing here persists.
          </p>
        </Section>
      </aside>
    </main>
  );
}
