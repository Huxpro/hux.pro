"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";

// =============================================================================
// Works flags — variants of /works, kept side by side for comparison.
//
// An exploration of the page is not merged as a second page or a switch the
// reader sees; it lands as a flag, off by default, that the DevTool's Works
// module turns on (systems/devtool/panel.tsx). Every flag off is the page as
// it ships, so a flag can sit on main for as long as the comparison takes.
//
// Adding one is two edits: an entry in `WORKS_FLAGS`, and a
// `useWorksFlag("<id>")` where it applies. The panel lists the registry, so
// it needs nothing.
//
// ## Where a flag's value comes from
//
// A **saved setting** (the panel's blue star): localStorage, the same shape
// as the reading settings (components/post/persisted-setting.ts). An A/B
// comparison is lived with, not glanced at — the owner reads the page with a
// variant on across reloads and days, then flips back — so a session
// override (amber, gone on reload) would be the wrong kind. Like the reading
// settings, it applies whether or not the devtool is on; the panel is only
// the switch. A visitor who never opened it has no value saved, which is
// every flag at its default.
//
// A **link** (`?flags=fold,resume`): the whole set of flags for that visit,
// the ones it names on and every other off — so a link reproduces one
// variant exactly, whatever the person opening it has saved, and `?flags=`
// on its own is the page as it ships. It is read, never written: /works
// keeps it through a chip tap (serializeViewState keeps what it does not
// own) and nothing puts it in the URL. That is what the site already does
// with a reading of the page (lib/log-view.ts), and it costs one param. In
// the panel it is a session override (amber); touching a switch takes the
// link out of the address, so what the panel shows is what the page is.
// =============================================================================

export interface WorksFlagSpec {
  id: string;
  /** The switch's label in the Works module. */
  label: Record<Locale, string>;
  /** One line under it: what the page does with the flag on. */
  description: Record<Locale, string>;
  /** Off, for every flag: off is the page as it ships. */
  default: boolean;
}

/**
 * The registry — every flag /works reads, in the order the panel lists
 * them. Boolean only: a variant is either on the page or not. (A flag that
 * needed a small enum would add its values here and a `PanelSegmented` in
 * the module; none has yet.)
 */
export const WORKS_FLAGS = [
  {
    id: "fold",
    label: { en: "Fold talks into projects", zh: "演讲归入项目" },
    description: {
      en: "A project's talks, press and posts fold under its row: one line that opens in place.",
      zh: "项目相关的演讲、报道与文章收在项目下方的一行里，点开原地展开。",
    },
    default: false,
  },
] as const satisfies readonly WorksFlagSpec[];

export type WorksFlagId = (typeof WORKS_FLAGS)[number]["id"];

export type WorksFlagValues = Readonly<Record<WorksFlagId, boolean>>;

export const WORKS_FLAG_DEFAULTS: WorksFlagValues = Object.fromEntries(
  WORKS_FLAGS.map((f) => [f.id, f.default]),
) as WorksFlagValues;

/** The query param a variant link carries. */
export const FLAGS_PARAM = "flags";

const STORAGE_KEY = "hux_works_flags";
const CHANGE_EVENT = "hux:works-flags";

function isFlagId(id: string): id is WorksFlagId {
  return WORKS_FLAGS.some((f) => f.id === id);
}

// ── Saved ────────────────────────────────────────────────────────────────────

// `useSyncExternalStore` wants the same object back while nothing changed,
// so the parse is cached on the raw string.
let savedRaw: string | null = null;
let savedValues: WorksFlagValues = WORKS_FLAG_DEFAULTS;

function readSaved(): WorksFlagValues {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return WORKS_FLAG_DEFAULTS;
  }
  if (raw === savedRaw) return savedValues;
  savedRaw = raw;
  let parsed: Record<string, unknown> = {};
  try {
    parsed = raw ? (JSON.parse(raw) ?? {}) : {};
  } catch {
    // A hand-edited value that is not JSON is no flags at all.
  }
  savedValues = Object.fromEntries(
    WORKS_FLAGS.map((f) => [
      f.id,
      typeof parsed[f.id] === "boolean" ? parsed[f.id] : f.default,
    ]),
  ) as WorksFlagValues;
  return savedValues;
}

/** Save a flag. Only what is off its default is written, so a reset is the
 *  key going away rather than a record of defaults. */
export function setWorksFlag(id: WorksFlagId, value: boolean): void {
  const next = { ...readSaved(), [id]: value };
  const diff = Object.fromEntries(
    WORKS_FLAGS.filter((f) => next[f.id] !== f.default).map((f) => [
      f.id,
      next[f.id],
    ]),
  );
  try {
    if (Object.keys(diff).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diff));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage unavailable — the event still updates this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// ── Linked ───────────────────────────────────────────────────────────────────

/** `?flags=` as the set of flags it turns on, or null when there is none. */
export function parseFlagsParam(
  raw: string | null,
): ReadonlySet<WorksFlagId> | null {
  if (raw === null) return null;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(isFlagId),
  );
}

// The link as /works last read it, for the panel — which lives outside the
// page and cannot read its query itself (`useSearchParams` wants a Suspense
// boundary the root layout does not have).
let linked: ReadonlySet<WorksFlagId> | null = null;

function publishLinked(next: ReadonlySet<WorksFlagId> | null): void {
  const key = (s: ReadonlySet<WorksFlagId> | null) =>
    s ? [...s].sort().join(",") : null;
  if (key(next) === key(linked)) return;
  linked = next;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Whether a flag is on for this reading of /works — the one way the page
 * reads a flag. The link wins over what is saved; the server, and a first
 * paint, see every flag at its default.
 *
 * Only for components under /works: it reads the page's query.
 */
export function useWorksFlag(id: WorksFlagId): boolean {
  const saved = useSyncExternalStore(
    subscribe,
    readSaved,
    () => WORKS_FLAG_DEFAULTS,
  );
  const raw = useSearchParams().get(FLAGS_PARAM);
  const fromLink = useMemo(() => parseFlagsParam(raw), [raw]);
  // Tell the panel what the page is reading, and take it back on the way
  // out: the link is this page's, not the site's.
  useEffect(() => {
    publishLinked(fromLink);
    return () => publishLinked(null);
  }, [fromLink]);
  return fromLink ? fromLink.has(id) : saved[id];
}

/** Both layers, for the panel: what is saved, and what a link on /works is
 *  overriding it with (null when there is no link). */
export function useWorksFlagState(): {
  saved: WorksFlagValues;
  linked: ReadonlySet<WorksFlagId> | null;
} {
  const saved = useSyncExternalStore(
    subscribe,
    readSaved,
    () => WORKS_FLAG_DEFAULTS,
  );
  const link = useSyncExternalStore(
    subscribe,
    () => linked,
    () => null,
  );
  return { saved, linked: link };
}
