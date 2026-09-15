"use client";

/**
 * The Sky Engine Lab's panels — one section per area of the world model.
 *
 * Every lever writes a field of the live `SkyConfig`; nothing here knows how a
 * sky is derived or drawn. The `field` helper turns a dotted path into the
 * props a `NumberRow` wants (value, the committed default, a setter), which is
 * what keeps a hundred-odd levers to one line each and gives every one of them
 * the "back to the default" dot for free.
 */

import { useMemo, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import {
  Chip,
  Field,
  Note,
  NumberRow,
  Panel,
  Readout,
  Segmented,
  TextField,
  Toggle,
} from "../controls";
import type {
  SkyConfig,
  SkyPreset,
  ConditionProfileConfig,
} from "@/systems/ambient/lib/sky-config";
import { SKY_CONDITIONS } from "@/systems/ambient/lib/sky-config";
import {
  rgbToCss,
  sampleSky,
  resolveSkyConfig,
  type SceneOverrides,
} from "@/systems/ambient/lib/scene";
import type { NormalizedWeather, WeatherCondition } from "@/systems/ambient/lib/weather";
import {
  deg,
  OBSERVER_PRESETS,
  SCENARIOS,
  type Observer,
  type Scenario,
} from "./model";
import { useSkyText, type SkyStrings } from "./i18n";

// -----------------------------------------------------------------------------
// Path-addressed editing
// -----------------------------------------------------------------------------

type Path = (string | number)[];

function getIn(source: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (value, key) =>
      value === null || value === undefined
        ? undefined
        : (value as Record<string | number, unknown>)[key],
    source
  );
}

/** A structural clone along `path` only — everything else keeps its identity,
 *  which is what lets `resolveSkyConfig`'s cache stay useful between edits. */
export function setIn<T>(source: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  if (Array.isArray(source)) {
    const copy = source.slice();
    copy[head as number] = setIn(copy[head as number], rest, value);
    return copy as unknown as T;
  }
  const record = source as Record<string, unknown>;
  return {
    ...record,
    [head]: setIn(record[head as string], rest, value),
  } as unknown as T;
}

export interface PanelContext {
  config: SkyConfig;
  /** The committed config — what a lever's `*` resets to. */
  defaults: SkyConfig;
  update: (path: Path, value: unknown) => void;
  /** The lab's copy in the reader's language (see `i18n.ts`). */
  L: SkyStrings;
}

type NumberProps = { value: number; defaultValue: number; onChange: (v: number) => void };

function numberField(ctx: PanelContext, path: string): NumberProps {
  const keys = path.split(".").map((k) => (/^\d+$/.test(k) ? Number(k) : k));
  return {
    value: getIn(ctx.config, keys) as number,
    defaultValue: getIn(ctx.defaults, keys) as number,
    onChange: (v) => ctx.update(keys, v),
  };
}

function colorField(ctx: PanelContext, path: string) {
  const keys = path.split(".").map((k) => (/^\d+$/.test(k) ? Number(k) : k));
  return {
    value: getIn(ctx.config, keys) as string,
    onChange: (v: string) => ctx.update(keys, v),
  };
}

