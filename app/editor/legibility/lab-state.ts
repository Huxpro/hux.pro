"use client";

// =============================================================================
// Lab state — the three layers a person can turn, and how each reaches CSS.
//
//   scene      what is painting: wallpaper, theme, material, tint. These drive
//              the REAL app state (the same setters the devtool and the picker
//              use), so the stage is the production stylesheet over the
//              production wallpaper stack, not a mock of it.
//
//   policy     the legibility policy's knobs (`LegibilityPolicy`) and, below
//              them, pins on its outputs. Re-resolved here on the current
//              profile and handed to the provider as `legibilityOverride`, the
//              same CSS variables the provider would have written.
//
//   sheet      the stylesheet's own inputs — alpha ladder, washes, relief
//              shape, glass fills, tint amounts. Written inline on <html>,
//              removed on unmount. The default for each is read from the
//              computed style, so the lab never carries a second copy of it.
//
// Nothing here persists across a reload. Within the session the tuning stays
// put when you leave — the policy through the provider, the sheet inline on
// <html>, and the sliders' own state in `LAB_SESSION` below — so a veil tuned
// here can be checked on the real /writing before it is copied into code.
// "Reset all" clears the lot.
// =============================================================================

import {
  DEFAULT_LEGIBILITY_POLICY,
  resolveLegibility,
  type LegibilityPolicy,
  type LegibilityVars,
  type Theme,
} from "@/systems/ambient/lib/legibility";
import type { WallpaperProfile } from "@/systems/ambient/lib/wallpaper-profile";

// -----------------------------------------------------------------------------
// Policy knobs
// -----------------------------------------------------------------------------

export interface PolicyKnob {
  key: keyof LegibilityPolicy;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}

/** The scalar policy knobs, in the order they act. The tint ranges are edited
 *  as pairs and listed separately. */
export const POLICY_KNOBS: PolicyKnob[] = [
  { key: "edgesFull", label: "Edges → busy", hint: "edges at which busy = 1", min: 0.01, max: 0.15, step: 0.005 },
  { key: "inkBoostMax", label: "Ink boost max", hint: "alpha points at busy = 1", min: 0, max: 30, step: 1 },
  { key: "reliefBusy", label: "Relief from busy", hint: "relief at busy = 1", min: 0, max: 1, step: 0.05 },
  { key: "reliefGapStart", label: "Relief gap start", hint: "ink−backdrop gap where need starts", min: 0, max: 0.6, step: 0.01 },
  { key: "reliefGapFull", label: "Relief gap full", hint: "gap where need is nil", min: 0.2, max: 0.9, step: 0.01 },
  { key: "reliefReading", label: "Relief on reading", hint: "multiplier under the veil", min: 0, max: 1, step: 0.05 },
  { key: "reliefFloor", label: "Relief floor", hint: "below this: none", min: 0, max: 0.4, step: 0.01 },
  { key: "glassAddMax", label: "Glass add max", hint: "fill points at busy = 1", min: 0, max: 40, step: 1 },
  { key: "glassAddToneMax", label: "Glass add · tone", hint: "fill points at full tone conflict", min: 0, max: 50, step: 1 },
  { key: "flipMargin", label: "Flip margin", hint: "how much better the inverse ink must be", min: 0, max: 0.5, step: 0.01 },
  { key: "veilBusy", label: "Veil · busy", hint: "veil alpha added at busy = 1", min: 0, max: 0.5, step: 0.01 },
  { key: "veilConflict", label: "Veil · tone", hint: "veil alpha added at full tone conflict", min: 0, max: 0.5, step: 0.01 },
  { key: "veilMax", label: "Veil max", hint: "some picture must remain", min: 0.3, max: 1, step: 0.01 },
  { key: "blurBase", label: "Blur base", hint: "px on a calm picture", min: 0, max: 80, step: 1 },
  { key: "blurBusy", label: "Blur · busy", hint: "px added at busy = 1", min: 0, max: 80, step: 1 },
  { key: "tintMinChroma", label: "Tint min chroma", hint: "greyer than this: no tint", min: 0, max: 0.1, step: 0.005 },
];

export type PolicyOverrides = Partial<
  Pick<
    LegibilityPolicy,
    Exclude<keyof LegibilityPolicy, "tintLightness" | "tintChroma" | "toneSafe" | "toneWorst" | "veilBase">
  >
> & {
  tintLightness?: Record<Theme, [number, number]>;
  tintChroma?: [number, number];
  toneSafe?: Record<Theme, number>;
  toneWorst?: Record<Theme, number>;
  veilBase?: Record<Theme, number>;
};

