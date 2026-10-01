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
// on its own is the page as it ships. An enum names its value after a colon
// (`?flags=fold,layout:side`). It is read, never written: /works
// keeps it through a chip tap (serializeViewState keeps what it does not
// own) and nothing puts it in the URL. That is what the site already does
// with a reading of the page (lib/log-view.ts), and it costs one param. In
// the panel it is a session override (amber); touching a switch takes the
// link out of the address, so what the panel shows is what the page is.
//
// ## Switches and enums
//
// A flag is a switch unless it lists `values`: then it is a small enum, one
// variant among a few that exclude each other (the rows' `layout` cannot be
// two layouts at once), and the panel draws a segmented choice instead of a
// switch. Its default is its first value, and that value is the page as it
// ships — so "off" still means one thing for every flag. Reach for an enum
// only when the variants are rivals; independent ideas are separate
// switches, so they can be combined.
// =============================================================================

interface WorksFlagCommon {
  id: string;
  /** The row's label in the Works module. */
  label: Record<Locale, string>;
  /** One line under it: what the page does with the flag on. */
  description: Record<Locale, string>;
}

/** A switch: the variant is on the page or it is not. */
export interface WorksSwitchSpec extends WorksFlagCommon {
  /** Off, for every switch: off is the page as it ships. */
  default: false;
}

/** One of an enum's values: its id (what a link names), its segment's
 *  short label in the panel, and the line the panel prints while it is
 *  the one chosen. */
export interface WorksFlagValueSpec {
  id: string;
  label: Record<Locale, string>;
  description: Record<Locale, string>;
}

/** A small enum: one of a few rival variants, the first being the page as
 *  it ships. */
export interface WorksEnumSpec extends WorksFlagCommon {
  values: readonly [WorksFlagValueSpec, ...WorksFlagValueSpec[]];
  /** The first value's id — its "off". */
  default: string;
  /**
   * Values the flag no longer has, each read as the one it became — so a
   * saved setting or a link naming one lands where it meant to, rather
   * than wherever the default happens to be.
   */
  retired?: Readonly<Record<string, string>>;
}

export type WorksFlagSpec = WorksSwitchSpec | WorksEnumSpec;

/**
 * The registry — every flag /works reads, in the order the panel lists
 * them. A switch unless it lists `values` (see "Switches and enums").
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
  {
    // How a row arranges its text and its picture (TimelineCommit,
    // `rowLayoutFor`). The index prints neither, and no value touches it.
    id: "layout",
    label: { en: "Row layout", zh: "行布局" },
    description: {
      en: "How a row arranges its title, description, venue and covers.",
      zh: "每一行如何安排标题、简介、出处与封面。",
    },
    values: [
      {
        id: "main",
        label: { en: "Main", zh: "现状" },
        description: {
          en: "As it ships: the title line with its venue and date, the description, a strip of covers.",
          zh: "现状：标题行带出处与日期，其下简介，再下一排封面。",
        },
      },
      {
        id: "side",
        label: { en: "Side", zh: "并排" },
        description: {
          en: "The text on the left, the covers as one deck beside it; a project's icon on the deck.",
          zh: "文字在左，封面叠成一摞放在右侧，项目图标贴在封面一角。",
        },
      },
      {
        id: "media-first",
        label: { en: "Media", zh: "图先" },
        description: {
          en: "The first cover leads across the column, a project's icon on its edge; the text follows.",
          zh: "首个封面通栏在前，项目图标压在其边缘，文字随后。",
        },
      },
      {
        id: "margin-meta",
        label: { en: "Margin", zh: "边栏" },
        description: {
          en: "A CV: the icon, when and where in the margin (over the title where there is none); what in the column.",
          zh: "像一份简历：图标、时间与出处在左侧边栏（无边栏时在标题上方），正文只留作品本身。",
        },
      },
      {
        id: "grid",
        label: { en: "Grid", zh: "宫格" },
        description: {
          en: "Each chapter as a contact sheet: two tiles a row — the cover, venue and date over the icon and title.",
          zh: "每章铺成宫格：一行两张——封面在上，出处与日期在图标与标题之上。",
        },
      },
    ],
    default: "main",
    // `ink-order` (title, description, then the venue as a byline) is
    // what main's row became, with the venue on the title line; its links
    // read as main.
    retired: { "ink-order": "main" },
  },
  {
    // The size of a row's description — the part of the row that says what
    // the work was (TimelineCommit, `BODY_SIZE`). Every layout.
    id: "body",
    label: { en: "Body size", zh: "正文字号" },
    description: {
      en: "The size a row's description is set at.",
      zh: "每行简介的字号。",
    },
    values: [
      {
        id: "xs",
        label: { en: "13", zh: "13" },
        description: {
          en: "13px, as it ships: the message under a heading, a half step under it.",
          zh: "13px，现状：标题下的正文，比标题小半号。",
        },
      },
      {
        id: "sm",
        label: { en: "14", zh: "14" },
        description: {
          en: "14px, the title's size; the title heads it by its medium weight.",
          zh: "14px，与标题同号；标题以中等字重领起。",
        },
      },
    ],
    default: "xs",
    // `13` was a step up from a 12px caption; main's message is 13px now,
    // which is `xs`.
    retired: { "13": "xs" },
  },
  {
    // How a deck of covers (`side`, `grid`) shows the covers behind its
    // front one on a desk (MediaStrip `deck`). A phone taps to the sheet.
    id: "deck",
    label: { en: "Deck", zh: "封面叠放" },
    description: {
      en: "How a deck shows the covers behind its front one, on a desk.",
      zh: "桌面端叠放的封面如何露出后面的几张。",
    },
    values: [
      {
        id: "click",
        label: { en: "Click", zh: "点开" },
        description: {
          en: "As built: the front cover, the edges and a count; a click opens them.",
          zh: "现状：只露首张、边缘与数量，点击打开。",
        },
      },
      {
        id: "fan",
        label: { en: "Fan", zh: "展开" },
        description: {
          en: "Hover or focus fans the deck out in place; each cover opens itself.",
          zh: "悬停或聚焦时原地展开，每张封面都可直接打开。",
        },
      },
      {
        id: "scrub",
        label: { en: "Scrub", zh: "拨看" },
        description: {
          en: "Moving across the deck turns its covers, as in Photos; arrows too.",
          zh: "指针横向划过时逐张切换，如同相册；方向键亦可。",
        },
      },
    ],
    default: "click",
  },
] as const satisfies readonly WorksFlagSpec[];

export type WorksFlagId = (typeof WORKS_FLAGS)[number]["id"];

type SpecOf<I extends WorksFlagId> = Extract<
  (typeof WORKS_FLAGS)[number],
  { id: I }
>;

/** What a flag reads as: a switch's boolean, or one of an enum's value ids. */
export type WorksFlagValue<I extends WorksFlagId> = I extends WorksFlagId
  ? SpecOf<I> extends { values: readonly (infer V)[] }
    ? V extends { id: infer Id }
      ? Id
      : never
    : boolean
  : never;

