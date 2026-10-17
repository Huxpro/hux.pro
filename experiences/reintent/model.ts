// =============================================================================
// A stand-in for the model, in rules, so the loop runs with no model at all.
// It does the two things a session leaves to a model, and says it is a stand-in:
//
//   extend      past the end of an ordered intent: a kind more, its numbers
//               carried one step further along the scale (a weak model's job)
//   rebelieve   something said of the whole ("更压抑一点"): every belief it is
//               asked about, inferred again; a person's decisions are not touched.
//               A belief given another choice leans case by case
//
// A real model would answer the same needs the same way (a learned kind, beliefs
// by path); lib/observe is what it would be shown.
// =============================================================================

import { isGiven, type Belief, type Dist, type Read } from "reintent-core";
import type { Model } from "reintent-core/lib/session";
import { kindAbout, type About } from "reintent-core/lib/vocab";

export const STAND_IN = "model:stand-in";

const step = (a: unknown, b: unknown): unknown =>
  typeof a === "number" && typeof b === "number"
    ? Math.round((b + (b - a)) * 100) / 100
    : Array.isArray(a) && Array.isArray(b)
      ? b.map((x, i) => step(a[i], x))
      : b;

const DARKER = /压抑|可怕|吓人|恐怖|更黑|阴森|scary|darker|oppressive|creepier/i;
const GENTLER = /温柔|不吓人|轻松|别那么|柔和|gentle|softer|calmer|kinder/i;

export const standIn: Model = {
  name: STAND_IN,

  extend(need, read) {
    const kinds = (read.kinds ?? []).map(String);
    if (kinds.length < 2) return null;
    const [prev, last] = (need.dir > 0 ? kinds.slice(-2) : [kinds[1], kinds[0]]).map((k) => kindAbout(read, k));
    if (!prev || !last) return null;
    const data = Object.fromEntries(Object.entries(last.data as object).map(([f, x]) => [f, step((prev.data as Record<string, unknown>)[f], x)]));
    const n = Object.keys(read.learned ?? {}).length + 1;
    const kind = `${need.dir > 0 ? "more" : "less"}${n}`;
    return { kind, about: { label: `${need.text.trim()} · ${need.dir > 0 ? "further" : "back"}`, words: [need.text.trim()], data, learned: STAND_IN } };
  },

  // Darker leans along each ordered scale, gentler back; anything else keeps what it believed.
  rebelieve(reads: readonly Read[], said: readonly string[], stored: (path: string) => Belief | undefined) {
    const all = said.join(" ");
    const lean = (DARKER.test(all) ? 1 : 0) - (GENTLER.test(all) ? 1 : 0);
    const out: Record<string, Belief> = {};
    const seen = new Set<string>();
    for (const r of reads) {
      if (!r.belief || r.by === "human" || seen.has(r.path)) continue;
      seen.add(r.path);
      const kinds = (r.kinds ?? []).map(String);
      const ordered = (r.about as About | undefined)?.ordered;
      const n = kinds.length;
      const t = (i: number) => (lean > 0 ? i / (n - 1) : 1 - i / (n - 1));
      const total = kinds.reduce((a, _, j) => a + t(j) ** 2, 0);
      const again = (p: Dist): Dist =>
        !ordered || !lean || n < 2 ? { ...p } : Object.fromEntries(kinds.map((k, i) => [k, (p[k] ?? 0) * 0.25 + (0.75 * t(i) ** 2) / total]));
      const was = stored(r.path);
      out[r.path] = isGiven(was)
        ? { $given: was.$given.map((c) => ({ when: c.when, p: again(c.p) })), ...(was.else && { else: again(was.else) }) }
        : again(r.belief);
    }
    return out;
  },
};
