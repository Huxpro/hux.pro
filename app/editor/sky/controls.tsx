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
        <NumberRow label="from" min={min} max={max} step={step} format={format} {...numberField(ctx, `${path}.from`)} />
        <NumberRow label="to" min={min} max={max} step={step} format={format} {...numberField(ctx, `${path}.to`)} />
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
  const [name, setName] = useState("");
  return (
    <Panel title="Presets" hint={`editing ${editingId}`} defaultOpen>
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <Chip
            key={p.id}
            active={p.id === editingId}
            onClick={() => onSelect(p.id)}
            title={p.id === activeId ? "The preset the site paints from" : p.id}
          >
            {p.name}
            {p.id === activeId && <span className="ml-1 text-[9px] opacity-70">●</span>}
          </Chip>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <TextField value={name} onChange={setName} placeholder="New preset name" />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            onCreate(name.trim());
            setName("");
          }}
          title="Save the current config as a new preset"
          className="inline-flex shrink-0 items-center gap-1 rounded border border-border/60 px-2 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={editingId === activeId}
          onClick={() => onMakeActive(editingId)}
          title="Paint the site from this preset"
        >
          {editingId === activeId ? "Active on the site" : "Make active"}
        </Chip>
        {editingId !== "default" && (
          <button
            type="button"
            onClick={() => onDelete(editingId)}
            className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-amber-500/40 hover:text-amber-500"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        )}
      </div>
      <Note>
        Presets live in the same `content/sky.json`. The site paints from the
        active one; editing any other preset changes nothing until you make it
        active. The `default` preset is the shipped look and cannot be removed.
      </Note>
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
  return (
    <Panel
      title="Observer & scenarios"
      hint={`${observer.lat.toFixed(2)}, ${observer.lon.toFixed(2)}`}
      defaultOpen
    >
      <div className="flex flex-wrap gap-1">
        {resolved && (
          <Chip
            active={observer.label === resolved.label}
            onClick={() => onChange(resolved)}
            title="The location the site resolved for you"
          >
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

      <div className="grid grid-cols-2 gap-2">
        <NumberRow
          label="Latitude"
          value={observer.lat}
          min={-90}
          max={90}
          step={0.5}
          format={degrees}
          onChange={(lat) => onChange({ ...observer, label: "Custom", lat })}
        />
        <NumberRow
          label="Longitude"
          value={observer.lon}
          min={-180}
          max={180}
          step={0.5}
          format={degrees}
          onChange={(lon) => onChange({ ...observer, label: "Custom", lon })}
        />
      </div>

      <Toggle
        label={`Southern hemisphere (${hemisphere === -1 ? "mirrored" : "north"})`}
        value={hemisphere === -1}
        onChange={(south) =>
          onChange({
            ...observer,
            label: "Custom",
            lat: south ? -Math.abs(observer.lat) : Math.abs(observer.lat),
          })
        }
      />
      <Note>
        Below the equator the sky mirrors: east moves to the right and the
        crescent turns over. It is one sign in `scene.hemisphere`, and it is the
        easiest thing in the model to get backwards — so it has a switch.
      </Note>
      <Note>
        The clock stays in <em>your</em> timezone. Moving the observer moves the
        sky, not the calendar, so a Sydney day here runs from your local
        midnight and its sunrise lands wherever that puts it — which is exactly
        what the site does for a visitor who has travelled.
      </Note>

      <div className="flex flex-col gap-1 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Named skies
        </span>
        <div className="flex flex-wrap gap-1">
          {SCENARIOS.map((s) => (
            <Chip key={s.id} onClick={() => onScenario(s)} title={s.description}>
              {s.label}
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
function SkyRamp({ config }: { config: SkyConfig }) {
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
        title="The horizon colour across the whole elevation ramp"
      />
      <div className="flex justify-between font-mono text-[9px] text-tertiary-foreground">
        <span>{deg(config.sun.keys[0].el, 0)}</span>
        <span>horizon colour by sun elevation</span>
        <span>{deg(config.sun.keys[config.sun.keys.length - 1].el, 0)}</span>
      </div>
    </div>
  );
}

export function SunPanel({ ctx }: { ctx: PanelContext }) {
  const keys = ctx.config.sun.keys;
  return (
    <Panel title="Sun" hint={`${keys.length} keyframes`} defaultOpen>
      <SkyRamp config={ctx.config} />

      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[2.6rem_1fr_1fr_1fr_2.4rem] items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-tertiary-foreground">
          <span>el</span>
          <span className="text-center">zen</span>
          <span className="text-center">hor</span>
          <span className="text-center">glow</span>
          <span className="text-right">str</span>
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
              aria-label={`Keyframe ${i + 1} elevation`}
              className="w-full rounded border border-border/60 bg-transparent px-1 py-0.5 font-mono text-[10px] tabular-nums outline-none focus:border-foreground/40"
            />
            <ColorCell {...colorField(ctx, `sun.keys.${i}.zenith`)} title={`Keyframe ${key.el}° zenith`} />
            <ColorCell {...colorField(ctx, `sun.keys.${i}.horizon`)} title={`Keyframe ${key.el}° horizon`} />
            <ColorCell {...colorField(ctx, `sun.keys.${i}.glow`)} title={`Keyframe ${key.el}° glow`} />
            <input
              type="number"
              value={key.strength}
              step={0.01}
              min={0}
              max={4}
              onChange={(e) =>
                ctx.update(["sun", "keys", i, "strength"], Number(e.target.value))
              }
              aria-label={`Keyframe ${i + 1} glow strength`}
              className="w-full rounded border border-border/60 bg-transparent px-1 py-0.5 text-right font-mono text-[10px] tabular-nums outline-none focus:border-foreground/40"
            />
          </div>
        ))}
        <Note>
          Keys are re-sorted by elevation when the config is saved. Between two
          of them the sky is a smoothstep, which is why the interesting ones
          crowd around the horizon.
        </Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <NumberRow label="Day threshold" min={-18} max={18} step={0.1} format={degrees} {...numberField(ctx, "sun.dayElevationDeg")} />
        <NumberRow label="Twilight floor" min={-40} max={0} step={0.5} format={degrees} {...numberField(ctx, "sun.twilightFloorDeg")} />
        <NumberRow label="Twilight ceiling" min={0} max={40} step={0.5} format={degrees} {...numberField(ctx, "sun.twilightCeilDeg")} />
        <Note>
          The one day/night decision, and the window the daylight factor ramps
          across. Everything that says &ldquo;day&rdquo; — icons, palettes,
          chips — reads the first of these and nothing else.
        </Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <NumberRow label="Disc size" min={0} max={0.12} step={0.001} format={f3} {...numberField(ctx, "sun.discSize")} />
        <NumberRow label="Glow radius, high sun" min={0.05} max={2} step={0.01} format={f2} {...numberField(ctx, "sun.glowRadiusHigh")} />
        <NumberRow label="Glow radius, low sun" min={0.05} max={3} step={0.01} format={f2} {...numberField(ctx, "sun.glowRadiusLow")} />
        <NumberRow label="Glow gain" min={0} max={3} step={0.01} format={f2} {...numberField(ctx, "sun.glowGain")} />
        <NumberRow label="Horizon band" min={0} max={2} step={0.01} format={f2} {...numberField(ctx, "sun.horizonBand")} />
        <NumberRow label="Cloud mutes the glow" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "sun.coverFade")} />
      </div>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Moon
// -----------------------------------------------------------------------------

export function MoonPanel({ ctx }: { ctx: PanelContext }) {
  return (
    <Panel title="Moon" hint={`disc ${f3(ctx.config.moon.discSize)}`}>
      <NumberRow label="Disc size" min={0.005} max={0.12} step={0.001} format={f3} {...numberField(ctx, "moon.discSize")} />
      <NumberRow label="Moon illusion" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.illusionScale")} />
      <NumberRow label="Illusion fades by" min={5} max={90} step={1} format={degrees} {...numberField(ctx, "moon.illusionFadeDeg")} />
      <NumberRow label="Halo" min={0} max={0.5} step={0.005} format={f3} {...numberField(ctx, "moon.haloStrength")} />
      <NumberRow label="Earthshine" min={0} max={0.3} step={0.005} format={f3} {...numberField(ctx, "moon.earthshine")} />
      <NumberRow label="Terminator softness" min={0.01} max={0.6} step={0.005} format={f3} {...numberField(ctx, "moon.terminatorSoftness")} />
      <Note>
        Halo scales with the illuminated fraction and is painted *in front of*
        the disc, so it covers the dark side instead of outlining it. Earthshine
        is deliberately a whisper: any more and a crescent reads as a grey ball.
      </Note>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          The three gates
        </span>
        <GateRow ctx={ctx} label="Up (moon elevation)" path="moon.up" min={-30} max={30} step={0.5} format={degrees} />
        <GateRow ctx={ctx} label="Dark sky (sun elevation)" path="moon.skyDark" min={-30} max={30} step={0.5} format={degrees} />
        <GateRow ctx={ctx} label="Cloud cover" path="moon.cover" min={0} max={1} step={0.01} />
        <NumberRow label="Fog hides it" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.fogGate")} />
        <Note>
          Visibility is the product: up × sky × clear. Each of the three is
          plotted as a sparkline, so a moon that vanished has a culprit.
        </Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Daytime moon
        </span>
        <GateRow ctx={ctx} label="Elevation" path="moon.day.elevation" min={0} max={60} step={1} format={degrees} />
        <GateRow ctx={ctx} label="Elongation from the sun" path="moon.day.elongation" min={0} max={180} step={1} format={degrees} />
        <NumberRow label="Daytime strength" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.day.strength")} />
        <Note>
          A crescent near the sun is invisible by day — in the sky and here.
          Well up and far enough round, it shows as a pale disc.
        </Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Moonlight
        </span>
        <GateRow ctx={ctx} label="Reaches full by" path="moon.light.rise" min={-10} max={60} step={1} format={degrees} />
        <div className="grid grid-cols-[1.6rem_1fr] items-center gap-2">
          <ColorCell {...colorField(ctx, "moon.light.zenithColor")} title="Moonlit zenith" />
          <NumberRow label="Lifts the zenith" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.light.zenithAmount")} />
          <ColorCell {...colorField(ctx, "moon.light.horizonColor")} title="Moonlit horizon" />
          <NumberRow label="Lifts the horizon" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.light.horizonAmount")} />
          <ColorCell {...colorField(ctx, "moon.light.cloudColor")} title="Moonlit cloud tops" />
          <NumberRow label="Lifts the cloud tops" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.light.cloudAmount")} />
        </div>
        <NumberRow label="Washes out the stars" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "moon.light.starWash")} />
      </div>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Stars
// -----------------------------------------------------------------------------

export function StarsPanel({ ctx }: { ctx: PanelContext }) {
  return (
    <Panel title="Stars" hint={`density ${f2(ctx.config.stars.density)}`}>
      <NumberRow label="Density" min={0} max={3} step={0.05} format={f2} {...numberField(ctx, "stars.density")} />
      <NumberRow label="Twinkle" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "stars.twinkle")} />
      <GateRow
        ctx={ctx}
        label="Night gate (sun elevation)"
        path="stars.night"
        min={-30}
        max={20}
        step={0.5}
        format={degrees}
        hint="0 at from, 1 at to"
      />
      <GateRow ctx={ctx} label="Cloud cover" path="stars.cover" min={0} max={1} step={0.01} />
      <Note>
        Density scales the share of shader cells that hold a star, so 0 empties
        the field and 1 is the shipped one. The night gate runs downwards —
        `from` is the brighter elevation.
      </Note>
    </Panel>
  );
}

// -----------------------------------------------------------------------------
// Weather
// -----------------------------------------------------------------------------

const PROFILE_FIELDS: {
  key: keyof ConditionProfileConfig;
  label: string;
  max: number;
}[] = [
  { key: "cover", label: "Cover (no measurement)", max: 1 },
  { key: "coverMin", label: "Cover floor", max: 1 },
  { key: "density", label: "Density", max: 1 },
  { key: "darkness", label: "Darkness", max: 1 },
  { key: "precip", label: "Precipitation", max: 1 },
  { key: "fog", label: "Fog", max: 1 },
  { key: "tintAmount", label: "Tint amount", max: 1 },
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
  const p = `clouds.profiles.${condition}`;
  const setOverride = (patch: SceneOverrides) => onOverrides({ ...overrides, ...patch });
  return (
    <Panel title="Weather" hint={condition} defaultOpen>
      <Field label="Condition">
        <div className="flex flex-wrap gap-1">
          <Chip active={forced === null} onClick={() => onForce(null)} title="Whatever the API reported">
            As reported
          </Chip>
          {SKY_CONDITIONS.map((c) => (
            <Chip key={c} active={forced === c} onClick={() => onForce(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </Field>

      <NumberRow
        label="Cloud cover"
        value={overrides.cloudCover ?? cover}
        defaultValue={cover}
        min={0}
        max={1}
        step={0.01}
        format={f2}
        onChange={(v) => setOverride({ cloudCover: v })}
      />
      <NumberRow
        label="Precipitation"
        value={overrides.precipitationIntensity ?? precipitation}
        defaultValue={precipitation}
        min={0}
        max={1}
        step={0.01}
        format={f2}
        onChange={(v) => setOverride({ precipitationIntensity: v })}
      />
      <NumberRow
        label="Wind"
        value={overrides.windSpeedKmh ?? weather?.windSpeedKmh ?? ctx.config.clouds.defaultWindKmh}
        defaultValue={weather?.windSpeedKmh ?? ctx.config.clouds.defaultWindKmh}
        min={0}
        max={80}
        step={1}
        format={(v) => `${Math.round(v)} km/h`}
        onChange={(v) => setOverride({ windSpeedKmh: v })}
      />
      <div className="flex justify-end">
        <Chip onClick={() => onOverrides({})} title="Drop every tweak and go back to the derived numbers">
          Clear tweaks
        </Chip>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Profile · {condition}
        </span>
        {PROFILE_FIELDS.map((row) => (
          <NumberRow
            key={row.key}
            label={row.label}
            min={0}
            max={row.max}
            step={0.01}
            format={f2}
            {...numberField(ctx, `${p}.${String(row.key)}`)}
          />
        ))}
        <div className="grid grid-cols-[1fr_1.6rem_1.6rem] items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>Day tint · zenith / horizon</span>
          <ColorCell {...colorField(ctx, `${p}.tintDay.zenith`)} title="Day zenith tint" />
          <ColorCell {...colorField(ctx, `${p}.tintDay.horizon`)} title="Day horizon tint" />
          <span>Night tint · zenith / horizon</span>
          <ColorCell {...colorField(ctx, `${p}.tintNight.zenith`)} title="Night zenith tint" />
          <ColorCell {...colorField(ctx, `${p}.tintNight.horizon`)} title="Night horizon tint" />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          How cover behaves
        </span>
        <GateRow ctx={ctx} label="Cover that brings the tint in" path="clouds.tintCover" min={0} max={1} step={0.01} />
        <NumberRow label="Horizon keeps more clear sky" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "clouds.horizonTintRatio")} />
        <NumberRow label="Darkness from precipitation" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "clouds.darknessFromPrecip")} />
        <NumberRow label="Darkness from extra cover" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, "clouds.darknessFromCover")} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Wind & drift
        </span>
        <NumberRow label="Full drift at" min={5} max={150} step={1} format={(v) => `${Math.round(v)} km/h`} {...numberField(ctx, "clouds.windScaleKmh")} />
        <NumberRow label="Assumed wind" min={0} max={60} step={1} format={(v) => `${Math.round(v)} km/h`} {...numberField(ctx, "clouds.defaultWindKmh")} />
        <NumberRow label="Drift at zero wind" min={0} max={2} step={0.01} format={f2} {...numberField(ctx, "clouds.speedBase")} />
        <NumberRow label="Drift from wind" min={0} max={4} step={0.01} format={f2} {...numberField(ctx, "clouds.speedGain")} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Cloud lighting
        </span>
        <div className="grid grid-cols-[1fr_1.6rem_1.6rem] items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>Lit tops · day / night</span>
          <ColorCell {...colorField(ctx, "clouds.lighting.litDay")} title="Lit tops by day" />
          <ColorCell {...colorField(ctx, "clouds.lighting.litNight")} title="Lit tops at night" />
          <span>Shade by day · calm / storm</span>
          <ColorCell {...colorField(ctx, "clouds.lighting.shadeDay")} title="Daytime shade, calm" />
          <ColorCell {...colorField(ctx, "clouds.lighting.shadeDayStorm")} title="Daytime shade, stormy" />
          <span>Shade at night · calm / storm</span>
          <ColorCell {...colorField(ctx, "clouds.lighting.shadeNight")} title="Night shade, calm" />
          <ColorCell {...colorField(ctx, "clouds.lighting.shadeNightStorm")} title="Night shade, stormy" />
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Veil, per theme
        </span>
        {(["light", "dark"] as const).map((theme) => (
          <div key={theme} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ColorCell {...colorField(ctx, `veil.${theme}.color`)} title={`${theme} veil colour`} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {theme}
              </span>
            </div>
            <NumberRow label="Amount" min={0} max={1} step={0.01} format={f2} {...numberField(ctx, `veil.${theme}.amount`)} />
            <NumberRow label="Exposure" min={0.4} max={1.6} step={0.01} format={f2} {...numberField(ctx, `veil.${theme}.exposure`)} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          As the API reported it
        </span>
        {weather ? (
          <>
            <Readout label="code" value={String(weather.weatherCode)} />
            <Readout label="condition" value={weather.condition} />
            <Readout
              label="cloud"
              value={weather.cloudCover === undefined ? "—" : `${Math.round(weather.cloudCover * 100)}%`}
            />
            <Readout
              label="precip"
              value={weather.precipitationMmH === undefined ? "—" : `${weather.precipitationMmH} mm/h`}
            />
            <Readout
              label="wind"
              value={
                weather.windSpeedKmh === undefined
                  ? "—"
                  : `${Math.round(weather.windSpeedKmh)} km/h @ ${Math.round(weather.windDirectionDeg ?? 0)}°`
              }
            />
            <Readout
              label="humidity"
              value={weather.humidity === undefined ? "—" : `${Math.round(weather.humidity * 100)}%`}
            />
          </>
        ) : (
          <Note>No live weather — the lab is deriving from the profile defaults.</Note>
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
  return (
    <Panel title="Camera & staging" hint={`horizon ${f2(ctx.config.staging.horizonY)}`}>
      <Segmented
        value={portrait ? "portrait" : "landscape"}
        onChange={(v) => onPortrait(v === "portrait")}
        options={[
          { value: "landscape", label: "Landscape" },
          { value: "portrait", label: "Portrait" },
        ]}
      />
      <Note>
        The stage was designed for both. The preview canvas and the screen-space
        plot change shape together.
      </Note>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          The frame
        </span>
        <NumberRow label="Horizon y" min={-0.2} max={0.6} step={0.005} format={f3} {...numberField(ctx, "staging.horizonY")} />
        <NumberRow label="Sun arc height" min={0} max={1.5} step={0.01} format={f2} {...numberField(ctx, "staging.sunArc")} />
        <NumberRow label="East → west span" min={0.2} max={1.4} step={0.01} format={f2} {...numberField(ctx, "staging.azimuthSpan")} />
        <NumberRow label="Left margin" min={-0.3} max={0.4} step={0.01} format={f2} {...numberField(ctx, "staging.azimuthMargin")} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          The moon&rsquo;s stage
        </span>
        <NumberRow label="y at the horizon" min={0} max={1} step={0.005} format={f3} {...numberField(ctx, "staging.moon.rise")} />
        <NumberRow label="y once properly up" min={0} max={1} step={0.005} format={f3} {...numberField(ctx, "staging.moon.low")} />
        <NumberRow label="y at the top" min={0} max={1} step={0.005} format={f3} {...numberField(ctx, "staging.moon.high")} />
        <NumberRow label="Reaches the top at" min={5} max={90} step={1} format={degrees} {...numberField(ctx, "staging.moon.topAtDeg")} />
        <GateRow ctx={ctx} label="Climbs from horizon to low" path="staging.moon.riseGate" min={-20} max={30} step={0.5} format={degrees} />
        <div className="grid grid-cols-2 gap-2">
          <NumberRow label="x min" min={0} max={0.5} step={0.005} format={f3} {...numberField(ctx, "staging.moon.xMin")} />
          <NumberRow label="x max" min={0.5} max={1} step={0.005} format={f3} {...numberField(ctx, "staging.moon.xMax")} />
        </div>
        <Note>
          Where the moon <em>is</em> is never bent. This is only where it is
          drawn — and the screen-space plot redraws with every one of these, so
          the change is visible as a change of path before it is a change of
          picture.
        </Note>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Shader framing
        </span>
        <NumberRow label="Horizon curve" min={0.2} max={2.5} step={0.01} format={f2} {...numberField(ctx, "staging.shader.horizonCurve")} />
        <NumberRow label="Far deck scale" min={0.3} max={6} step={0.05} format={f2} {...numberField(ctx, "staging.shader.cloudScaleFar")} />
        <NumberRow label="Near deck scale" min={0.3} max={6} step={0.05} format={f2} {...numberField(ctx, "staging.shader.cloudScaleNear")} />
        <NumberRow label="Far deck parallax" min={0.1} max={2} step={0.01} format={f2} {...numberField(ctx, "staging.shader.cloudParallaxFar")} />
        <NumberRow label="Near deck parallax" min={0.1} max={2} step={0.01} format={f2} {...numberField(ctx, "staging.shader.cloudParallaxNear")} />
        <Note>
          Only the Sky engine reads these. The Gradient and Classic renderings
          beside it will not move.
        </Note>
      </div>
    </Panel>
  );
}
