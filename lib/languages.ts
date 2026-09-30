import languagesJson from "@/content/languages.json";
import type { Locale } from "@/lib/i18n";

// =============================================================================
// Languages — the PL chart (the post content/blog/pl-chart), as data.
//
// Every programming language I've written, placed on two personal axes and
// shaded by a third, less personal one:
//
//   x  i13s  interestingness to me, 0–9   (🥱 → 🤯)
//   y  exp   my experience with it, 0–9   (🤦‍♂️ → 👨‍🎓)
//   ·  abs   its abstraction level, 0–9   (bare metal → pure)
//
// The content is content/languages.json, carried over from the original
// chart (github.com/Huxpro/PL-chart) with nothing dropped: the axes' four
// named steps, the tier each abstraction level stood for (comments in the
// old source, named here), every note, and the entry that was commented out
// (`drafts`, not plotted). Every heading and note is written in both
// languages (`title.en` / `title.zh`, `notes.en` / `notes.zh`: the same
// paragraphs, the same links), and carries three inline marks, parsed by
// `inlineMarks`: `[text](url)`, `*italic*` and `` `code` ``. The explanation
// around the chart is the post itself, content/blog/pl-chart.<locale>.mdx.
// =============================================================================

export type Bilingual = Record<Locale, string>;

export interface AxisTick {
  at: number;
  emoji: string;
  label: Bilingual;
}

export interface Axis {
  key: "i13s" | "exp";
  name: Bilingual;
  ticks: AxisTick[];
}

export interface AbstractionTier {
  /** 0–9, or `null` for beyond the scale. */
  level: number | null;
  label: Bilingual;
}

export interface Language {
  id: string;
  /** The short name the chart prints under the dot — one for both
   *  languages, or one each (`nameOf`). */
  name: string | Bilingual;
  /** The glyph the note opens with. */
  emoji: string;
  /** The note's heading, with its links, per locale. */
  title: Bilingual;
  /** Abstraction level, 0 (bare metal) – 9 (pure); `null` past the end of
   *  the scale (natural language). */
  abs: number | null;
  /** Interestingness, 0 (boring) – 9 (mind-blown). */
  i13s: number;
  /** Experience, 0 (little) – 9 (language lawyer). */
  exp: number;
  /** Paragraphs, per locale — the same paragraphs, with the same links, in
   *  each. One that opens with `TBD` is a note still to be written. */
  notes: Record<Locale, string[]>;
  /** The year a later entry joined the 2020 chart. */
  added?: string;
}

interface LanguagesData {
  axes: {
    x: Axis;
    y: Axis;
    abs: {
      key: "abs";
      name: Bilingual;
      low: Bilingual;
      high: Bilingual;
      /** What a level of `null` is called. */
      beyond: Bilingual;
      tiers: AbstractionTier[];
    };
  };
  languages: Language[];
  drafts: Language[];
}

const DATA = languagesJson as LanguagesData;

/** The scale every axis runs on. */
export const SCALE_MAX = 9;

export const AXES = DATA.axes;
export const LANGUAGES: readonly Language[] = DATA.languages;

/** Past the end of the abstraction scale. */
export const BEYOND: AbstractionTier = { level: null, label: AXES.abs.beyond };

/** A level's tier, by its number. */
export function tierOf(level: number | null): AbstractionTier {
  if (level === null) return BEYOND;
  return AXES.abs.tiers.find((t) => t.level === level) ?? AXES.abs.tiers[0];
}

/** A language's name in a locale. */
export function nameOf(language: Language, locale: Locale): string {
  return typeof language.name === "string" ? language.name : language.name[locale];
}

/** The named step of an axis a value sits nearest. */
export function nearestTick(axis: Axis, value: number): AxisTick {
  return axis.ticks.reduce((best, t) =>
    Math.abs(t.at - value) < Math.abs(best.at - value) ? t : best,
  );
}

