import { isAskPlacement, type AskPlacement } from "@/systems/command/provider";
// Deep import on purpose: presentation.ts depends on nothing but React, and
// the command provider reads this file.
import { SURFACE_BREAKPOINTS, useBreakpointValue } from "@/systems/surface/presentation";
import { useSyncExternalStore } from "react";
import { readJSON, writeJSON } from "./storage";

// =============================================================================
// How Ask behaves: every choice the surfaces make, in one place, with a
// preset per platform.
//
// Ask grew variations while its shape was being found (where it opens, what
// minimize does, whether it can be dragged, when the listening glow comes
// up). Each one is a setting here rather than a branch in a component, so the
// devtool can show what the defaults are and change any of them (systems/
// devtool, "Ask"). Everything is configurable on every platform; what differs
// between a desk and a phone is only the preset:
//
//   desk   three places (center, side, top) and the Dock's pill. Which one
//          opens is the moment, not a button: asking from the palette morphs
//          the card into the center chat; a call on a page to read opens the
//          side. The header drags between them (no place buttons), minimize
//          puts it away into the Dock, and a reply still being written after
//          Ask closes shows there.
//   phone  one bottom drawer. Ask is big and stays a while, which is a
//          drawer's job; the Dock's Live Activity is for small things in
//          passing. No place buttons, no minimize (a swipe down closes it,
//          the conversation kept), no pill.
//
// A platform is the surfaces' `sm`: under it, a phone. Overrides are saved
// per platform (`hux_ask_config`), only where they differ from the preset,
// so a preset changed in code reaches everyone who has not chosen otherwise.
// =============================================================================

export type AskPlatform = "desk" | "phone";

export interface AskConfig {
  /** Where asking from search (the palette's Ask row, Tab) opens Ask. */
  fromSearch: AskPlacement;
  /** Where a call with nothing typed (the Ask button, ⌘J) opens Ask, on a
   *  page that is not being read: where it was last put by the place buttons
   *  (when those are on), or always one place. A page being read is the side
   *  (`onReadingPage`), and asking from the palette is the center. */
  fromCall: "last" | AskPlacement;
  /** On a page to read (/writing, /works, /prompt, /about, /docs), a call
   *  opens Ask beside it. Asking from the palette still morphs the card. */
  onReadingPage: "side" | "same";
  /** The place buttons in Ask's header. Off: dragging the header is how Ask
   *  moves, and where it opens follows the moment rather than a saved choice. */
  placeButtons: boolean;
  /** Ask's header as a handle, to drag it between places (a mouse). */
  drag: boolean;
  /** What minimize does: put Ask away into the Dock as a pill, or nothing
   *  (no minimize button; the Dock's collapse closes Ask). */
  minimize: "dock" | "off";
  /** A reply still being written after Ask was closed shows a pill in the
   *  Dock, so the answer is a tap away. */
  backgroundPill: boolean;
  /** How long the field listens before the glow comes up, ms: a glow on
   *  the first instant reads as a flash, and a beat later as an answer. */
  glowDelay: number;
  /** How much longer when a keyboard is going down, ms: the system's slide
   *  and the glow's first frames together drop frames on a phone. */
  keyboardDelay: number;
}

export const ASK_PRESETS: Record<AskPlatform, AskConfig> = {
  desk: {
    fromSearch: "center",
    fromCall: "center",
    onReadingPage: "side",
    placeButtons: false,
    drag: true,
    minimize: "dock",
    backgroundPill: true,
    glowDelay: 180,
    keyboardDelay: 0,
  },
  phone: {
    fromSearch: "center",
    fromCall: "center",
    onReadingPage: "same",
    placeButtons: false,
    drag: false,
    minimize: "off",
    backgroundPill: false,
    glowDelay: 180,
    keyboardDelay: 320,
  },
};

export type AskConfigKey = keyof AskConfig;
export type AskOverrides = Record<AskPlatform, Partial<AskConfig>>;

const STORAGE_KEY = "hux_ask_config";

