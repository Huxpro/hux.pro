// The few things a scene file may say besides literals. Each is a plain data
// constructor (it builds an object; it computes nothing), so a scene stays a
// tree of data that a tool can read and write back. Keep this list short: a
// twentieth binding means that logic belongs in a kind.

import { gapBelow, overlaps, within, type Invariant, type Shape, type Snapshot } from "sem";

/** A value an event carried: `ref("touch")` is where the touch was. */
export type Ref = { $ref: string };
export const ref = (name: string): Ref => ({ $ref: name });
export const isRef = (v: unknown): v is Ref => typeof v === "object" && v !== null && "$ref" in v;

/** A phase, optionally only once it has lasted `delay` seconds. */
export type When = string | { phase: string; delay: number };
export const after = (phase: string, delay: number): When => ({ phase, delay });

/** Where a DOM node sits: from the top or bottom edge (clear of the notch), under another node, or midway between two. */
export type Anchor =
  | { top: number }
  | { bottom: number }
  | { middle: number }
  | { below: string; gap: number }
  | { between: [string, string] };
export const at = {
  top: (px: number): Anchor => ({ top: px }),
  bottom: (px: number): Anchor => ({ bottom: px }),
  /** `px` below the middle of the screen (above, when negative). */
  middle: (px: number): Anchor => ({ middle: px }),
  below: (node: string, gap: number): Anchor => ({ below: node, gap }),
  /** Centred in the gap from the bottom of `upper` to the top of `lower`. */
  between: (upper: string, lower: string): Anchor => ({ between: [upper, lower] }),
};

/** Words in each language the site speaks. */
export type Words = { en: string; zh: string };

/** A rule, written against node ids local to the scene; the stage scopes them. */
export type Rule = (scope: string) => Invariant;

const seen = (s: Snapshot, id: string): Shape | null => (s.nodes[id]?.visible ? s.nodes[id].shape : null);

export const rule = {
  /** Two nodes never overlap while both are seen. */
  clear:
    (a: string, b: string): Rule =>
    (scope) => ({
      id: `${a}-clear-of-${b}`,
      text: `the ${a} keeps clear of the ${b}`,
      check: (s) => {
        const [x, y] = [seen(s, `${scope}/${a}`), seen(s, `${scope}/${b}`)];
        return !x || !y || !overlaps(x, y) || `the ${a} overlaps the ${b}`;
      },
    }),
  /** `lower` sits wholly below `upper` while both are seen. */
  below:
    (upper: string, lower: string): Rule =>
    (scope) => ({
      id: `${lower}-below-${upper}`,
      text: `the ${lower} sits below the ${upper}`,
      check: (s) => {
        const [x, y] = [seen(s, `${scope}/${upper}`), seen(s, `${scope}/${lower}`)];
        if (!x || !y) return true;
        const gap = gapBelow(x, y);
        return gap >= 0 || `the ${lower} is ${Math.round(-gap)}px into the ${upper}`;
      },
    }),
  /** Everything seen stays on the screen, but for the nodes named (a sea that opens past the edges). */
  onScreen:
    (except: string[] = []): Rule =>
    (scope) => ({
      id: "on-screen",
      text: `everything seen stays on the screen${except.length ? ` (but ${except.join(", ")})` : ""}`,
      check: (s) => {
        const screen: Shape = { rect: [0, 0, s.viewport.w, s.viewport.h] };
        const skip = new Set(except.map((id) => `${scope}/${id}`));
        const off = s.order.filter((id) => id.startsWith(`${scope}/`) && !skip.has(id) && seen(s, id) && !within(seen(s, id)!, screen));
        return off.length === 0 || `off the screen: ${off.join(", ")}`;
      },
    }),
  /** `inner` lies within `outer` while both are seen. */
  inside:
    (inner: string, outer: string): Rule =>
    (scope) => ({
      id: `${inner}-inside-${outer}`,
      text: `the ${inner} stay inside the ${outer}`,
      check: (s) => {
        const [a, b] = [seen(s, `${scope}/${inner}`), seen(s, `${scope}/${outer}`)];
        return !a || !b || within(a, b, 1) || `the ${inner} reach outside the ${outer}`;
      },
    }),
  /** Two circles share a centre (a drawn sun and its ring), within a pixel. */
  aligned:
    (a: string, b: string): Rule =>
    (scope) => ({
      id: `${a}-aligned-${b}`,
      text: `the ${a} is where the ${b} is`,
      check: (s) => {
        const [x, y] = [seen(s, `${scope}/${a}`), s.nodes[`${scope}/${b}`]?.shape];
        if (!x || !y || !("circle" in x) || !("circle" in y)) return true;
        const d = Math.hypot(x.circle[0] - y.circle[0], x.circle[1] - y.circle[1]);
        return d < 1 || `${Math.round(d)}px apart`;
      },
    }),
  /** A number a node reports (its `inspect`) stays at least `min`. */
  atLeast:
    (node: string, key: string, min: number): Rule =>
    (scope) => ({
      id: `${node}-${key}`,
      text: `the ${node}'s ${key} stays at least ${min}`,
      check: (s) => {
        const v = s.nodes[`${scope}/${node}`]?.state?.[key];
        return typeof v !== "number" || v >= min || `${key} is ${Math.round(v * 100) / 100}`;
      },
    }),
  /** These are at least `px` to a finger while seen. */
  minTarget:
    (px: number, ids: string[]): Rule =>
    (scope) => ({
      id: "touch-targets",
      text: `${ids.join(" and ")} are at least ${px}px to a finger`,
      check: (s) => {
        const small = ids.filter((id) => {
          const b = s.nodes[`${scope}/${id}`]?.visible ? s.nodes[`${scope}/${id}`].bounds : null;
          return b && (b.w < px || b.h < px);
        });
        return small.length === 0 || `too small: ${small.join(", ")}`;
      },
    }),
};
