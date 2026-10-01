import { GAP, type BandState } from "@/systems/dock";

// =============================================================================
// The Band Lab's model: what it can put on the page, and how it holds the
// page to the band's four rules.
//
// Nothing here draws. The lab's stage is the site itself: the real Dock, its
// real occupants, a real bar in a real PinnedSlot on a real scroll. What this
// file adds is the measuring: every check reads rectangles off the page as it
// is now, so a check that passes is a fact about pixels, not about a model of
// them.
// =============================================================================

/** Which bar meets the band on the lab page. */
export type BarKind = "lab" | "prompt" | "works" | "none";
export const BAR_KINDS: readonly BarKind[] = ["lab", "prompt", "works", "none"];

export type CheckId = "oneBand" | "barUsable" | "noOverlap" | "reachable";
export const CHECK_IDS: readonly CheckId[] = ["oneBand", "barUsable", "noOverlap", "reachable"];

export interface Measure {
  /** Whether a pinned bar is on the page at all. */
  bar: boolean;
  /** Occupants in the Dock. */
  n: number;
  /** Each check: pass, fail, or not applicable (null). */
  checks: Record<CheckId, boolean | null>;
  /** The bar's row as drawn, and the least it needs. */
  barWidth: number | null;
  barMin: number | null;
  /** The narrowest gap between the bar's glass and an occupant in sight. */
  gap: number | null;
  /** Occupants out of sight but a swipe away; behind the count. */
  swipe: number;
  behind: number;
}

const EMPTY: Measure = {
  bar: false,
  n: 0,
  checks: { oneBand: null, barUsable: null, noOverlap: null, reachable: null },
  barWidth: null,
  barMin: null,
  gap: null,
  swipe: 0,
  behind: 0,
};

function px(value: string): number {
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return 0;
  return value.trim().endsWith("rem") ? v * parseFloat(getComputedStyle(document.documentElement).fontSize) : v;
}

function intersect(a: DOMRect, b: { left: number; right: number; top: number; bottom: number }) {
  return {
    left: Math.max(a.left, b.left),
    right: Math.min(a.right, b.right),
    top: Math.max(a.top, b.top),
    bottom: Math.min(a.bottom, b.bottom),
  };
}

/** The page, measured. Browser only. */
export function measureBand(band: BandState): Measure {
  const slot = document.querySelector<HTMLElement>("[data-pinned-slot]");
  const barEl = slot?.firstElementChild as HTMLElement | null | undefined;
  // The Dock's occupants are its row's children, each carrying its width as
  // a pill (`data-natural`).
  const occupants = Array.from(document.querySelectorAll<HTMLElement>("[data-natural]")).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
  const row = occupants[0]?.parentElement ?? null;
  const out: Measure = { ...EMPTY, checks: { ...EMPTY.checks }, bar: !!barEl, n: occupants.length };
  if (!row) return out;

  const clip = row.getBoundingClientRect();
  const countBall = document.querySelector("[data-band-count]")?.getBoundingClientRect() ?? null;
  const counted = countBall !== null;
  const isHidden = (el: HTMLElement) => el.closest("[data-hidden]") !== null || getComputedStyle(el).opacity === "0";

  // What of each occupant is in sight: its box, cut by the row's clip.
  const seen = occupants.map((el) => {
    const r = el.getBoundingClientRect();
    const v = intersect(r, clip);
    const hidden = isHidden(el);
    const visible = !hidden && v.right - v.left > 1;
    return { el, rect: r, hidden, visible, whole: visible && r.left >= clip.left - 0.5 && r.right <= clip.right + 0.5, cut: v };
  });
  const scrolls = row.scrollWidth > row.clientWidth + 1;
  out.swipe = scrolls ? seen.filter((s) => !s.whole && !s.hidden).length : 0;
  out.behind = counted ? occupants.length : 0;
  out.checks.reachable = seen.every((s) => s.whole || (scrolls && !s.hidden) || counted);

  if (!barEl) return out;

  const bar = barEl.getBoundingClientRect();
  const outset = band.bar?.outset ?? 0;
  const pin = outset > 0 ? px(getComputedStyle(document.documentElement).getPropertyValue("--pin-outset")) : 0;
  const glass = { left: bar.left - outset, right: bar.right + outset, top: bar.top - pin, bottom: bar.bottom + pin };
  const barGone = getComputedStyle(barEl).opacity === "0" || slot?.hasAttribute("data-band-folded");
  out.barWidth = Math.round(bar.width);
  out.barMin = band.bar ? band.bar.min : null;
  out.checks.barUsable = barGone ? true : band.bar ? bar.width >= band.bar.min - 1 : null;

  // One band: the bar's glass and every occupant in sight start on the same
  // line (the Dock's), rather than one row under the other.
  const tops = seen.filter((s) => s.visible).map((s) => s.rect.top);
  if (counted) {
    tops.push(countBall!.top);
  }
  out.checks.oneBand = barGone || tops.length === 0 ? true : tops.every((t) => Math.abs(t - glass.top) <= 2);

  // No overlap: nothing in sight under the bar's glass, and the gap holds.
  let gap: number | null = null;
  let overlap = false;
  if (!barGone) {
    const inSight = seen.filter((s) => s.visible).map((s) => s.cut);
    if (counted) {
      inSight.push({ left: countBall!.left, right: countBall!.right, top: countBall!.top, bottom: countBall!.bottom });
    }
    for (const c of inSight) {
      const sameLine = c.top < glass.bottom && c.bottom > glass.top;
      if (!sameLine) continue;
      const g = c.left >= glass.right ? c.left - glass.right : glass.left >= c.right ? glass.left - c.right : -1;
      if (g < 0) overlap = true;
      gap = gap === null ? g : Math.min(gap, g);
    }
  }
  out.gap = gap === null ? null : Math.round(gap);
  out.checks.noOverlap = !overlap && (gap === null || gap >= GAP - 0.5);
  return out;
}

export function sameMeasure(a: Measure, b: Measure) {
  return JSON.stringify(a) === JSON.stringify(b);
}