/** A note that is a placeholder rather than prose. */
export function isTodo(note: string): boolean {
  return /^TBD\b/.test(note);
}

/**
 * The tiers in the order the list reads them: most abstract first (beyond
 * the scale before 9), the way the original source was laid out, and each
 * tier's languages in their authored order.
 */
export function byTier(
  languages: readonly Language[] = LANGUAGES,
): { tier: AbstractionTier; languages: Language[] }[] {
  return [BEYOND, ...[...AXES.abs.tiers].sort((a, b) => b.level! - a.level!)]
    .map((tier) => ({
      tier,
      languages: languages.filter((l) => l.abs === tier.level),
    }))
    .filter((group) => group.languages.length > 0);
}

// -----------------------------------------------------------------------------
// Colour by abstraction.
//
// The one place on this site that is not grayscale, because here the colour
// is the content: it carries the third dimension, as it did in the original.
// The steps live in globals.css (`--abs-<palette>-<level>`), on :root so the
// note's popover and sheet — portaled out of the page — see them too.
//
//   violet     one hue, pale (machine) → deep (abstract); in dark mode dim →
//              bright. Abstraction is ordinal, and an ordinal scale reads
//              best as a single hue stepped in lightness.
//   instagram  the original chart's gradient, #fcb045 → #fd1d1d → #833ab4,
//              sampled where ECharts' visualMap put each level.
//   ink        the site's own ink at an alpha — the grayscale fallback.
// -----------------------------------------------------------------------------

export type AbstractionPalette = "violet" | "instagram" | "ink";

/** The palette the chart paints with. */
export const ABSTRACTION_PALETTE: AbstractionPalette = "instagram";

/**
 * A CSS paint for an abstraction level: its colour, or — past the end of the
 * scale — the whole ramp at once, since what sits there compiles into every
 * level below it. A gradient, so it paints a `background`, not a `color`.
 */
export function absColor(
  level: number | null,
  palette: AbstractionPalette = ABSTRACTION_PALETTE,
): string {
  if (level === null) {
    const stops = [0, 3, 6, 9, 0].map((l) => `var(--abs-${palette}-${l})`);
    return `conic-gradient(${stops.join(", ")})`;
  }
  return `var(--abs-${palette}-${level})`;
}

// -----------------------------------------------------------------------------
// Labels.
//
// A name hangs under its dot, as it always did. Where two dots share a row
// closely enough that their names would overlap at the current width (the
// original let them collide on a phone), the names slide apart first: the
// left one ends at its dot, the right one starts at its own, the way a map
// sets two neighbouring towns. Only when even that cannot part them does a
// name go above its dot, where it risks the row overhead.
// -----------------------------------------------------------------------------

export interface LabelPlacement {
  /** Which side of the dot the name hangs on. */
  side: "below" | "above";
  /** Where the name is anchored: centred on the dot, starting at it
   *  (running right) or ending at it (running left). */
  align: "center" | "start" | "end";
}

const CENTERED: LabelPlacement = { side: "below", align: "center" };

/** Width of one character of the label face, in ems (JetBrains Mono). A
 *  Han character falls back to a CJK face, a full em wide. */
const MONO_ADVANCE = 0.6;

function labelWidth(name: string, fontSize: number): number {
  let ems = 0;
  for (const ch of name) ems += /[\u3400-\u9fff]/.test(ch) ? 1 : MONO_ADVANCE;
  return ems * fontSize;
}

/** How far past the field's edge a name may hang before it turns inward. */
const EDGE_SLACK = 24;

/** How far past the dot's centre a start/end-anchored name begins, in px. */
export const LABEL_TUCK = 6;

function extent(center: number, width: number, align: LabelPlacement["align"]) {
  if (align === "start") return [center - LABEL_TUCK, center - LABEL_TUCK + width];
  if (align === "end") return [center + LABEL_TUCK - width, center + LABEL_TUCK];
  return [center - width / 2, center + width / 2];
}

