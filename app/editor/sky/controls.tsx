"use client";

// =============================================================================
// The Sky Engine Lab's panel — one section per area of the world model.
//
// Every lever writes a field of the live `SkyConfig`; nothing here knows how a
// sky is derived or drawn. A lever names the path it edits and nothing else:
// the label comes from the path (i18n.ts), the value and the committed default
// are read off the two configs in `PanelContext`, and the amber star — "this
// is not what ships" — appears on its own once they differ. That is what keeps
// a hundred-odd levers to one line each.
// =============================================================================

import { useMemo, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import {
  Chip,
  Field,
  LabButton,
  Note,
  Readout,
  Section,
  Segmented,
  Slider,
  Star,
  TextField,
} from "../controls";
import type {
  SkyConfig,
  SkyPreset,
  ConditionProfileConfig,
} from "@/systems/ambient/lib/sky-config";
import { DEFAULT_PRESET_ID, SKY_CONDITIONS } from "@/systems/ambient/lib/sky-config";
import { rgbToCss, sampleSky, resolveSkyConfig, type SceneOverrides } from "@/systems/ambient/lib/scene";
import type { NormalizedWeather, WeatherCondition } from "@/systems/ambient/lib/weather";
import type { LabText } from "./i18n";
import { deg, OBSERVER_PRESETS, SCENARIOS, type Observer, type Scenario } from "./model";

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
    source,
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

const toPath = (path: string): Path =>
  path.split(".").map((k) => (/^\d+$/.test(k) ? Number(k) : k));

export interface PanelContext {
  config: SkyConfig;
  /** The committed config — what a lever's star resets to. */
  defaults: SkyConfig;
  update: (path: Path, value: unknown) => void;
  T: LabText;
}

const f2 = (v: number) => v.toFixed(2);
const f3 = (v: number) => v.toFixed(3);
const degrees = (v: number) => `${v.toFixed(1)}°`;
const kmh = (v: number) => `${Math.round(v)} km/h`;

// -----------------------------------------------------------------------------
// Levers
// -----------------------------------------------------------------------------

/**
 * One number of the config: its label, its value, a slider, and the star
 * once it has left the committed value.
 */
function Knob({
  ctx,
  path,
  min,
  max,
  step,
  format = f2,
  label,
}: {
  ctx: PanelContext;
  path: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  /** Overrides the label the path would give (a profile row inside a grid). */
  label?: string;
}) {
  const keys = toPath(path);
  const value = getIn(ctx.config, keys) as number;
  const committed = getIn(ctx.defaults, keys) as number;
  return (
    <Field label={label ?? ctx.T.knob(path)} hint={format(value)}>
      <div className="flex items-center gap-2">
        <Slider value={value} min={min} max={max} step={step} onChange={(v) => ctx.update(keys, v)} />
        <Star
          active={Math.abs(value - committed) > 1e-9}
          title={ctx.T.L.backToDefault(format(committed))}
          onReset={() => ctx.update(keys, committed)}
        />
      </div>
    </Field>
  );
}

/** A smoothstep gate: the two values it ramps between, as a pair of sliders. */
function GateKnob({
  ctx,
  path,
  min,
  max,
  step,
  format = f2,
  hint,
}: {
  ctx: PanelContext;
  path: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  hint?: string;
}) {
  const from = toPath(`${path}.from`);
  const to = toPath(`${path}.to`);
  const value = { from: getIn(ctx.config, from) as number, to: getIn(ctx.config, to) as number };
  const committed = { from: getIn(ctx.defaults, from) as number, to: getIn(ctx.defaults, to) as number };
  const dirty =
    Math.abs(value.from - committed.from) > 1e-9 || Math.abs(value.to - committed.to) > 1e-9;
  return (
    <Field label={ctx.T.knob(path)} hint={`${format(value.from)} → ${format(value.to)}`}>
      <div className="flex items-center gap-2">
        <Slider
          value={value.from}
          min={min}
          max={max}
          step={step}
          aria-label={`${ctx.T.knob(path)} · ${ctx.T.L.from}`}
          onChange={(v) => ctx.update(from, v)}
        />
        <Slider
          value={value.to}
          min={min}
          max={max}
          step={step}
          aria-label={`${ctx.T.knob(path)} · ${ctx.T.L.to}`}
          onChange={(v) => ctx.update(to, v)}
        />
        <Star
          active={dirty}
          title={ctx.T.L.backToDefault(`${format(committed.from)} → ${format(committed.to)}`)}
          onReset={() => {
            ctx.update(from, committed.from);
            ctx.update(to, committed.to);
          }}
        />
      </div>
      {hint && <span className="text-[10px] text-muted-foreground/60">{hint}</span>}
    </Field>
  );
}

/** A colour of the config, as a swatch you can click — compact enough for a table cell. */
function ColorCell({
  ctx,
  path,
  title,
}: {
  ctx: PanelContext;
  path: string;
  title: string;
}) {
  const keys = toPath(path);
  const value = getIn(ctx.config, keys) as string;
  const committed = getIn(ctx.defaults, keys) as string;
  return (
    <span className="relative inline-flex w-full items-center">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
        onChange={(e) => ctx.update(keys, e.target.value)}
        title={`${title} · ${value}`}
        aria-label={title}
        className="h-5 w-full cursor-pointer rounded border border-border/60 bg-transparent p-0"
      />
      {value !== committed && (
        <span className="absolute -right-1 -top-1.5">
          <Star title={ctx.T.L.backToDefault(committed)} onReset={() => ctx.update(keys, committed)} />
        </span>
      )}
    </span>
  );
}

/** A labelled row of two colours: `day / night`, `calm / storm`. */
function ColorPair({
  ctx,
  label,
  a,
  b,
}: {
  ctx: PanelContext;
  label: string;
  a: { path: string; title: string };
  b: { path: string; title: string };
}) {
  return (
    <div className="grid grid-cols-[1fr_2rem_2rem] items-center gap-2 font-mono text-[10px] text-muted-foreground">
      <span>{label}</span>
      <ColorCell ctx={ctx} path={a.path} title={a.title} />
      <ColorCell ctx={ctx} path={b.path} title={b.title} />
    </div>
  );
}

/** A mono, uppercase sub-heading inside a section. */
function Sub({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Presets
// -----------------------------------------------------------------------------

export function PresetSection({
  T,
  presets,
  editingId,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onMakeActive,
}: {
  T: LabText;
  presets: SkyPreset[];
  editingId: string;
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onMakeActive: (id: string) => void;
}) {
  const { L } = T;
  const [name, setName] = useState("");
  return (
    <Section title={L.presets}>
      <Field as="div" label={L.editing(editingId)}>
        <div className="flex flex-wrap gap-1">
          {presets.map((p) => (
            <Chip
              key={p.id}
              active={p.id === editingId}
              onClick={() => onSelect(p.id)}
              title={p.id === activeId ? L.activeHint : p.id}
            >
              {p.name}
              {p.id === activeId && <span className="ml-1 opacity-70">●</span>}
            </Chip>
          ))}
        </div>
      </Field>
      <div className="flex items-center gap-2">
        <TextField value={name} onChange={setName} placeholder={L.newPreset} />
        <LabButton
          disabled={!name.trim()}
          title={L.addHint}
          onClick={() => {
            onCreate(name.trim());
            setName("");
          }}
        >
          <Plus className="h-3 w-3" />
          {L.add}
        </LabButton>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={editingId === activeId} onClick={() => onMakeActive(editingId)} title={L.makeActiveHint}>
          {editingId === activeId ? L.activeOnSite : L.makeActive}
        </Chip>
        {editingId !== DEFAULT_PRESET_ID && (
          <Chip onClick={() => onDelete(editingId)} className="hover:text-amber-500">
            <Trash2 className="mr-1 inline h-2.5 w-2.5" />
            {L.delete}
          </Chip>
        )}
      </div>
      <Note>{L.presetsNote}</Note>
    </Section>
  );
}

// -----------------------------------------------------------------------------
// Observer
// -----------------------------------------------------------------------------

export function ObserverSection({
  T,
  observer,
  onChange,
  resolved,
  hemisphere,
  onScenario,
}: {
  T: LabText;
  observer: Observer;
  onChange: (observer: Observer) => void;
  resolved: Observer | null;
  hemisphere: 1 | -1;
  onScenario: (scenario: Scenario) => void;
}) {
  const { L } = T;
  return (
    <Section title={L.observer}>
      <Field as="div" label={observer.label} hint={`${observer.lat.toFixed(2)}, ${observer.lon.toFixed(2)}`}>
        <div className="flex flex-wrap gap-1">
          {resolved && (
            <Chip active={observer.label === resolved.label} onClick={() => onChange(resolved)} title={L.resolvedHint}>
              <MapPin className="mr-1 inline h-2.5 w-2.5" />
              {resolved.label}
            </Chip>
          )}
          {OBSERVER_PRESETS.map((o) => (
            <Chip key={o.label} active={observer.label === o.label} onClick={() => onChange(o)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label={L.latitude} hint={degrees(observer.lat)}>
        <Slider
          value={observer.lat}
          min={-90}
          max={90}
          step={0.5}
          onChange={(lat) => onChange({ ...observer, label: L.custom, lat })}
        />
      </Field>
      <Field label={L.longitude} hint={degrees(observer.lon)}>
        <Slider
          value={observer.lon}
          min={-180}
          max={180}
          step={0.5}
          onChange={(lon) => onChange({ ...observer, label: L.custom, lon })}
        />
      </Field>
      <Field as="div" label={L.hemisphere}>
        <Segmented
          value={hemisphere === -1 ? "south" : "north"}
          onChange={(v) =>
            onChange({
              ...observer,
              label: L.custom,
              lat: v === "south" ? -Math.abs(observer.lat) : Math.abs(observer.lat),
            })
          }
          options={[
            { value: "north", label: L.north },
            { value: "south", label: L.south },
          ]}
        />
        <span className="text-[10px] text-muted-foreground/60">{L.hemisphereNote}</span>
      </Field>
      <Note>{L.clockNote}</Note>
      <Field as="div" label={L.scenarios}>
        <div className="flex flex-wrap gap-1">
          {SCENARIOS.map((s) => {
            const [label, description] = L.scenario[s.id] ?? [s.label, s.description];
            return (
              <Chip key={s.id} onClick={() => onScenario(s)} title={description}>
                {label}
              </Chip>
            );
          })}
        </div>
      </Field>
    </Section>
  );
}

// -----------------------------------------------------------------------------
// Sun
// -----------------------------------------------------------------------------

/** The clear-sky ramp, sampled the way `sampleSky` samples it. */
function SkyRamp({ ctx }: { ctx: PanelContext }) {
  const { config } = ctx;
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
      <div className="h-6 rounded-md ring-1 ring-border/50" style={{ backgroundImage: gradient }} />
      <div className="flex justify-between font-mono text-[9px] text-tertiary-foreground">
        <span>{deg(config.sun.keys[0].el, 0)}</span>
        <span>{ctx.T.L.ramp}</span>
        <span>{deg(config.sun.keys[config.sun.keys.length - 1].el, 0)}</span>
      </div>
    </div>
  );
}

const CELL =
  "w-full rounded border border-border/60 bg-transparent px-1 py-0.5 font-mono text-[10px] tabular-nums outline-none focus:border-foreground/40";

export function SunSection({ ctx }: { ctx: PanelContext }) {
  const { L } = ctx.T;
  const keys = ctx.config.sun.keys;
  return (
    <>
      <Section title={L.sun}>
        <SkyRamp ctx={ctx} />
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[2.6rem_1fr_1fr_1fr_2.6rem] items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-tertiary-foreground">
            <span>{L.keyEl}</span>
            <span className="text-center">{L.keyZenith}</span>
            <span className="text-center">{L.keyHorizon}</span>
            <span className="text-center">{L.keyGlow}</span>
            <span className="text-right">{L.keyStrength}</span>
          </div>
          {keys.map((key, i) => (
            <div key={i} className="grid grid-cols-[2.6rem_1fr_1fr_1fr_2.6rem] items-center gap-1">
              <input
                type="number"
                value={key.el}
                step={1}
                onChange={(e) => ctx.update(["sun", "keys", i, "el"], Number(e.target.value))}
                aria-label={`${L.keyframe(i + 1)} · ${L.keyEl}`}
                className={CELL}
              />
              <ColorCell ctx={ctx} path={`sun.keys.${i}.zenith`} title={`${L.keyframe(i + 1)} ${key.el}° · ${L.keyZenith}`} />
              <ColorCell ctx={ctx} path={`sun.keys.${i}.horizon`} title={`${L.keyframe(i + 1)} ${key.el}° · ${L.keyHorizon}`} />
              <ColorCell ctx={ctx} path={`sun.keys.${i}.glow`} title={`${L.keyframe(i + 1)} ${key.el}° · ${L.keyGlow}`} />
              <input
                type="number"
                value={key.strength}
                step={0.01}
                min={0}
                max={4}
                onChange={(e) => ctx.update(["sun", "keys", i, "strength"], Number(e.target.value))}
                aria-label={`${L.keyframe(i + 1)} · ${L.keyStrength}`}
                className={`${CELL} text-right`}
              />
            </div>
          ))}
          <Note>{L.keysNote}</Note>
        </div>
        <Knob ctx={ctx} path="sun.dayElevationDeg" min={-18} max={18} step={0.1} format={degrees} />
        <Knob ctx={ctx} path="sun.twilightFloorDeg" min={-40} max={0} step={0.5} format={degrees} />
        <Knob ctx={ctx} path="sun.twilightCeilDeg" min={0} max={40} step={0.5} format={degrees} />
        <Note>{L.thresholdsNote}</Note>
      </Section>
      <Section title={L.sunShader}>
        <Knob ctx={ctx} path="sun.discSize" min={0} max={0.12} step={0.001} format={f3} />
        <Knob ctx={ctx} path="sun.glowRadiusHigh" min={0.05} max={2} step={0.01} />
        <Knob ctx={ctx} path="sun.glowRadiusLow" min={0.05} max={3} step={0.01} />
        <Knob ctx={ctx} path="sun.glowGain" min={0} max={3} step={0.01} />
        <Knob ctx={ctx} path="sun.horizonBand" min={0} max={2} step={0.01} />
        <Knob ctx={ctx} path="sun.coverFade" min={0} max={1} step={0.01} />
      </Section>
    </>
  );
}

// -----------------------------------------------------------------------------
// Moon
// -----------------------------------------------------------------------------

export function MoonSection({ ctx }: { ctx: PanelContext }) {
  const { L } = ctx.T;
  return (
    <>
      <Section title={L.moon}>
        <Knob ctx={ctx} path="moon.discSize" min={0.005} max={0.12} step={0.001} format={f3} />
        <Knob ctx={ctx} path="moon.illusionScale" min={0} max={1} step={0.01} />
        <Knob ctx={ctx} path="moon.illusionFadeDeg" min={5} max={90} step={1} format={degrees} />
        <Knob ctx={ctx} path="moon.haloStrength" min={0} max={0.5} step={0.005} format={f3} />
        <Knob ctx={ctx} path="moon.earthshine" min={0} max={0.3} step={0.005} format={f3} />
        <Knob ctx={ctx} path="moon.terminatorSoftness" min={0.01} max={0.6} step={0.005} format={f3} />
        <Note>{L.moonNote}</Note>
      </Section>
      <Section title={L.moonGates}>
        <GateKnob ctx={ctx} path="moon.up" min={-30} max={30} step={0.5} format={degrees} />
        <GateKnob ctx={ctx} path="moon.skyDark" min={-30} max={30} step={0.5} format={degrees} />
        <GateKnob ctx={ctx} path="moon.cover" min={0} max={1} step={0.01} />
        <Knob ctx={ctx} path="moon.fogGate" min={0} max={1} step={0.01} />
        <Note>{L.moonGatesNote}</Note>
      </Section>
      <Section title={L.dayMoon}>
        <GateKnob ctx={ctx} path="moon.day.elevation" min={0} max={60} step={1} format={degrees} />
        <GateKnob ctx={ctx} path="moon.day.elongation" min={0} max={180} step={1} format={degrees} />
        <Knob ctx={ctx} path="moon.day.strength" min={0} max={1} step={0.01} />
        <Note>{L.dayMoonNote}</Note>
      </Section>
      <Section title={L.moonlight}>
        <GateKnob ctx={ctx} path="moon.light.rise" min={-10} max={60} step={1} format={degrees} />
        <div className="grid grid-cols-[2rem_1fr] items-end gap-2">
          <ColorCell ctx={ctx} path="moon.light.zenithColor" title={ctx.T.knob("moon.light.zenithColor")} />
          <Knob ctx={ctx} path="moon.light.zenithAmount" min={0} max={1} step={0.01} />
          <ColorCell ctx={ctx} path="moon.light.horizonColor" title={ctx.T.knob("moon.light.horizonColor")} />
          <Knob ctx={ctx} path="moon.light.horizonAmount" min={0} max={1} step={0.01} />
          <ColorCell ctx={ctx} path="moon.light.cloudColor" title={ctx.T.knob("moon.light.cloudColor")} />
          <Knob ctx={ctx} path="moon.light.cloudAmount" min={0} max={1} step={0.01} />
        </div>
        <Knob ctx={ctx} path="moon.light.starWash" min={0} max={1} step={0.01} />
      </Section>
    </>
  );
}

// -----------------------------------------------------------------------------
// Stars
// -----------------------------------------------------------------------------

export function StarsSection({ ctx }: { ctx: PanelContext }) {
  const { L } = ctx.T;
  return (
    <Section title={L.stars}>
      <Knob ctx={ctx} path="stars.density" min={0} max={3} step={0.05} />
      <Knob ctx={ctx} path="stars.twinkle" min={0} max={1} step={0.01} />
      <GateKnob ctx={ctx} path="stars.night" min={-30} max={20} step={0.5} format={degrees} hint={L.gateNote} />
      <GateKnob ctx={ctx} path="stars.cover" min={0} max={1} step={0.01} />
      <Note>{L.starsNote}</Note>
    </Section>
  );
}

// -----------------------------------------------------------------------------
// Weather — the scene's condition and the tweaks, then the profiles
// -----------------------------------------------------------------------------

export function ConditionField({
  T,
  forced,
  onForce,
  overrides,
  onOverrides,
  weather,
  cover,
  precipitation,
  defaultWindKmh,
}: {
  T: LabText;
  forced: WeatherCondition | null;
  onForce: (condition: WeatherCondition | null) => void;
  overrides: SceneOverrides;
  onOverrides: (overrides: SceneOverrides) => void;
  weather: NormalizedWeather | null;
  cover: number;
  precipitation: number;
  defaultWindKmh: number;
}) {
  const { L } = T;
  const set = (patch: SceneOverrides) => onOverrides({ ...overrides, ...patch });
  const drop = (key: keyof SceneOverrides) => {
    const next = { ...overrides };
    delete next[key];
    onOverrides(next);
  };
  const windDerived = weather?.windSpeedKmh ?? defaultWindKmh;
  const rows: {
    key: keyof SceneOverrides;
    label: string;
    derived: number;
    min: number;
    max: number;
    step: number;
    format: (v: number) => string;
  }[] = [
    { key: "cloudCover", label: L.cloud, derived: cover, min: 0, max: 1, step: 0.01, format: f2 },
    { key: "precipitationIntensity", label: L.precip, derived: precipitation, min: 0, max: 1, step: 0.01, format: f2 },
    { key: "windSpeedKmh", label: L.wind, derived: windDerived, min: 0, max: 80, step: 1, format: kmh },
  ];
  return (
    <>
      <Field as="div" label={L.condition}>
        <div className="flex flex-wrap gap-1">
          <Chip active={forced === null} onClick={() => onForce(null)} title={L.asReportedHint}>
            {L.asReported}
          </Chip>
          {SKY_CONDITIONS.map((c) => (
            <Chip key={c} active={forced === c} onClick={() => onForce(c)}>
              {T.conditionName(c)}
            </Chip>
          ))}
        </div>
      </Field>
      {rows.map((row) => {
        const value = overrides[row.key] ?? row.derived;
        return (
          <Field key={row.key} label={row.label} hint={row.format(value)}>
            <div className="flex items-center gap-2">
              <Slider value={value} min={row.min} max={row.max} step={row.step} onChange={(v) => set({ [row.key]: v })} />
              <Star
                active={row.key in overrides}
                title={L.backToDerived(row.format(row.derived))}
                onReset={() => drop(row.key)}
              />
            </div>
          </Field>
        );
      })}
    </>
  );
}

export function ApiReadout({ T, weather }: { T: LabText; weather: NormalizedWeather | null }) {
  const { L } = T;
  return (
    <Field as="div" label={L.api}>
      {weather ? (
        <div className="flex flex-col gap-0.5">
          <Readout k={L.apiCode} v={String(weather.weatherCode)} />
          <Readout k={L.apiCondition} v={T.conditionName(weather.condition)} />
          <Readout k={L.apiCloud} v={weather.cloudCover === undefined ? "—" : `${Math.round(weather.cloudCover * 100)}%`} />
          <Readout k={L.apiPrecip} v={weather.precipitationMmH === undefined ? "—" : `${weather.precipitationMmH} mm/h`} />
          <Readout
            k={L.apiWind}
            v={
              weather.windSpeedKmh === undefined
                ? "—"
                : `${Math.round(weather.windSpeedKmh)} km/h @ ${Math.round(weather.windDirectionDeg ?? 0)}°`
            }
          />
          <Readout k={L.apiHumidity} v={weather.humidity === undefined ? "—" : `${Math.round(weather.humidity * 100)}%`} />
        </div>
      ) : (
        <Note>{L.noWeather}</Note>
      )}
    </Field>
  );
}

const PROFILE_FIELDS: (keyof ConditionProfileConfig)[] = [
  "cover",
  "coverMin",
  "density",
  "darkness",
  "precip",
  "fog",
  "tintAmount",
];

export function CloudsSection({ ctx, condition }: { ctx: PanelContext; condition: WeatherCondition }) {
  const { L } = ctx.T;
  const p = `clouds.profiles.${condition}`;
  return (
    <>
      <Section title={L.profile(ctx.T.conditionName(condition))}>
        {PROFILE_FIELDS.map((key) => (
          <Knob key={key} ctx={ctx} path={`${p}.${key}`} min={0} max={1} step={0.01} />
        ))}
        <ColorPair
          ctx={ctx}
          label={L.tintDay}
          a={{ path: `${p}.tintDay.zenith`, title: L.tintDayZenith }}
          b={{ path: `${p}.tintDay.horizon`, title: L.tintDayHorizon }}
        />
        <ColorPair
          ctx={ctx}
          label={L.tintNight}
          a={{ path: `${p}.tintNight.zenith`, title: L.tintNightZenith }}
          b={{ path: `${p}.tintNight.horizon`, title: L.tintNightHorizon }}
        />
        <Note>{L.profileNote}</Note>
      </Section>
      <Section title={L.cover}>
        <GateKnob ctx={ctx} path="clouds.tintCover" min={0} max={1} step={0.01} />
        <Knob ctx={ctx} path="clouds.horizonTintRatio" min={0} max={1} step={0.01} />
        <Knob ctx={ctx} path="clouds.darknessFromPrecip" min={0} max={1} step={0.01} />
        <Knob ctx={ctx} path="clouds.darknessFromCover" min={0} max={1} step={0.01} />
      </Section>
      <Section title={L.windDrift}>
        <Knob ctx={ctx} path="clouds.windScaleKmh" min={5} max={150} step={1} format={kmh} />
        <Knob ctx={ctx} path="clouds.defaultWindKmh" min={0} max={60} step={1} format={kmh} />
        <Knob ctx={ctx} path="clouds.speedBase" min={0} max={2} step={0.01} />
        <Knob ctx={ctx} path="clouds.speedGain" min={0} max={4} step={0.01} />
      </Section>
      <Section title={L.lighting}>
        <ColorPair
          ctx={ctx}
          label={L.litTops}
          a={{ path: "clouds.lighting.litDay", title: L.litDay }}
          b={{ path: "clouds.lighting.litNight", title: L.litNight }}
        />
        <ColorPair
          ctx={ctx}
          label={L.shadeDay}
          a={{ path: "clouds.lighting.shadeDay", title: L.shadeDayCalm }}
          b={{ path: "clouds.lighting.shadeDayStorm", title: L.shadeDayStorm }}
        />
        <ColorPair
          ctx={ctx}
          label={L.shadeNight}
          a={{ path: "clouds.lighting.shadeNight", title: L.shadeNightCalm }}
          b={{ path: "clouds.lighting.shadeNightStorm", title: L.shadeNightStorm }}
        />
      </Section>
    </>
  );
}

// -----------------------------------------------------------------------------
// Veil
// -----------------------------------------------------------------------------

export function VeilSection({ ctx }: { ctx: PanelContext }) {
  const { L, themeName } = ctx.T;
  return (
    <Section title={L.veil}>
      {(["light", "dark"] as const).map((theme) => (
        <div key={theme} className="flex flex-col gap-3">
          <div className="grid grid-cols-[2rem_1fr] items-center gap-2">
            <ColorCell ctx={ctx} path={`veil.${theme}.color`} title={L.veilColor(themeName(theme))} />
            <Sub>{themeName(theme)}</Sub>
          </div>
          <Knob ctx={ctx} path={`veil.${theme}.amount`} min={0} max={1} step={0.01} />
          <Knob ctx={ctx} path={`veil.${theme}.exposure`} min={0.4} max={1.6} step={0.01} />
        </div>
      ))}
      <Note>{L.veilNote}</Note>
    </Section>
  );
}

// -----------------------------------------------------------------------------
// Camera & staging
// -----------------------------------------------------------------------------

export function StagingSection({
  ctx,
  portrait,
  onPortrait,
}: {
  ctx: PanelContext;
  portrait: boolean;
  onPortrait: (portrait: boolean) => void;
}) {
  const { L } = ctx.T;
  return (
    <>
      <Section title={L.staging}>
        <Field as="div" label={L.frame}>
          <Segmented
            value={portrait ? "portrait" : "landscape"}
            onChange={(v) => onPortrait(v === "portrait")}
            options={[
              { value: "landscape", label: L.landscape },
              { value: "portrait", label: L.portrait },
            ]}
          />
          <span className="text-[10px] text-muted-foreground/60">{L.stagingNote}</span>
        </Field>
        <Knob ctx={ctx} path="staging.horizonY" min={-0.2} max={0.6} step={0.005} format={f3} />
        <Knob ctx={ctx} path="staging.sunArc" min={0} max={1.5} step={0.01} />
        <Knob ctx={ctx} path="staging.azimuthSpan" min={0.2} max={1.4} step={0.01} />
        <Knob ctx={ctx} path="staging.azimuthMargin" min={-0.3} max={0.4} step={0.01} />
      </Section>
      <Section title={L.moonStage}>
        <Knob ctx={ctx} path="staging.moon.rise" min={0} max={1} step={0.005} format={f3} />
        <Knob ctx={ctx} path="staging.moon.low" min={0} max={1} step={0.005} format={f3} />
        <Knob ctx={ctx} path="staging.moon.high" min={0} max={1} step={0.005} format={f3} />
        <Knob ctx={ctx} path="staging.moon.topAtDeg" min={5} max={90} step={1} format={degrees} />
        <GateKnob ctx={ctx} path="staging.moon.riseGate" min={-20} max={30} step={0.5} format={degrees} />
        <Knob ctx={ctx} path="staging.moon.xMin" min={0} max={0.5} step={0.005} format={f3} />
        <Knob ctx={ctx} path="staging.moon.xMax" min={0.5} max={1} step={0.005} format={f3} />
        <Note>{L.moonStageNote}</Note>
      </Section>
      <Section title={L.shader}>
        <Knob ctx={ctx} path="staging.shader.horizonCurve" min={0.2} max={2.5} step={0.01} />
        <Knob ctx={ctx} path="staging.shader.cloudScaleFar" min={0.3} max={6} step={0.05} />
        <Knob ctx={ctx} path="staging.shader.cloudScaleNear" min={0.3} max={6} step={0.05} />
        <Knob ctx={ctx} path="staging.shader.cloudParallaxFar" min={0.1} max={2} step={0.01} />
        <Knob ctx={ctx} path="staging.shader.cloudParallaxNear" min={0.1} max={2} step={0.01} />
        <Note>{L.shaderNote}</Note>
      </Section>
    </>
  );
}
