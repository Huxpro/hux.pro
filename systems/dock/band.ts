"use client";

import { useSyncExternalStore } from "react";
import { SURFACE_BREAKPOINTS } from "@/systems/surface/presentation";

// =============================================================================
// The top band: how the Dock and a page's pinned bar share the top strip.
//
// A page's pinned bar (PinnedSlot: /works and /prompt's toolbars, a lab's own
// bar) and the Dock's occupants (Live Activities, parked windows) both reach
// for the top of the screen. How they share it is not one fixed policy but a
// composition of independent choices, set here and read by the real
// components (the Dock, every LiveActivity, the parked windows and the
// pinned slot). What the Band Lab (/lab/band) shows is therefore the site
// itself.
//
//   share       Whether a pinned bar shares the band at all. Off is the old
//               way: the pills centred, the bar pinned in a row under them.
//   group       How the occupants stand beside the bar:
//                 all    in one row after the bar
//                 tray   in a window of a fixed size at the column's end,
//                        scrolling inside itself
//                 count  folded into one ball showing how many; opening it
//                        folds the bar away and lays them out instead
//   form        Their shape while sharing: a pill, or a ball of what leads it.
//   openForm    Their shape when a count is opened (the bar is out of the way
//               then, so pills have room; or they stay balls when there are
//               many).
//   trayCap     How many a tray shows whole, on a phone (two more wider).
//   peek        A window that holds more than it shows ends on half of the
//               next. The cut is what shows it scrolls.
//   barScrolls  (all) The bar rides in the scrolling strip: one row, the bar
//               first, sliding away as the occupants scroll in.
//
// Every one of these is an *overflow* strategy. While the bar at its own
// width and every occupant as a pill fit the band side by side, they sit
// side by side (the occupants after the bar, a gap from its glass) whatever
// is configured. A wide screen is never folded for a phone's sake.
// Only what does not fit is worked on, in order: the occupants become balls
// (if `form` says so) and, if that is not enough, the group takes over.
//
// The site's old names are presets of these (PRESETS). What ships is
// `DEFAULT_CONFIG`, either / or: side by side while it fits, balls when it
// does not quite, a count when it does not at all. Anything else is a session
// override the lab sets (sessionStorage: this tab, until it closes), so a
// visitor never meets an experiment.
//
// A configuration only applies once the bar has *met* the band, meaning it
// has risen with the page to where the Dock is. Until then, and on every page
// without a pinned bar, the Dock behaves as it always has.
//
// Where everything stands is one function, `bandGeometry`, read by both the
// Dock and the pinned slot, so the two can never disagree about a pixel.
// =============================================================================

export type BandGroup = "all" | "tray" | "count";
export type BandForm = "pill" | "ball";

export interface BandConfig {
  share: boolean;
  group: BandGroup;
  form: BandForm;
  openForm: BandForm;
  trayCap: number;
  peek: boolean;
  barScrolls: boolean;
}

export type PresetId = "stack" | "tray" | "scroll" | "swap";

const BASE: BandConfig = {
  share: true,
  group: "all",
  form: "ball",
  openForm: "pill",
  trayCap: 2,
  peek: true,
  barScrolls: false,
};

export const PRESETS: Record<PresetId, BandConfig> = {
  stack: { ...BASE, share: false, form: "pill" },
  tray: { ...BASE, group: "tray" },
  scroll: { ...BASE, barScrolls: true },
  swap: { ...BASE, group: "count" },
};

/** What ships: share the band, and fold to a count only on overflow. */
const DEFAULT_CONFIG: BandConfig = PRESETS.swap;

function sameConfig(a: BandConfig, b: BandConfig) {
  return (Object.keys(a) as (keyof BandConfig)[]).every((k) => a[k] === b[k]);
}

/** The preset a config is, if it is one. Not sharing is stack, whatever else. */
export function presetOf(config: BandConfig): PresetId | null {
  if (!config.share) return "stack";
  return (Object.keys(PRESETS) as PresetId[]).find((id) => sameConfig(PRESETS[id], config)) ?? null;
}