/** Resolve a dictionary key the data carries (scenario, reference row). */
export function text(L: SkyStrings, key: string): string {
  const value = (L as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : key;
}

const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => v.toFixed(3);
const degrees = (v: number) => `${v.toFixed(1)}°`;

// -----------------------------------------------------------------------------
// Small shared bits
// -----------------------------------------------------------------------------

/** A colour, as a swatch you can click. Compact enough for a table cell. */
function ColorCell({
  value,
  onChange,
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  title: string;
}) {
  return (
    <input
      type="color"
      value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
      onChange={(e) => onChange(e.target.value)}
      title={`${title} · ${value}`}
      aria-label={title}
      className="h-5 w-full cursor-pointer rounded border border-border/60 bg-transparent p-0"
    />
  );
}

/** A smoothstep gate: the two elevations (or fractions) it ramps between. */
function GateRow({
  ctx,
  label,
  path,
  min,
  max,
  step,
  format = f2,
  hint,
}: {
  ctx: PanelContext;
  label: string;
  path: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-foreground">{label}</span>
        {hint && (
          <span className="font-mono text-[10px] text-tertiary-foreground">{hint}</span>
        )}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <NumberRow label={ctx.L.gateFrom} min={min} max={max} step={step} format={format} {...numberField(ctx, `${path}.from`)} />
        <NumberRow label={ctx.L.gateTo} min={min} max={max} step={step} format={format} {...numberField(ctx, `${path}.to`)} />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Presets
// -----------------------------------------------------------------------------

export function PresetPanel({
  presets,
  editingId,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onMakeActive,
}: {
  presets: SkyPreset[];
  editingId: string;
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onMakeActive: (id: string) => void;
}) {
  const { L } = useSkyText();
  const [name, setName] = useState("");
  return (
    <Panel title={L.presets} hint={L.editingPreset(editingId)} defaultOpen>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <Chip
            key={p.id}
            active={p.id === editingId}
            onClick={() => onSelect(p.id)}
            title={p.id === activeId ? L.thePresetTheSitePaints : p.id}
          >
            {p.name}
            {p.id === activeId && <span className="ml-1 text-[9px] opacity-70">●</span>}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <TextField value={name} onChange={setName} placeholder={L.newPresetName} />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            onCreate(name.trim());
            setName("");
          }}
          title={L.addTitle}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-border/60 px-2 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
          {L.add}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={editingId === activeId}
          onClick={() => onMakeActive(editingId)}
          title={L.makeActiveTitle}
        >
          {editingId === activeId ? L.activeOnSite : L.makeActive}
        </Chip>
        {editingId !== "default" && (
          <button
            type="button"
            onClick={() => onDelete(editingId)}
            className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-amber-500/40 hover:text-amber-500"
          >
            <Trash2 className="h-3 w-3" />
            {L.deletePreset}
          </button>
        )}
      </div>
      <Note>{L.presetsNote}</Note>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Observer
// -----------------------------------------------------------------------------

export function ObserverPanel({
  observer,
  onChange,
  resolved,
  hemisphere,
  onScenario,
}: {
  observer: Observer;
  onChange: (observer: Observer) => void;
  resolved: Observer | null;
  hemisphere: 1 | -1;
  onScenario: (scenario: Scenario) => void;
}) {
  const { L } = useSkyText();
  return (
    <Panel
      title={L.observer}
      hint={`${observer.lat.toFixed(2)}, ${observer.lon.toFixed(2)}`}
      defaultOpen
    >
      <div className="flex flex-wrap gap-1">
        {resolved && (
          <Chip
            active={observer.label === resolved.label}
            onClick={() => onChange(resolved)}
            title={L.resolvedTitle}
          >
            <MapPin className="mr-1 inline h-2.5 w-2.5" />
            {resolved.label}
          </Chip>
        )}
        {OBSERVER_PRESETS.map((o) => (
          <Chip
            key={o.key}
            active={observer.label === L[o.key]}
            onClick={() => onChange({ label: L[o.key], lat: o.lat, lon: o.lon })}
          >
            {L[o.key]}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberRow
          label={L.latitude}
          value={observer.lat}
          min={-90}
          max={90}
          step={0.5}
          format={degrees}
          onChange={(lat) => onChange({ ...observer, label: L.observerCustom, lat })}
        />
        <NumberRow
          label={L.longitude}
          value={observer.lon}
          min={-180}
          max={180}
          step={0.5}
          format={degrees}
          onChange={(lon) => onChange({ ...observer, label: L.observerCustom, lon })}
        />
      </div>

      <Toggle
        label={L.southernHemisphere(hemisphere === -1 ? L.mirrored : L.north)}
        value={hemisphere === -1}
        onChange={(south) =>
          onChange({
            ...observer,
            label: L.observerCustom,
            lat: south ? -Math.abs(observer.lat) : Math.abs(observer.lat),
          })
        }
      />
      <Note>{L.hemisphereNote}</Note>
      <Note>{L.timezoneNote}</Note>

      <div className="flex flex-col gap-1 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.namedSkies}
        </span>
        <div className="flex flex-wrap gap-1">
          {SCENARIOS.map((scenario) => (
            <Chip
              key={scenario.id}
              onClick={() => onScenario(scenario)}
              title={text(L, scenario.whyKey)}
            >
              {text(L, scenario.labelKey)}
            </Chip>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Sun
// -----------------------------------------------------------------------------

/** The clear-sky ramp, sampled the way `sampleSky` samples it. */
function SkyRamp({ config, L }: { config: SkyConfig; L: SkyStrings }) {
  const gradient = useMemo(() => {
    const keys = resolveSkyConfig(config).keys;
    const from = keys[0].el;
    const to = keys[keys.length - 1].el;
    const stops: string[] = [];
    for (let i = 0; i <= 48; i++) {
      const el = from + ((to - from) * i) / 48;
      const s = sampleSky(el, keys);
      stops.push(`${rgbToCss(s.horizon)} ${((i / 48) * 100).toFixed(1)}%`);
    }
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }, [config]);
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-6 rounded ring-1 ring-border/50"
        style={{ backgroundImage: gradient }}
        title={L.rampTitle}
      />
      <div className="flex justify-between font-mono text-[9px] text-tertiary-foreground">
        <span>{deg(config.sun.keys[0].el, 0)}</span>
        <span>{L.rampCaption}</span>
        <span>{deg(config.sun.keys[config.sun.keys.length - 1].el, 0)}</span>
      </div>
    </div>
  );
}

export function SunPanel({ ctx }: { ctx: PanelContext }) {
  const { L } = ctx;
  const keys = ctx.config.sun.keys;
  return (
    <Panel title={L.sunPanel} hint={L.keyframeCount(keys.length)} defaultOpen>
      <SkyRamp config={ctx.config} L={L} />

      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[2.6rem_1fr_1fr_1fr_2.4rem] items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-tertiary-foreground">
          <span>{L.colEl}</span>
          <span className="text-center">{L.colZenith}</span>
          <span className="text-center">{L.colHorizon}</span>
          <span className="text-center">{L.colGlow}</span>
          <span className="text-right">{L.colStrength}</span>
        </div>
        {keys.map((key, i) => (
          <div
            key={i}
            className="grid grid-cols-[2.6rem_1fr_1fr_1fr_2.4rem] items-center gap-1"
          >
            <input
              type="number"
              value={key.el}
              step={1}
              onChange={(e) => ctx.update(["sun", "keys", i, "el"], Number(e.target.value))}
              aria-label={L.keyElevation(i + 1)}
              className="w-full rounded border border-border/60 bg-transparent px-1 py-0.5 font-mono text-[10px] tabular-nums outline-none focus:border-foreground/40"
            />
            <ColorCell {...colorField(ctx, `sun.keys.${i}.zenith`)} title={L.keyZenith(deg(key.el, 0))} />
            <ColorCell {...colorField(ctx, `sun.keys.${i}.horizon`)} title={L.keyHorizon(deg(key.el, 0))} />
            <ColorCell {...colorField(ctx, `sun.keys.${i}.glow`)} title={L.keyGlow(deg(key.el, 0))} />
            <input
              type="number"
              value={key.strength}
              step={0.01}
              min={0}
              max={4}
              onChange={(e) =>
                ctx.update(["sun", "keys", i, "strength"], Number(e.target.value))
              }
              aria-label={L.keyStrength(i + 1)}
              className="w-full rounded border border-border/60 bg-transparent px-1 py-0.5 text-right font-mono text-[10px] tabular-nums outline-none focus:border-foreground/40"
            />
          </div>
        ))}
        <Note>{L.keysNote}</Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <NumberRow label={L.dayThreshold} min={-18} max={18} step={0.1} format={degrees} {...numberField(ctx, "sun.dayElevationDeg")} />
        <NumberRow label={L.twilightFloor} min={-40} max={0} step={0.5} format={degrees} {...numberField(ctx, "sun.twilightFloorDeg")} />
        <NumberRow label={L.twilightCeiling} min={0} max={40} step={0.5} format={degrees} {...numberField(ctx, "sun.twilightCeilDeg")} />
        <Note>{L.thresholdNote}</Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <NumberRow label={L.discSize} min={0} max={0.12} step={0.001} format={f3} {...numberField(ctx, "sun.discSize")} />
        <NumberRow label={L.glowRadiusHigh} min={0.05} max={2} step={0.01} format={f2} {...numberField(ctx, "sun.glowRadiusHigh")} />
        <NumberRow label={L.glowRadiusLow} min={0.05} max={3} step={0.01} format={f2} {...numberField(ctx, "sun.glowRadiusLow")} />
        <NumberRow label={L.glowGain} min={0} max={3} step={0.01} format={f2} {...numberField(ctx, "sun.glowGain")} />
        <NumberRow label={L.horizonBand} min={0} max={2} step={0.01} format={f2} {...numberField(ctx, "sun.horizonBand")} />
        <NumberRow label={L.coverFade} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "sun.coverFade")} />
      </div>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Moon
// -----------------------------------------------------------------------------

export function MoonPanel({ ctx }: { ctx: PanelContext }) {
  const { L } = ctx;
  return (
    <Panel title={L.moonPanel} hint={L.moonDiscHint(f3(ctx.config.moon.discSize))}>
      <NumberRow label={L.discSize} min={0.005} max={0.12} step={0.001} format={f3} {...numberField(ctx, "moon.discSize")} />
      <NumberRow label={L.moonIllusion} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.illusionScale")} />
      <NumberRow label={L.illusionFade} min={5} max={90} step={1} format={degrees} {...numberField(ctx, "moon.illusionFadeDeg")} />
      <NumberRow label={L.halo} min={0} max={0.5} step={0.005} format={f3} {...numberField(ctx, "moon.haloStrength")} />
      <NumberRow label={L.earthshine} min={0} max={0.3} step={0.005} format={f3} {...numberField(ctx, "moon.earthshine")} />
      <NumberRow label={L.terminator} min={0.01} max={0.6} step={0.005} format={f3} {...numberField(ctx, "moon.terminatorSoftness")} />
      <Note>{L.moonDiscNote}</Note>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.theThreeGates}
        </span>
        <GateRow ctx={ctx} label={L.gateUpRow} path="moon.up" min={-30} max={30} step={0.5} format={degrees} />
        <GateRow ctx={ctx} label={L.gateSkyDarkRow} path="moon.skyDark" min={-30} max={30} step={0.5} format={degrees} />
        <GateRow ctx={ctx} label={L.gateCoverRow} path="moon.cover" min={0} max={1} step={0.01} />
        <NumberRow label={L.fogHidesIt} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.fogGate")} />
        <Note>{L.gatesNote}</Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.daytimeMoonGroup}
        </span>
        <GateRow ctx={ctx} label={L.gateElevation} path="moon.day.elevation" min={0} max={60} step={1} format={degrees} />
        <GateRow ctx={ctx} label={L.gateElongation} path="moon.day.elongation" min={0} max={180} step={1} format={degrees} />
        <NumberRow label={L.daytimeStrength} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.day.strength")} />
        <Note>{L.daytimeNote}</Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.moonlight}
        </span>
        <GateRow ctx={ctx} label={L.moonlightRise} path="moon.light.rise" min={-10} max={60} step={1} format={degrees} />
        <div className="grid grid-cols-[1.6rem_1fr] items-center gap-2">
          <ColorCell {...colorField(ctx, "moon.light.zenithColor")} title={L.moonlitZenith} />
          <NumberRow label={L.liftsZenith} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.light.zenithAmount")} />
          <ColorCell {...colorField(ctx, "moon.light.horizonColor")} title={L.moonlitHorizon} />
          <NumberRow label={L.liftsHorizon} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.light.horizonAmount")} />
          <ColorCell {...colorField(ctx, "moon.light.cloudColor")} title={L.moonlitClouds} />
          <NumberRow label={L.liftsClouds} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.light.cloudAmount")} />
        </div>
        <NumberRow label={L.starWash} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.light.starWash")} />
      </div>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Stars
// -----------------------------------------------------------------------------

export function StarsPanel({ ctx }: { ctx: PanelContext }) {
  const { L } = ctx;
  return (
    <Panel title={L.starsPanel} hint={L.starsDensityHint(f2(ctx.config.stars.density))}>
      <NumberRow label={L.density} min={0} max={3} step={0.05} format={f2} {...numberField(ctx, "stars.density")} />
      <NumberRow label={L.twinkle} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "stars.twinkle")} />
      <GateRow
        ctx={ctx}
        label={L.nightGate}
        path="stars.night"
        min={-30}
        max={20}
        step={0.5}
        format={degrees}
        hint={L.nightGateHint}
      />
      <GateRow ctx={ctx} label={L.gateCoverRow} path="stars.cover" min={0} max={1} step={0.01} />
      <Note>{L.starsNote}</Note>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Weather
// -----------------------------------------------------------------------------

const PROFILE_FIELDS: {
  key: keyof ConditionProfileConfig;
  /** Dictionary key for the row's label. */
  labelKey: keyof SkyStrings;
  max: number;
}[] = [
  { key: "cover", labelKey: "pCover", max: 1 },
  { key: "coverMin", labelKey: "pCoverMin", max: 1 },
  { key: "density", labelKey: "pDensity", max: 1 },
  { key: "darkness", labelKey: "pDarkness", max: 1 },
  { key: "precip", labelKey: "pPrecip", max: 1 },
  { key: "fog", labelKey: "pFog", max: 1 },
  { key: "tintAmount", labelKey: "pTintAmount", max: 1 },
];

export function WeatherPanel({
  ctx,
  condition,
  forced,
  onForce,
  overrides,
  onOverrides,
  weather,
  cover,
  precipitation,
}: {
  ctx: PanelContext;
  condition: WeatherCondition;
  forced: WeatherCondition | null;
  onForce: (condition: WeatherCondition | null) => void;
  overrides: SceneOverrides;
  onOverrides: (overrides: SceneOverrides) => void;
  weather: NormalizedWeather | null;
  cover: number;
  precipitation: number;
}) {
  const { L, conditionName } = useSkyText();
  const p = `clouds.profiles.${condition}`;
  const setOverride = (patch: SceneOverrides) => onOverrides({ ...overrides, ...patch });
  return (
    <Panel title={L.weather} hint={conditionName(condition)} defaultOpen>
      <Field label={L.condition}>
        <div className="flex flex-wrap gap-1">
          <Chip active={forced === null} onClick={() => onForce(null)} title={L.asReportedTitle}>
            {L.asReported}
          </Chip>
          {SKY_CONDITIONS.map((c) => (
            <Chip key={c} active={forced === c} onClick={() => onForce(c)}>
              {conditionName(c)}
            </Chip>
          ))}
        </div>
      </Field>

      <NumberRow
        label={L.cloudCover}
        value={overrides.cloudCover ?? cover}
        defaultValue={cover}
        min={0}
        max={1}
        step={0.01}
        format={f2}
        onChange={(v) => setOverride({ cloudCover: v })}
      />
      <NumberRow
        label={L.precipitation}
        value={overrides.precipitationIntensity ?? precipitation}
        defaultValue={precipitation}
        min={0}
        max={1}
        step={0.01}
        format={f2}
        onChange={(v) => setOverride({ precipitationIntensity: v })}
      />
      <NumberRow
        label={L.wind}
        value={overrides.windSpeedKmh ?? weather?.windSpeedKmh ?? ctx.config.clouds.defaultWindKmh}
        defaultValue={weather?.windSpeedKmh ?? ctx.config.clouds.defaultWindKmh}
        min={0}
        max={80}
        step={1}
        format={(v) => `${Math.round(v)} km/h`}
        onChange={(v) => setOverride({ windSpeedKmh: v })}
      />
      <div className="flex justify-end">
        <Chip onClick={() => onOverrides({})} title={L.clearTweaksTitle}>
          {L.clearTweaks}
        </Chip>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.profileFor(conditionName(condition))}
        </span>
        {PROFILE_FIELDS.map((row) => (
          <NumberRow
            key={row.key}
            label={L[row.labelKey] as string}
            min={0}
            max={row.max}
            step={0.01}
            format={f2}
            {...numberField(ctx, `${p}.${String(row.key)}`)}
          />
        ))}
        <div className="grid grid-cols-[1fr_1.6rem_1.6rem] items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>{L.dayTintRow}</span>
          <ColorCell {...colorField(ctx, `${p}.tintDay.zenith`)} title={L.dayZenithTint} />
          <ColorCell {...colorField(ctx, `${p}.tintDay.horizon`)} title={L.dayHorizonTint} />
          <span>{L.nightTintRow}</span>
          <ColorCell {...colorField(ctx, `${p}.tintNight.zenith`)} title={L.nightZenithTint} />
          <ColorCell {...colorField(ctx, `${p}.tintNight.horizon`)} title={L.nightHorizonTint} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.howCoverBehaves}
        </span>
        <GateRow ctx={ctx} label={L.tintCover} path="clouds.tintCover" min={0} max={1} step={0.01} />
        <NumberRow label={L.horizonTintRatio} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "clouds.horizonTintRatio")} />
        <NumberRow label={L.darknessFromPrecip} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "clouds.darknessFromPrecip")} />
        <NumberRow label={L.darknessFromCover} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "clouds.darknessFromCover")} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.windAndDrift}
        </span>
        <NumberRow label={L.fullDriftAt} min={5} max={150} step={1} format={(v) => `${Math.round(v)} km/h`} {...numberField(ctx, "clouds.windScaleKmh")} />
        <NumberRow label={L.assumedWind} min={0} max={60} step={1} format={(v) => `${Math.round(v)} km/h`} {...numberField(ctx, "clouds.defaultWindKmh")} />
        <NumberRow label={L.driftAtZeroWind} min={0} max={2} step={0.01} format={f2} {...numberField(ctx, "clouds.speedBase")} />
        <NumberRow label={L.driftFromWind} min={0} max={4} step={0.01} format={f2} {...numberField(ctx, "clouds.speedGain")} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.cloudLighting}
        </span>
        <div className="grid grid-cols-[1fr_1.6rem_1.6rem] items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>{L.litTopsRow}</span>
          <ColorCell {...colorField(ctx, "clouds.lighting.litDay")} title={L.litTopsDay} />
          <ColorCell {...colorField(ctx, "clouds.lighting.litNight")} title={L.litTopsNight} />
          <span>{L.shadeDayRow}</span>
          <ColorCell {...colorField(ctx, "clouds.lighting.shadeDay")} title={L.shadeDayCalm} />
          <ColorCell {...colorField(ctx, "clouds.lighting.shadeDayStorm")} title={L.shadeDayStorm} />
          <span>{L.shadeNightRow}</span>
          <ColorCell {...colorField(ctx, "clouds.lighting.shadeNight")} title={L.shadeNightCalm} />
          <ColorCell {...colorField(ctx, "clouds.lighting.shadeNightStorm")} title={L.shadeNightStorm} />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.veilPerTheme}
        </span>
        {(["light", "dark"] as const).map((theme) => (
          <div key={theme} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ColorCell
                {...colorField(ctx, `veil.${theme}.color`)}
                title={L.veilColorTitle(theme === "dark" ? L.dark : L.light)}
              />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {theme === "dark" ? L.dark : L.light}
              </span>
            </div>
            <NumberRow label={L.amount} min={0} max={1} step={0.01} format={f2} {...numberField(ctx, `veil.${theme}.amount`)} />
            <NumberRow label={L.exposure} min={0.4} max={1.6} step={0.01} format={f2} {...numberField(ctx, `veil.${theme}.exposure`)} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.apiReadout}
        </span>
        {weather ? (
          <>
            <Readout label={L.rowCode} value={String(weather.weatherCode)} />
            <Readout label={L.rowCondition} value={conditionName(weather.condition)} />
            <Readout
              label={L.rowCloud}
              value={weather.cloudCover === undefined ? "—" : `${Math.round(weather.cloudCover * 100)}%`}
            />
            <Readout
              label={L.rowPrecip}
              value={weather.precipitationMmH === undefined ? "—" : `${weather.precipitationMmH} mm/h`}
            />
            <Readout
              label={L.rowWind}
              value={
                weather.windSpeedKmh === undefined
                  ? "—"
                  : `${Math.round(weather.windSpeedKmh)} km/h @ ${Math.round(weather.windDirectionDeg ?? 0)}°`
              }
            />
            <Readout
              label={L.rowHumidity}
              value={weather.humidity === undefined ? "—" : `${Math.round(weather.humidity * 100)}%`}
            />
          </>
        ) : (
          <Note>{L.noLiveWeather}</Note>
        )}
      </div>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Camera & staging
// -----------------------------------------------------------------------------

export function StagingPanel({
  ctx,
  portrait,
  onPortrait,
}: {
  ctx: PanelContext;
  portrait: boolean;
  onPortrait: (portrait: boolean) => void;
}) {
  const { L } = ctx;
  return (
    <Panel title={L.stagingPanel} hint={L.stagingHint(f2(ctx.config.staging.horizonY))}>
      <Segmented
        value={portrait ? "portrait" : "landscape"}
        onChange={(v) => onPortrait(v === "portrait")}
        options={[
          { value: "landscape", label: L.landscape },
          { value: "portrait", label: L.portrait },
        ]}
      />
      <Note>{L.orientationNote}</Note>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.theFrame}
        </span>
        <NumberRow label={L.horizonY} min={-0.2} max={0.6} step={0.005} format={f3} {...numberField(ctx, "staging.horizonY")} />
        <NumberRow label={L.sunArc} min={0} max={1.5} step={0.01} format={f2} {...numberField(ctx, "staging.sunArc")} />
        <NumberRow label={L.azimuthSpan} min={0.2} max={1.4} step={0.01} format={f2} {...numberField(ctx, "staging.azimuthSpan")} />
        <NumberRow label={L.azimuthMargin} min={-0.3} max={0.4} step={0.01} format={f2} {...numberField(ctx, "staging.azimuthMargin")} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.moonStage}
        </span>
        <NumberRow label={L.stageRise} min={0} max={1} step={0.005} format={f3} {...numberField(ctx, "staging.moon.rise")} />
        <NumberRow label={L.stageLow} min={0} max={1} step={0.005} format={f3} {...numberField(ctx, "staging.moon.low")} />
        <NumberRow label={L.stageHigh} min={0} max={1} step={0.005} format={f3} {...numberField(ctx, "staging.moon.high")} />
        <NumberRow label={L.stageTopAt} min={5} max={90} step={1} format={degrees} {...numberField(ctx, "staging.moon.topAtDeg")} />
        <GateRow ctx={ctx} label={L.stageRiseGate} path="staging.moon.riseGate" min={-20} max={30} step={0.5} format={degrees} />
        <div className="grid grid-cols-2 gap-2">
          <NumberRow label={L.stageXMin} min={0} max={0.5} step={0.005} format={f3} {...numberField(ctx, "staging.moon.xMin")} />
          <NumberRow label={L.stageXMax} min={0.5} max={1} step={0.005} format={f3} {...numberField(ctx, "staging.moon.xMax")} />
        </div>
        <Note>{L.stageNote}</Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.shaderFraming}
        </span>
        <NumberRow label={L.horizonCurve} min={0.2} max={2.5} step={0.01} format={f2} {...numberField(ctx, "staging.shader.horizonCurve")} />
        <NumberRow label={L.cloudScaleFar} min={0.3} max={6} step={0.05} format={f2} {...numberField(ctx, "staging.shader.cloudScaleFar")} />
        <NumberRow label={L.cloudScaleNear} min={0.3} max={6} step={0.05} format={f2} {...numberField(ctx, "staging.shader.cloudScaleNear")} />
        <NumberRow label={L.cloudParallaxFar} min={0.1} max={2} step={0.01} format={f2} {...numberField(ctx, "staging.shader.cloudParallaxFar")} />
        <NumberRow label={L.cloudParallaxNear} min={0.1} max={2} step={0.01} format={f2} {...numberField(ctx, "staging.shader.cloudParallaxNear")} />
        <Note>{L.shaderNote}</Note>
      </div>
    </Panel>
  );
}
