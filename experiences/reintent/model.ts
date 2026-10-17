// =============================================================================
// A stand-in for the model, in rules, so the loop runs with no model at all.
// It does the two things the core leaves to a model, and says it is a stand-in:
//
//   extend      past the end of an ordered intent: a kind more, its numbers
//               carried one step further along the scale (a weak model's job)
//   rebelieve   the context changed ("更压抑一点"): every belief held under the
//               old one is inferred again under the new; a person's decisions
//               are not touched
//
// A real model would answer the same needs in the same actions (learn, narrow,
// believe); observe() is what it would be shown.
// =============================================================================

import { cellOf, kindOf, type Action, type Snapshot } from "reintent-core";
import type { Need } from "reintent-core/words";

export const STAND_IN = "model:stand-in";

const step = (a: unknown, b: unknown): unknown =>
  typeof a === "number" && typeof b === "number"
    ? Math.round((b + (b - a)) * 100) / 100
    : Array.isArray(a) && Array.isArray(b)
      ? b.map((x, i) => step(a[i], x))
      : b;

/** A kind one step past the end the need points at, chosen for the person who asked. */
export function extend(s: Snapshot, need: Extract<Need, { kind: "extend" }>): Action[] | null {
  const c = cellOf(s.program, need.key);
  const v = s.values[need.key];
  if (!c || !v || v.kinds.length < 2) return null;
  const ks = need.dir > 0 ? v.kinds.slice(-2) : [v.kinds[1], v.kinds[0]];
  const [prev, last] = ks.map((k) => kindOf(c, s.doc, k)!);
  const data = Object.fromEntries(Object.entries(last.data as object).map(([f, x]) => [f, step((prev.data as Record<string, unknown>)[f], x)]));
  const n = Object.keys(s.doc.learned[need.key] ?? {}).length + 1;
  const name = `${need.dir > 0 ? "more" : "less"}${n}`;
  const label = `${need.text.trim()} · ${need.dir > 0 ? "further" : "back"}`;
  return [
    { type: "learn", key: need.key, name, kind: { label, words: [need.text.trim()], data, learned: STAND_IN } },
    { type: "narrow", key: need.key, pick: name, from: "said" },
  ];
}

const DARKER = /压抑|可怕|吓人|恐怖|更黑|阴森|scary|darker|oppressive|creepier/i;
const GENTLER = /温柔|不吓人|轻松|别那么|柔和|gentle|softer|calmer|kinder/i;

/** Beliefs again, under the context as it is now: darker leans along each ordered scale, gentler back. */
export function rebelieve(s: Snapshot): Action[] {
  const said = (s.ctx.prompts ?? []).join(" ");
  const lean = (DARKER.test(said) ? 1 : 0) - (GENTLER.test(said) ? 1 : 0);
  return s.stale.map((v) => {
    const c = cellOf(s.program, v.key)!;
    const ordered = c.decl.of.ordered;
    const n = v.kinds.length;
    const p = Object.fromEntries(
      v.kinds.map((k, i) => {
        const base = v.p[k] ?? 0;
        if (!ordered || !lean) return [k, base];
        const t = lean > 0 ? i / (n - 1) : 1 - i / (n - 1);
        return [k, base * 0.25 + 0.75 * (t * t) / v.kinds.reduce((a, _, j) => a + (lean > 0 ? j / (n - 1) : 1 - j / (n - 1)) ** 2, 0)];
      }),
    );
    return { type: "believe", key: v.key, p, by: STAND_IN } as Action;
  });
}