export function mergePolicy(overrides: PolicyOverrides): LegibilityPolicy {
  return {
    ...DEFAULT_LEGIBILITY_POLICY,
    ...overrides,
    tintLightness: overrides.tintLightness ?? DEFAULT_LEGIBILITY_POLICY.tintLightness,
    tintChroma: overrides.tintChroma ?? DEFAULT_LEGIBILITY_POLICY.tintChroma,
    toneSafe: overrides.toneSafe ?? DEFAULT_LEGIBILITY_POLICY.toneSafe,
    toneWorst: overrides.toneWorst ?? DEFAULT_LEGIBILITY_POLICY.toneWorst,
    veilBase: overrides.veilBase ?? DEFAULT_LEGIBILITY_POLICY.veilBase,
  };
}

// -----------------------------------------------------------------------------
// Output pins — the resolved variables, editable directly
// -----------------------------------------------------------------------------

export interface OutputKnob {
  key: "inkBoost" | "relief" | "glassAdd" | "veil" | "blur" | "tintL" | "tintC" | "tintH";
  label: string;
  min: number;
  max: number;
  step: number;
}

export const OUTPUT_KNOBS: OutputKnob[] = [
  { key: "inkBoost", label: "Ink boost", min: 0, max: 30, step: 1 },
  { key: "relief", label: "Relief", min: 0, max: 1, step: 0.05 },
  { key: "glassAdd", label: "Glass add", min: 0, max: 40, step: 1 },
  { key: "veil", label: "Reading veil", min: 0, max: 1, step: 0.01 },
  { key: "blur", label: "Reading blur (px)", min: 0, max: 120, step: 1 },
  { key: "tintL", label: "Tint L", min: 0.2, max: 0.9, step: 0.01 },
  { key: "tintC", label: "Tint C", min: 0, max: 0.25, step: 0.005 },
  { key: "tintH", label: "Tint H", min: 0, max: 360, step: 1 },
];

export type OutputPins = Partial<Record<OutputKnob["key"], number>> & { flip?: boolean };

export function readOutput(vars: LegibilityVars, key: OutputKnob["key"]): number {
  switch (key) {
    case "tintL":
      return vars.tint.l;
    case "tintC":
      return vars.tint.c;
    case "tintH":
      return vars.tint.h;
    default:
      return vars[key];
  }
}

export function applyPins(vars: LegibilityVars, pins: OutputPins): LegibilityVars {
  return {
    ...vars,
    inkBoost: pins.inkBoost ?? vars.inkBoost,
    relief: pins.relief ?? vars.relief,
    glassAdd: pins.glassAdd ?? vars.glassAdd,
    veil: pins.veil ?? vars.veil,
    blur: pins.blur ?? vars.blur,
    flip: pins.flip ?? vars.flip,
    tint: {
      l: pins.tintL ?? vars.tint.l,
      c: pins.tintC ?? vars.tint.c,
      h: pins.tintH ?? vars.tint.h,
    },
  };
}

/** The full pipeline for one profile: policy (with overrides) → pins. */
export function resolveForLab(params: {
  profile: WallpaperProfile;
  theme: Theme;
  reading: boolean;
  policy: LegibilityPolicy;
  pins: OutputPins;
}): LegibilityVars {
  return applyPins(
    resolveLegibility({
      profile: params.profile,
      theme: params.theme,
      reading: params.reading,
      policy: params.policy,
    }),
    params.pins,
  );
}

export function sameVars(a: LegibilityVars, b: LegibilityVars): boolean {
  return (
    a.inkBoost === b.inkBoost &&
    a.relief === b.relief &&
    a.glassAdd === b.glassAdd &&
    a.veil === b.veil &&
    a.blur === b.blur &&
    a.flip === b.flip &&
    a.tint.l === b.tint.l &&
    a.tint.c === b.tint.c &&
    a.tint.h === b.tint.h
  );
}

// -----------------------------------------------------------------------------
// Stylesheet inputs
// -----------------------------------------------------------------------------

export interface SheetKnob {
  name: string;
  label: string;
  /** How the value is written: a percentage or a bare number. */
  unit: "%" | "";
  min: number;
  max: number;
  step: number;
}

export interface SheetGroup {
  title: string;
  note?: string;
  knobs: SheetKnob[];
}

