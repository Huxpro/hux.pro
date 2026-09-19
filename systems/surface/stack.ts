"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// =============================================================================
// Surface stack — which sheets are open, in the order they opened.
//
// iOS stacks sheets: presenting one from another sends the first back a step
// (smaller, dimmer, a little higher) and brings it forward again when the one
// on top goes. That is a relationship between surfaces, not a property of any
// one of them, so it lives here rather than in either sheet.
//
// A module-level store instead of a provider: the surfaces mount in different
// subtrees of the root layout, and a store needs no wrapper to reach them all.
//
// Who is in it. Not every secondary surface: the panel, the window and the
// popover shapes never register, because nothing recedes on a tablet or a
// desktop. What registers is the surfaces that are anchored to an edge and
// span the screen's width — the phone sheets, and the dock's Live Activity
// panel at the top. That is why `SurfaceBand` below is a pair of Y
// coordinates rather than a rectangle: for everything in this stack, where it
// stands on the vertical axis IS where it stands, and a shape that floats
// free of the edges is not here to be asked.
// =============================================================================

/**
 * How long a surface takes to arrive, leave, change detent or step back. Base
 * UI leaves every drawer animation to CSS, so this is the site's own number
 * rather than a library's: the motion in globals.css reads it through
 * `--surface-duration`.
 */
export const SURFACE_TRANSITION_MS = 500;

/** The curve a surface travels on — arriving, leaving, changing detent. */
export const SURFACE_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * The curve a surface steps back on while another rises over it. Background
 * motion: it starts gently, so the frame it leads the arriving sheet by is
 * invisible, and ends with it. See "Secondary surface motion" in globals.css.
 */
export const SURFACE_RECEDE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * The band of the screen a surface occupies, in viewport pixels — the whole of
 * where it is, for a surface anchored to an edge across the full width (see
 * the note above). Both edges are visual: measured from layout values, never
 * from a `getBoundingClientRect`, because the recede a band decides is itself
 * a transform on the surface being measured.
 */
export interface SurfaceBand {
  top: number;
  bottom: number;
}

interface Entry {
  id: string;
  /** The sheet this one renders inside, when it is a Base UI nested drawer. */
  nestedIn?: string;
  /** The detent the sheet stands at, for a sheet opening over it to arrive level. */
  level?: number;
  /**
   * Where the surface stands. Absent means "assume it covers everything" —
   * the behaviour every surface had before any of them could say.
   */
  band?: SurfaceBand;
}

/**
 * Do two surfaces cover one another? Edge-to-edge is not overlap: a sheet that
 * stops exactly at the dock panel's bottom edge is tiled with it, not under
 * it. An unreported band covers everything, so a surface that cannot describe
 * itself keeps the behaviour it had before it could.
 */
function overlaps(a: Entry, b: Entry): boolean {
  if (!a.band || !b.band) return true;
  return a.band.top < b.band.bottom && b.band.top < a.band.bottom;
}