export type WorksFlagValues = Readonly<{
  [I in WorksFlagId]: WorksFlagValue<I>;
}>;

/** The `layout` flag's values: how a row arranges itself (TimelineCommit). */
export type RowLayout = WorksFlagValue<"layout">;
/** The `body` flag's values: the description's size (TimelineCommit). */
export type BodySize = WorksFlagValue<"body">;
/** The `deck` flag's values: how a deck opens up on a desk (MediaStrip). */
export type DeckMode = WorksFlagValue<"deck">;

export const WORKS_FLAG_DEFAULTS: WorksFlagValues = Object.fromEntries(
  WORKS_FLAGS.map((f) => [f.id, f.default]),
) as unknown as WorksFlagValues;

/** A stored or linked value, if it is one this flag can take. */
function validValue(
  flag: WorksFlagSpec,
  value: unknown,
): boolean | string | undefined {
  if ("values" in flag) {
    if (flag.values.some((v) => v.id === value)) return value as string;
    const retired = "retired" in flag ? flag.retired : undefined;
    return typeof value === "string" && retired && Object.hasOwn(retired, value)
      ? retired[value]
      : undefined;
  }
  return typeof value === "boolean" ? value : undefined;
}

/** The query param a variant link carries. */
export const FLAGS_PARAM = "flags";

const STORAGE_KEY = "hux_works_flags";
const CHANGE_EVENT = "hux:works-flags";

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
    WORKS_FLAGS.map((f) => [f.id, validValue(f, parsed[f.id]) ?? f.default]),
  ) as unknown as WorksFlagValues;
  return savedValues;
}

/** Save a flag. Only what is off its default is written, so a reset is the
 *  key going away rather than a record of defaults. */
export function setWorksFlag<I extends WorksFlagId>(
  id: I,
  value: WorksFlagValue<I>,
): void {
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

/**
 * `?flags=` as the values it sets, or null when there is none. A switch it
 * names is on; an enum takes the value after the colon (`layout:side`).
 * Whatever it does not name — or names with a value the flag does not have
 * — is at its default.
 */
export function parseFlagsParam(raw: string | null): WorksFlagValues | null {
  if (raw === null) return null;
  const named = new Map(
    raw.split(",").map((s) => {
      const [id, value] = s.trim().split(":");
      return [id, value] as const;
    }),
  );
  return Object.fromEntries(
    WORKS_FLAGS.map((f) => {
      if (!named.has(f.id)) return [f.id, f.default];
      const value = "values" in f ? validValue(f, named.get(f.id)) : true;
      return [f.id, value ?? f.default];
    }),
  ) as unknown as WorksFlagValues;
}

/** A set of values as a link would write it — what is off its default, in
 *  registry order — so two sets compare as strings. */
function linkKey(values: WorksFlagValues | null): string | null {
  if (!values) return null;
  return WORKS_FLAGS.filter((f) => values[f.id] !== f.default)
    .map((f) => ("values" in f ? `${f.id}:${values[f.id]}` : f.id))
    .join(",");
}

// The link as /works last read it, for the panel — which lives outside the
// page and cannot read its query itself (`useSearchParams` wants a Suspense
// boundary the root layout does not have).
let linked: WorksFlagValues | null = null;

function publishLinked(next: WorksFlagValues | null): void {
  if (linkKey(next) === linkKey(linked)) return;
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
 * A flag's value for this reading of /works — whether a switch is on, which
 * of an enum's values is chosen — and the one way the page reads a flag. The link wins over what is saved; the server, and a first
 * paint, see every flag at its default.
 *
 * Only for components under /works: it reads the page's query.
 */
export function useWorksFlag<I extends WorksFlagId>(
  id: I,
): WorksFlagValue<I> {
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
  return (fromLink ?? saved)[id];
}

/** Both layers, for the panel: what is saved, and what a link on /works is
 *  overriding it with (null when there is no link). */
export function useWorksFlagState(): {
  saved: WorksFlagValues;
  linked: WorksFlagValues | null;
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