export const SHEET_GROUPS: SheetGroup[] = [
  {
    title: "Ink ladder",
    note: "Alpha of --ink. Primary is the ink itself; prose is foreground/85 at the call site.",
    knobs: [
      { name: "--ink-alpha-secondary", label: "Secondary", unit: "%", min: 20, max: 100, step: 1 },
      { name: "--ink-alpha-tertiary", label: "Tertiary", unit: "%", min: 5, max: 80, step: 1 },
      { name: "--ink-alpha-quaternary", label: "Quaternary", unit: "%", min: 2, max: 50, step: 1 },
      { name: "--ink-alpha-ring", label: "Focus ring", unit: "%", min: 10, max: 100, step: 1 },
    ],
  },
  {
    title: "Washes",
    note: "Fills that are ink at a few percent: kbd, hover, dividers.",
    knobs: [
      { name: "--wash-alpha-muted", label: "Muted", unit: "%", min: 0, max: 30, step: 1 },
      { name: "--wash-alpha-accent", label: "Accent (hover/selected)", unit: "%", min: 0, max: 40, step: 1 },
      { name: "--wash-alpha-border", label: "Border", unit: "%", min: 0, max: 40, step: 1 },
    ],
  },
  {
    title: "Relief shape",
    note: "Drop under light ink, halo under dark ink. Scaled by --wp-relief.",
    knobs: [
      { name: "--relief-drop-a1", label: "Drop · 0 1px 3px", unit: "", min: 0, max: 1, step: 0.05 },
      { name: "--relief-drop-a2", label: "Drop · 0 0 2px", unit: "", min: 0, max: 1, step: 0.05 },
      { name: "--relief-halo-a1", label: "Halo · 0 0 4px", unit: "", min: 0, max: 1, step: 0.05 },
      { name: "--relief-halo-a2", label: "Halo · 0 0 3px", unit: "", min: 0, max: 1, step: 0.05 },
      { name: "--glass-relief-k", label: "On glass ×", unit: "", min: 0, max: 1, step: 0.05 },
      { name: "--glass-relief-solid-k", label: "On sheet/popover ×", unit: "", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    title: "Glass fills",
    note: "The current material's ladder. Switch the material to edit the other.",
    knobs: [
      { name: "--glass-fill", label: "Glass", unit: "%", min: 0, max: 100, step: 1 },
      { name: "--glass-fill-raised", label: "Raised", unit: "%", min: 0, max: 100, step: 1 },
      { name: "--glass-fill-panel", label: "Panel", unit: "%", min: 0, max: 100, step: 1 },
      { name: "--glass-fill-popover", label: "Popover", unit: "%", min: 0, max: 100, step: 1 },
      { name: "--glass-fill-sheet", label: "Sheet", unit: "%", min: 0, max: 100, step: 1 },
      { name: "--glass-hover-step", label: "Hover step", unit: "%", min: 0, max: 40, step: 1 },
      { name: "--glass-dark-add", label: "Dark add", unit: "%", min: 0, max: 20, step: 1 },
      { name: "--glass-add-k", label: "Takes of --wp-glass-add ×", unit: "", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    title: "Tint amounts",
    note: "Zero is neutral. The Wallpaper tint setting raises both.",
    knobs: [
      { name: "--tint-glass", label: "On glass", unit: "%", min: 0, max: 60, step: 1 },
      { name: "--tint-accent", label: "On accent", unit: "%", min: 0, max: 80, step: 1 },
    ],
  },
];

export const SHEET_KNOBS = SHEET_GROUPS.flatMap((g) => g.knobs);

export type SheetOverrides = Record<string, number>;

export function formatSheetValue(knob: SheetKnob, value: number): string {
  return knob.unit === "%" ? `${value}%` : String(value);
}

/** Parse what `getComputedStyle` hands back for a knob: `54%` or `0.3`. */
export function parseSheetValue(raw: string): number | null {
  const n = parseFloat(raw.trim());
  return Number.isFinite(n) ? n : null;
}

// -----------------------------------------------------------------------------
// Session store — the sliders' state, kept while the tab lives
// -----------------------------------------------------------------------------

export const LAB_SESSION: {
  policy: PolicyOverrides;
  pins: OutputPins;
  sheet: SheetOverrides;
} = { policy: {}, pins: {}, sheet: {} };

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export function exportJson(params: {
  policy: PolicyOverrides;
  pins: OutputPins;
  sheet: SheetOverrides;
  resolved: LegibilityVars;
  wallpaper: string;
  theme: Theme;
  material: string;
  tint: string;
}): string {
  return JSON.stringify(params, null, 2);
}

export function exportCss(sheet: SheetOverrides): string {
  const lines = Object.entries(sheet).map(([name, value]) => {
    const knob = SHEET_KNOBS.find((k) => k.name === name);
    return `  ${name}: ${knob ? formatSheetValue(knob, value) : value};`;
  });
  return `:root {\n${lines.join("\n")}\n}\n`;
}