let stack: readonly Entry[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => stack;
const EMPTY: readonly Entry[] = [];
const getServerSnapshot = () => EMPTY;

function push(entry: Entry) {
  if (stack.some((e) => e.id === entry.id)) return;
  stack = [...stack, entry];
  emit();
}

function remove(id: string) {
  if (!stack.some((e) => e.id === id)) return;
  stack = stack.filter((e) => e.id !== id);
  emit();
}

function setLevel(id: string, level: number | undefined) {
  const entry = stack.find((e) => e.id === id);
  if (!entry || entry.level === level) return;
  stack = stack.map((e) => (e.id === id ? { ...e, level } : e));
  emit();
}

/**
 * A measured band is re-reported on every resize and every frame of a
 * transition, so a repeated answer must not be a render: anything under a
 * pixel is the same band.
 */
function setBand(id: string, band: SurfaceBand | undefined) {
  const entry = stack.find((e) => e.id === id);
  if (!entry) return;
  const same =
    entry.band === band ||
    (!!entry.band &&
      !!band &&
      Math.abs(entry.band.top - band.top) < 1 &&
      Math.abs(entry.band.bottom - band.bottom) < 1);
  if (same) return;
  stack = stack.map((e) => (e.id === id ? { ...e, band } : e));
  emit();
}

/**
 * Where another surface is standing, or `undefined` if it is closed or has not
 * said. For a surface that has to fit itself around one it does not own — the
 * theater playlist, whose top detent is the bottom edge of the dock card the
 * player collapsed into. The stack already knows, so asking it beats a second
 * measurement of the same element from the outside.
 */
export function useSurfaceBandOf(id: string): SurfaceBand | undefined {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return current.find((e) => e.id === id)?.band;
}

/**
 * Measure a band and keep it true, for the surfaces that report one.
 *
 * All of them are drawers, and a drawer is in motion for exactly as long as
 * the rest of the system: it travels in over one `SURFACE_TRANSITION_MS`, it
 * resizes as a drag changes its detent, and it re-lays-out when the viewport
 * does. So the three triggers are the same three every time, and they belong
 * here rather than copied into each surface:
 *
 *   now            what it measures the frame it opens
 *   settled        again once the entrance has landed, because a surface
 *                  still travelling in has not reached the band it will hold
 *   size / resize  a `ResizeObserver` on the shell, which is what a detent
 *                  change actually is, and the window's own resize
 *
 * `measure` must read layout values only — `offsetTop`, `offsetHeight` — and
 * must be a `useCallback`, since it is this effect's dependency.
 */
export function useMeasuredBand(
  active: boolean,
  measure: () => SurfaceBand | undefined,
  /** The element whose size is the band's; observed for detent changes. */
  ref: React.RefObject<HTMLElement | null>
): SurfaceBand | undefined {
  const [band, setBand] = useState<SurfaceBand | undefined>(undefined);

  useEffect(() => {
    if (!active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBand(undefined);
      return;
    }
    const read = () => setBand(measure());
    read();
    const settled = window.setTimeout(read, SURFACE_TRANSITION_MS);
    window.addEventListener("resize", read);
    const el = ref.current;
    const observer = el ? new ResizeObserver(read) : null;
    if (el) observer?.observe(el);
    return () => {
      window.clearTimeout(settled);
      window.removeEventListener("resize", read);
      observer?.disconnect();
    };
  }, [active, measure, ref]);

  return band;
}

/**
 * The stack as it stands, bottom first — for a readout (the attachments lab), not
 * for a sheet, which asks `useSurfaceStack` about its own place.
 */
export function useSurfaceStackEntries(): readonly { id: string; nestedIn?: string }[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Registers a sheet while `active`, and reports how many sheets have opened on
 * top of it since. Deregisters on close (not on unmount), so the one behind
 * comes forward in step with the top sheet's exit rather than after it.
 *
 * `behind` counts every sheet above *that covers this one*, nested or not: it
 * is what makes the sheet inert and dims it. Surfaces that merely share the
 * screen — the dock panel at the top, a sheet stopping below it — do not
 * count, because neither is hidden. `depth` leaves out the sheets nested in
 * this one — Base UI already counts those on the parent popup as
 * `--nested-drawers`, live with their swipe — so a shell can add the two
 * without counting a sheet twice. `beneathLevel` is the detent of the nearest
 * sheet under this one that it actually stands on, so a sheet can arrive level
 * with it.
 *
 * `band` is where this surface stands, so the others can tell covering from
 * tiling. Measure it off a box that does not carry the recede transform (the
 * popup, or `offsetHeight`), or the answer feeds back into itself.
 *
 * `rank` is the sheet's
 * place in the stack from the bottom — its layer, for a viewport to stand on:
 * sheets portal into sibling subtrees in whatever order they first mounted,
 * and a kept-mounted one (a window) opened again over a younger sheet would
 * otherwise paint under it while the stack says it is on top.
 */
export function useSurfaceStack(
  id: string,
  active: boolean,
  {
    nestedIn,
    level,
    band,
  }: { nestedIn?: string; level?: number; band?: SurfaceBand } = {}
): {
  behind: boolean;
  depth: number;
  beneathLevel: number | undefined;
  rank: number;
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!active) return;
    push({ id, nestedIn });
    return () => remove(id);
  }, [id, active, nestedIn]);

  useEffect(() => {
    if (active) setLevel(id, level);
  }, [id, active, level]);

  // Destructured, so a caller passing a fresh object every render — which a
  // measured band is — does not re-run this on every render.
  const bandTop = band?.top;
  const bandBottom = band?.bottom;
  useEffect(() => {
    if (!active) return;
    setBand(
      id,
      bandTop === undefined || bandBottom === undefined
        ? undefined
        : { top: bandTop, bottom: bandBottom }
    );
  }, [id, active, bandTop, bandBottom]);

  const index = current.findIndex((e) => e.id === id);
  if (index === -1) {
    // Before it registers (the render that opens it) the sheet beneath is the
    // top of the stack. Closed: it has no place.
    return {
      behind: false,
      depth: 0,
      beneathLevel: current[current.length - 1]?.level,
      rank: active ? current.length : -1,
    };
  }
  const self = current[index];
  // Only the ones that actually cover this surface are above it.
  const covering = current.slice(index + 1).filter((e) => overlaps(self, e));
  // And only one it actually stands on is something to stand level with.
  const beneath = current
    .slice(0, index)
    .reverse()
    .find((e) => overlaps(self, e));
  return {
    behind: covering.length > 0,
    depth: covering.filter((e) => e.nestedIn !== id).length,
    beneathLevel: beneath?.level,
    rank: index,
  };
}
