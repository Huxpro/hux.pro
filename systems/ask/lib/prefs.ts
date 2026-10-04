import {
  askEffortOf,
  askModelOf,
  DEFAULT_ASK_EFFORT,
  DEFAULT_ASK_MODEL,
  type AskEffort,
} from "./models";

// =============================================================================
// The visitor's picks: which model, how hard it thinks. Per-viewer
// conveniences, remembered where storage allows. Their own module, with
// nothing of the AI SDK, so the devtool can show and reset them (lib/config.ts
// is the rest of what it shows) without loading the chat.
// =============================================================================

const MODEL_KEY = "hux_ask_model";
const EFFORT_KEY = "hux_ask_effort";

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private window, blocked): the pick lasts the page.
  }
}

let model: string | null = null;
let effort: AskEffort | null = null;
const listeners = new Set<() => void>();

export function subscribeAskPrefs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The picked model. */
export function getAskModel(): string {
  if (typeof window === "undefined") return DEFAULT_ASK_MODEL;
  model ??= askModelOf(readPref(MODEL_KEY) ?? DEFAULT_ASK_MODEL).id;
  return model;
}

/** Pick a model; `null` goes back to the default (and forgets the pick). */
export function setAskModel(id: string | null) {
  model = id === null ? DEFAULT_ASK_MODEL : askModelOf(id).id;
  writePref(MODEL_KEY, id === null ? null : model);
  listeners.forEach((l) => l());
}

export function getAskEffort(): AskEffort {
  if (typeof window === "undefined") return DEFAULT_ASK_EFFORT;
  effort ??= askEffortOf(readPref(EFFORT_KEY) ?? DEFAULT_ASK_EFFORT);
  return effort;
}

export function setAskEffort(value: string | null) {
  effort = value === null ? DEFAULT_ASK_EFFORT : askEffortOf(value);
  writePref(EFFORT_KEY, value === null ? null : effort);
  listeners.forEach((l) => l());
}