export interface BandState {
  config: BandConfig;
  /** The viewport's width: the band is laid out for this screen. */
  vw: number;
  /** A page's pinned bar has risen to the band. */
  met: boolean;
  /** Count: opened. The occupants hold the band and the bar is folded. */
  open: boolean;
  /** How many sample Live Activities the lab has put in the Dock. */
  samples: number;
  /** The Dock's occupants' widths as pills, measured, in row order. */
  naturals: number[];
  /** How far down the Dock's pills reach (`--dock-clear`), 0 with none. */
  clear: number;
  /**
   * The pinned bar, as its slot measures it: the box it lives in (viewport
   * px; the page column for /works and /prompt, a lab's own frame for a
   * lab bar), how far its glass reaches past its row sideways, and its row
   * at natural width and at the least it can do its job in.
   */
  bar: { left: number; right: number; outset: number; natural: number; min: number } | null;
}

const CONFIG_KEY = "hux_band_config";
const SAMPLES_KEY = "hux_band_samples";
export const MAX_SAMPLES = 6;

function load<T>(key: string, parse: (v: string) => T | null, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.sessionStorage.getItem(key);
    return v === null ? fallback : (parse(v) ?? fallback);
  } catch {
    return fallback;
  }
}

function save(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Private mode and the like: the override lasts the page instead.
  }
}

function parseConfig(v: string): BandConfig | null {
  try {
    return { ...DEFAULT_CONFIG, ...(JSON.parse(v) as Partial<BandConfig>) };
  } catch {
    return null;
  }
}

// The server lays out for a phone, the tightest case.
const SERVER: BandState = {
  config: DEFAULT_CONFIG,
  vw: 390,
  met: false,
  open: false,
  samples: 0,
  naturals: [],
  clear: 0,
  bar: null,
};
let state: BandState | null = null;
const listeners = new Set<() => void>();

function current(): BandState {
  if (state === null) {
    state = {
      ...SERVER,
      config: load(CONFIG_KEY, parseConfig, DEFAULT_CONFIG),
      vw: window.innerWidth,
      samples: load(SAMPLES_KEY, (v) => (/^\d$/.test(v) ? Math.min(MAX_SAMPLES, Number(v)) : null), 0),
    };
  }
  return state;
}

function set(patch: Partial<BandState>) {
  const next = { ...current(), ...patch };
  // Opened only while there is a count to open: the bar has met the band,
  // the band counts, and what it would count does not simply fit.
  if (next.open && bandGeometry(next).mode !== "open") next.open = false;
  state = next;
  for (const listener of listeners) listener();
}

const onResize = () => {
  if (current().vw !== window.innerWidth) set({ vw: window.innerWidth });
};

/** For effects that follow the band outside React (PinnedSlot's meet check). */
export function subscribeBand(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("resize", onResize);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("resize", onResize);
  };
}

/** The band as it is now, outside React. */
export function readBand(): BandState {
  return current();
}

export function useBand(): BandState {
  return useSyncExternalStore(subscribeBand, current, () => SERVER);
}

// One geometry per state, so every reader of the same state gets the same
// object, and a selector over it can return the same primitive.
let memoFor: BandState | null = null;
let memo: BandGeometry | null = null;
function geometryOf(band: BandState): BandGeometry {
  if (band !== memoFor || memo === null) {
    memoFor = band;
    memo = bandGeometry(band);
  }
  return memo;
}

/** The band's geometry for this screen, live. */
export function useBandGeometry(): BandGeometry {
  return useSyncExternalStore(
    subscribeBand,
    () => geometryOf(current()),
    () => geometryOf(SERVER),
  );
}

/**
 * One fact about the band, live. For a reader that needs a shape or a flag
 * and should not re-render when anything else about the band moves (every
 * Live Activity's drawer, on every resize). Return a primitive.
 */
export function useBandSelect<T>(select: (geometry: BandGeometry, band: BandState) => T): T {
  return useSyncExternalStore(
    subscribeBand,
    () => select(geometryOf(current()), current()),
    () => select(geometryOf(SERVER), SERVER),
  );
}

/** The lab's switch. Back to what ships clears the override. */
export function setBandConfig(patch: Partial<BandConfig>) {
  const config = { ...current().config, ...patch };
  save(CONFIG_KEY, sameConfig(config, DEFAULT_CONFIG) ? null : JSON.stringify(config));
  set({ config });
}

