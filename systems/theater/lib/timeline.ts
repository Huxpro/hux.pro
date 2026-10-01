// =============================================================================
// Theater System — the timeline
//
// The library laid along time: every recording and deck as a mark at the
// month it was given, on one of two lanes by the language it was given in.
// The tour map says where; this says when, and for how long — a recording's
// mark is sized by its running time, a deck is a ring.
//
// A piece told in both languages is two marks, one per lane, joined: the
// same talk, given twice.
//
// The axis is not linear in time. A year with nothing in it (2018–2020, the
// years at Meta between talks) gets a sliver; a year with six talks gets the
// room to tell them apart. Every year is still on it, in order — the gaps
// are part of the story, they just do not need to be wide to be seen.
// =============================================================================

import type { Locale } from "@/lib/i18n";
import { buildLibrary, entryToTrack, entryVersions } from "./library";
import type { Track, TrackLanguage, TrackVersion } from "./types";

/** Room a year gets with nothing in it, and per mark it holds. */
const YEAR_BASE = 26;
const YEAR_PER_MARK = 26;
/** Closest two marks on one lane may sit, centre to centre. */
const MIN_GAP = 14;

export interface Mark {
  /** The version's media identity — unique across the timeline. */
  key: string;
  entryId: string;
  lane: TrackLanguage;
  version: TrackVersion;
  /** The entry as a track wearing this version — for covers and chips. */
  track: Track;
  year: number;
  /** Centre, in px from the timeline's start. */
  x: number;
}

export interface YearSpan {
  year: number;
  x: number;
  width: number;
}

export interface Timeline {
  /** Oldest first. */
  marks: Mark[];
  years: YearSpan[];
  width: number;
  /** The two lanes, the viewer's language first. */
  lanes: TrackLanguage[];
  /** Marks that are the same piece in the other language. */
  pairs: [Mark, Mark][];
}

function monthOf(date: string | undefined): number {
  const m = Number(date?.slice(5, 7));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : 6;
}

export function buildTimeline(locale: Locale): Timeline {
  const lanes: TrackLanguage[] = locale === "zh" ? ["zh", "en"] : ["en", "zh"];
  const draft: Omit<Mark, "x">[] = [];
  const pairs: [string, string][] = [];

  for (const entry of buildLibrary(locale)) {
    const versions = entryVersions(entry, locale);
    for (const version of versions) {
      const lane = version.language ?? locale;
      draft.push({
        key: version.key,
        entryId: entry.id,
        lane,
        version,
        track: entryToTrack(entry, locale, lane),
        year: Number((version.date ?? entry.date).slice(0, 4)),
      });
    }
    if (versions.length > 1) pairs.push([versions[0].key, versions[1].key]);
  }
  if (draft.length === 0) {
    return { marks: [], years: [], width: 0, lanes, pairs: [] };
  }

  draft.sort((a, b) =>
    (a.version.date ?? "").localeCompare(b.version.date ?? ""),
  );

  // Years: every one from the first to the last, each as wide as it is full.
  const first = draft[0].year;
  const last = draft[draft.length - 1].year;
  const years: YearSpan[] = [];
  let at = 0;
  for (let y = first; y <= last; y++) {
    const n = draft.filter((m) => m.year === y).length;
    const width = YEAR_BASE + YEAR_PER_MARK * n;
    years.push({ year: y, x: at, width });
    at += width;
  }

  // Marks at their month within their year, then nudged apart on each lane.
  const marks: Mark[] = draft.map((m) => {
    const span = years[m.year - first];
    return { ...m, x: span.x + ((monthOf(m.version.date) - 0.5) / 12) * span.width };
  });
  for (const lane of lanes) {
    let prev = -Infinity;
    for (const m of marks.filter((k) => k.lane === lane)) {
      if (m.x - prev < MIN_GAP) m.x = prev + MIN_GAP;
      prev = m.x;
    }
  }
  const width = Math.max(at, ...marks.map((m) => m.x + MIN_GAP));

  const byKey = new Map(marks.map((m) => [m.key, m]));
  return {
    marks,
    years,
    width,
    lanes,
    pairs: pairs
      .map(([a, b]) => [byKey.get(a), byKey.get(b)] as const)
      .filter((p): p is readonly [Mark, Mark] => !!p[0] && !!p[1])
      .map(([a, b]) => [a, b]),
  };
}

/** The mark the timeline opens on: the latest the viewer can hear. */
export function latestMark(t: Timeline): Mark | null {
  const own = t.marks.filter((m) => m.lane === t.lanes[0]);
  return own[own.length - 1] ?? t.marks[t.marks.length - 1] ?? null;
}