export function placeLabels(
  languages: readonly Language[],
  plotWidth: number,
  fontSize: number,
  locale: Locale,
  gap = 4,
): Map<string, LabelPlacement> {
  const placements = new Map<string, LabelPlacement>();
  const rows = new Map<number, Language[]>();
  for (const l of languages) {
    rows.set(l.exp, [...(rows.get(l.exp) ?? []), l]);
  }
  for (const row of rows.values()) {
    const sorted = [...row].sort((a, b) => a.i13s - b.i13s);
    // The last name set below the dots on this row, and above them.
    const prev: Record<LabelPlacement["side"], { id: string; left: number; right: number; center: number; width: number } | null> = {
      below: null,
      above: null,
    };
    for (const l of sorted) {
      const center = (l.i13s / SCALE_MAX) * plotWidth;
      const width = labelWidth(nameOf(l, locale), fontSize);
      // A name that would run off the field's end turns back in from it —
      // under its dot if that is clear, over it if the row is too crowded.
      if (center + width / 2 > plotWidth + EDGE_SLACK) {
        const [left, right] = extent(center, width, "end");
        const side: LabelPlacement["side"] =
          !prev.below || left >= prev.below.right + gap ? "below" : "above";
        placements.set(l.id, { side, align: "end" });
        prev[side] = { id: l.id, left, right, center, width };
        continue;
      }
      let placed: LabelPlacement | null = null;
      for (const side of ["below", "above"] as const) {
        const before = prev[side];
        const clear = (left: number) => !before || left >= before.right + gap;
        for (const align of ["center", "start"] as const) {
          if (clear(extent(center, width, align)[0])) {
            placed = { side, align };
            break;
          }
        }
        // Still touching: pull the neighbour back to end at its own dot.
        if (!placed && before && placements.get(before.id)?.align === "center") {
          const pulled = extent(before.center, before.width, "end")[1];
          for (const align of ["center", "start"] as const) {
            if (extent(center, width, align)[0] >= pulled + gap) {
              placements.set(before.id, { side, align: "end" });
              before.right = pulled;
              placed = { side, align };
              break;
            }
          }
        }
        if (placed) break;
      }
      placed ??= CENTERED;
      const [left, right] = extent(center, width, placed.align);
      placements.set(l.id, placed);
      prev[placed.side] = { id: l.id, left, right, center, width };
    }
  }
  return placements;
}

// -----------------------------------------------------------------------------
// Inline marks.
// -----------------------------------------------------------------------------

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "em"; children: InlineToken[] }
  | { kind: "link"; href: string; children: InlineToken[] };

// Code first, so a bracket inside backticks (`[A]`) is never read as a link.
// A link's URL may hold one level of parentheses (Wikipedia's
// `Python_(programming_language)`).
const INLINE =
  /`([^`]+)`|\[((?:[^\]\\]|\\.)+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|\*([^*]+)\*/g;

export function inlineMarks(source: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const m of source.matchAll(INLINE)) {
    if (m.index > last) {
      tokens.push({ kind: "text", text: source.slice(last, m.index) });
    }
    if (m[1] !== undefined) tokens.push({ kind: "code", text: m[1] });
    else if (m[2] !== undefined)
      tokens.push({ kind: "link", href: m[3], children: inlineMarks(m[2]) });
    else tokens.push({ kind: "em", children: inlineMarks(m[4]) });
    last = m.index + m[0].length;
  }
  if (last < source.length) {
    tokens.push({ kind: "text", text: source.slice(last) });
  }
  return tokens;
}

/** The same string with its marks taken off, for a label or a search. */
export function plainText(source: string): string {
  const flat = (tokens: InlineToken[]): string =>
    tokens
      .map((t) => (t.kind === "text" || t.kind === "code" ? t.text : flat(t.children)))
      .join("");
  return flat(inlineMarks(source));
}