export function setBandMet(met: boolean) {
  if (current().met !== met) set({ met });
}

export function setBandOpen(open: boolean) {
  if (current().open !== open) set({ open });
}

export function setBandSamples(samples: number) {
  const n = Math.max(0, Math.min(MAX_SAMPLES, Math.round(samples)));
  save(SAMPLES_KEY, n === 0 ? null : String(n));
  set({ samples: n });
}

/** The Dock's measurements: its occupants' widths as pills, and how far down they reach. */
export function setBandDock(naturals: number[], clear: number) {
  const prev = current();
  if (
    prev.clear === clear &&
    prev.naturals.length === naturals.length &&
    prev.naturals.every((w, i) => w === naturals[i])
  )
    return;
  set({ naturals, clear });
}

export function setBandBar(bar: BandState["bar"]) {
  const prev = current().bar;
  if (prev === bar) return;
  if (prev && bar && (Object.keys(bar) as (keyof typeof bar)[]).every((k) => prev[k] === bar[k])) return;
  set({ bar });
}

// --- Geometry -------------------------------------------------------------

/** A ball's diameter, a pill's height; the gap in a row. */
export const CAPSULE = 36;
export const GAP = 8;
/** How far a pinned bar's glass reaches past its row, sideways (`--pin-outset-x`). */
export const OUTSET_X = 10;
const GUTTER = 24;
/** A gutter this thin or thinner is a phone's: the band runs to the edge. */
const BLEED_MAX = 32;
const COLUMN = 680;

export type BandMode = "stack" | "fit" | "all" | "tray" | "count" | "open";

export interface BandGeometry {
  /** `count` is the occupants out of sight behind their count. */
  mode: BandMode;
  /** What each occupant is drawn as right now. */
  form: BandForm;
  /**
   * The occupants' window, in viewport px: exactly where they may be seen,
   * and where the row clips, so nothing slides under the bar, the gutter or
   * the folded ball. Null in stack, which centres itself as it always has.
   */
  window: { left: number; width: number; padStart: number; padEnd: number } | null;
  /** Whether the bar rides in the occupants' strip (`barScrolls`, in use). */
  rides: boolean;
  /**
   * Width taken from the end of the bar's row (its `--band-reserve`): the
   * window, the gap, and the reach of the bar's glass past its row. That way
   * the glass, not the text, ends a gap before the first occupant.
   */
  reserve: number;
}

function column(vw: number) {
  const bleed = Math.max(GUTTER, (vw - COLUMN) / 2 + GUTTER);
  return { left: bleed, right: vw - bleed };
}

/** A row of these widths, a gap between each. */
export function strip(widths: number[]) {
  return widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * GAP;
}

/** The mode the configuration asks for, before asking whether it is needed. */
function configuredMode(band: BandState): BandMode {
  const { config, met, open } = band;
  if (!config.share || !met || band.naturals.length === 0) return "stack";
  if (config.group === "count") return open ? "open" : "count";
  return config.group;
}