/** Whether a saved value is one the key can take; anything else is dropped. */
function valid<K extends AskConfigKey>(key: K, value: unknown): value is AskConfig[K] {
  switch (key) {
    case "fromSearch":
      return isAskPlacement(value);
    case "fromCall":
      return value === "last" || isAskPlacement(value);
    case "minimize":
      return value === "dock" || value === "off";
    case "onReadingPage":
      return value === "side" || value === "same";
    case "glowDelay":
    case "keyboardDelay":
      return typeof value === "number" && value >= 0 && value <= 2000;
    default:
      return typeof value === "boolean";
  }
}

const EMPTY: AskOverrides = { desk: {}, phone: {} };
let overrides: AskOverrides | null = null;
const listeners = new Set<() => void>();

function read(): AskOverrides {
  if (overrides) return overrides;
  if (typeof window === "undefined") return EMPTY;
  const next: AskOverrides = { desk: {}, phone: {} };
  const raw = readJSON(STORAGE_KEY) as Partial<Record<AskPlatform, Record<string, unknown>>> | undefined;
  for (const platform of ["desk", "phone"] as const) {
    for (const [key, value] of Object.entries(raw?.[platform] ?? {})) {
      if (key in ASK_PRESETS[platform] && valid(key as AskConfigKey, value)) {
        (next[platform] as Record<string, unknown>)[key] = value;
      }
    }
  }
  overrides = next;
  return next;
}

function write(next: AskOverrides) {
  overrides = next;
  writeJSON(STORAGE_KEY, next);
  listeners.forEach((l) => l());
}

export function subscribeAskConfig(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Change one setting for one platform. The preset's own value clears the
 *  override rather than saving a copy of it. */
export function setAskConfig<K extends AskConfigKey>(platform: AskPlatform, key: K, value: AskConfig[K]) {
  const current = read();
  const mine = { ...current[platform] };
  if (value === ASK_PRESETS[platform][key]) delete mine[key];
  else mine[key] = value;
  write({ ...current, [platform]: mine });
}

/** Back to the preset: one setting, one platform, or everything. */
export function resetAskConfig(platform?: AskPlatform, key?: AskConfigKey) {
  const current = read();
  if (!platform) return write({ desk: {}, phone: {} });
  const mine = { ...current[platform] };
  if (key) delete mine[key];
  write({ ...current, [platform]: key ? mine : {} });
}

const resolved = new Map<AskOverrides, Record<AskPlatform, AskConfig>>();

/** The preset with the overrides on it, the same object until they change. */
export function askConfigOf(platform: AskPlatform): AskConfig {
  const current = read();
  let both = resolved.get(current);
  if (!both) {
    resolved.clear();
    both = {
      desk: { ...ASK_PRESETS.desk, ...current.desk },
      phone: { ...ASK_PRESETS.phone, ...current.phone },
    };
    resolved.set(current, both);
  }
  return both[platform];
}

/** The platform this viewport is, now: for event handlers. */
export function askPlatformNow(): AskPlatform {
  return typeof window !== "undefined" && window.innerWidth < SURFACE_BREAKPOINTS.sm
    ? "phone"
    : "desk";
}

/** This viewport's settings, now: for event handlers. */
export function askConfigNow(): AskConfig {
  return askConfigOf(askPlatformNow());
}

const PLATFORM = { base: "phone", sm: "desk" } as const;

/** The platform this viewport is, following the window as it resizes. */
export function useAskPlatform(): AskPlatform {
  return useBreakpointValue<AskPlatform>(PLATFORM);
}

/** This viewport's settings, following both the window and the devtool. */
export function useAskConfig(): AskConfig {
  const platform = useAskPlatform();
  return useSyncExternalStore(
    subscribeAskConfig,
    () => askConfigOf(platform),
    () => ASK_PRESETS[platform],
  );
}

/** The overrides, for the devtool. */
export function useAskOverrides(): AskOverrides {
  return useSyncExternalStore(subscribeAskConfig, read, () => EMPTY);
}