export function bandGeometry(band: BandState): BandGeometry {
  const { config, naturals, vw } = band;
  const n = naturals.length;
  // The box the bar lives in is the band's column: occupants end at its right
  // edge, and the bar's glass starts its reach before its left.
  const col = band.bar ? { left: band.bar.left, right: band.bar.right } : column(vw);
  const outset = band.bar?.outset ?? OUTSET_X;
  const glassLeft = col.left - outset;
  const base: BandGeometry = { mode: "stack", form: "pill", window: null, rides: false, reserve: 0 };
  const asked = configuredMode(band);
  if (asked === "stack") return base;

  // The least the bar's glass may be: its minimum, or all of it if it has none.
  const barMinGlass = band.bar ? band.bar.min + 2 * outset : 0;
  const barGlass = band.bar ? band.bar.natural + 2 * outset : 0;

  // Fit: the bar at its own width, then the occupants with no window to
  // scroll and nothing folded. They go as pills, or as balls if the
  // configuration allows and pills do not fit. Left-aligned after the bar,
  // where the eye already is, rather than pushed to the column's far end.
  // The occupants are the screen's, not the column's: side by side they may
  // run on into the margin a wide screen leaves beside it, up to the gutter.
  const span = Math.max(col.right, vw - GUTTER) - glassLeft;
  const tries: BandForm[] = config.form === "ball" ? ["pill", "ball"] : ["pill"];
  for (const f of tries) {
    const c = strip(naturals.map((w) => (f === "ball" ? CAPSULE : w)));
    if (barGlass + GAP + c <= span + 0.5) {
      const left = glassLeft + barGlass + GAP;
      return {
        ...base,
        mode: "fit",
        form: f,
        window: { left, width: c, padStart: 0, padEnd: 0 },
        // The bar keeps its whole width: what it gives is only what it
        // was not using.
        reserve: Math.max(0, col.right - (glassLeft + barGlass) + outset),
      };
    }
  }

  const form: BandForm = asked === "open" ? config.openForm : config.form;
  const widths = naturals.map((w) => (form === "ball" ? CAPSULE : w));
  // A count earns its place by saving room: what it would hide must be
  // wider than the ball that counts it. Otherwise it is a tray.
  const counts = strip(widths) > CAPSULE;
  const mode: BandMode = (asked === "count" || asked === "open") && !counts ? "tray" : asked;

  if (mode === "count") {
    // One ball at the column's end; the bar gives up it and a gap. The
    // occupants wait, out of sight, in the ball's own place, so opening it
    // grows the row out of the ball instead of from somewhere else.
    return {
      ...base,
      mode,
      form,
      window: { left: col.right - CAPSULE, width: CAPSULE, padStart: 0, padEnd: 0 },
      reserve: CAPSULE + GAP + outset,
    };
  }

  if (mode === "open") {
    // The bar is folded to a ball at its own start; the occupants fill the
    // rest of the band, scrolling edge to edge. The window runs on to the
    // screen's edge and keeps the gutter as padding inside itself, so a swipe
    // is not cut off at the column.
    const left = glassLeft + CAPSULE + GAP;
    return { ...base, mode, form, window: { left, width: vw - left, padStart: 0, padEnd: vw - col.right } };
  }

  if (mode === "all" && config.barScrolls) {
    // One strip, edge to edge: the bar first (it follows the strip's scroll),
    // then the occupants. The bar keeps its width but leaves the first
    // occupant showing beside it; the rest are a swipe away.
    const glass = Math.max(barMinGlass, Math.min(barGlass, col.right - glassLeft - widths[0] - GAP));
    const padStart = glassLeft + glass + GAP;
    return {
      ...base,
      mode,
      form,
      window: { left: 0, width: vw, padStart, padEnd: vw - col.right },
      rides: true,
      // The bar ends where its glass was given room to: its row stops the
      // glass's reach short of that.
      reserve: col.right - (glassLeft + glass) + outset,
    };
  }

  // all / tray: a window at the column's end; the bar gives up its width.
  // On a phone the gutter is too thin to be a margin worth keeping, so the
  // window runs on to the screen's edge. The next occupant is cut there by
  // the phone's own edge rather than by a straight line mid-screen, and the
  // cut is what shows it scrolls. Wider, the window stops at the column.
  const bleeds = vw - col.right <= BLEED_MAX;
  const edge = bleeds ? vw : col.right;
  // What the bar can give, and never less than one whole occupant: the bar
  // may go under its minimum before an occupant goes out of reach.
  const room = Math.max(widths[0], col.right - glassLeft - barMinGlass - GAP);
  let shown = mode === "tray" ? Math.min(n, config.trayCap + (vw >= SURFACE_BREAKPOINTS.sm ? 2 : 0)) : n;
  while (shown > 1 && strip(widths.slice(0, shown)) > room) shown--;
  let inColumn = strip(widths.slice(0, shown));
  // A peek is half of the next showing where the window ends: what the
  // gutter shows of it already counts, and the column gives the rest.
  if (n > shown && config.peek)
    inColumn = Math.min(room, inColumn + Math.max(0, GAP + widths[shown] / 2 - (edge - col.right)));
  const left = col.right - inColumn;
  return {
    ...base,
    mode,
    form,
    window: { left, width: edge - left, padStart: 0, padEnd: edge - col.right },
    reserve: inColumn + GAP + outset,
  };
}
