// =============================================================================
// A library on the core: a sentence, read against the program's own words.
//
// Every event has one of four outcomes, and a sentence is no different:
//
//   resolve   it names a kind (or a step along an ordered intent): a person's
//             decision, straight into the doc. No model.
//   ask       it could be more than one cell: a question, whose answer resolves.
//   infer     it is about something the program cannot say yet (past the end
//             of a scale, a thing it has no word for): a need, for a model.
//   context   it is about nothing in particular ("更压抑一点"): said of the
//             whole, so the model's beliefs are held under it from now on.
//
// The reading is scored per cell: naming the intent counts most, then a kind
// it names, then a step's own words ("慢一点" names the pace), then generic
// steps ("大一点"), then the thing. Words that name an intent narrow the
// reading to that intent (with the hat at its largest, "帽子大一点" is past
// the hat's end, not the door's next kind).
// =============================================================================

import { kindOf, type Context, type Doc } from "./doc";
import type { Value } from "./decide";
import { MORE } from "./intent";
import { cells, type Key, type Program } from "./program";
import type { Action } from "./root";

export interface Reading {
  key: Key;
  kind: string;
  /** Ruled out rather than chosen ("不要大得离谱"). */
  not?: boolean;
  via: "kind" | "step";
}

export type Need = { kind: "extend"; key: Key; dir: 1 | -1; text: string } | { kind: "unknown"; text: string; things: string[] };

export type Recognized =
  | { outcome: "resolve"; reading: Reading; action: Action }
  | { outcome: "ask"; readings: Reading[] }
  | { outcome: "infer"; need: Need }
  | { outcome: "context"; action: Action };

const NEGATION = /不要|别|不准|不想|don't|do not|no longer/i;

export function readingAction(r: Reading, from = "said"): Action {
  return { type: "narrow", key: r.key, pick: r.not ? { not: [r.kind] } : r.kind, from };
}

export function recognize(text: string, s: { program: Program; doc: Doc; ctx: Context; values: Record<Key, Value> }): Recognized {
  const t = text.trim().toLowerCase();
  const has = (w?: string) => !!w && t.includes(w.toLowerCase());
  const scored: { reading?: Reading; extend?: 1 | -1; score: number; key: Key; thing: string; named: boolean }[] = [];
  const thingsNamed = new Set<string>();

  for (const c of cells(s.program)) {
    const v = s.values[c.key];
    if (!v) continue;
    const thingHit = has(c.thing.id) || has(c.thing.label) || c.thing.aka.some(has);
    if (thingHit) thingsNamed.add(c.thing.id);
    const named = has(c.decl.label) || c.decl.aka.some(has);
    // The kind whose words appear, the longest match winning.
    let kind: { name: string; len: number; word: string } | null = null;
    for (const k of v.kinds) {
      const kd = kindOf(c, s.doc, k);
      for (const w of [k, kd?.label, ...(kd?.words ?? [])])
        if (w && has(w) && (!kind || w.length > kind.len)) kind = { name: k, len: w.length, word: w };
    }
    const of = c.decl.of;
    const own = of.more !== MORE;
    const dir: 1 | -1 | 0 = !of.ordered ? 0 : of.more.some(has) ? 1 : of.less.some(has) ? -1 : 0;
    if (!kind && !dir) continue;
    const score = (named ? 4 : 0) + (kind ? 3 : 0) + (dir ? (own ? 2 : 1) : 0) + (thingHit ? 1 : 0);
    if (kind) {
      // A negation counts only outside the kind's own words ("别看我" is a kind, not a refusal).
      const not = NEGATION.test(t.replace(kind.word.toLowerCase(), ""));
      scored.push({ reading: { key: c.key, kind: kind.name, not, via: "kind" }, score, key: c.key, thing: c.thing.id, named });
    } else {
      const i = v.kinds.indexOf(v.kind) + dir;
      if (i >= 0 && i < v.kinds.length) scored.push({ reading: { key: c.key, kind: v.kinds[i], via: "step" }, score, key: c.key, thing: c.thing.id, named });
      else scored.push({ extend: dir as 1 | -1, score, key: c.key, thing: c.thing.id, named });
    }
  }

  // Words that name an intent keep the reading to it.
  const pool = scored.some((x) => x.named) ? scored.filter((x) => x.named) : scored;
  const top = Math.max(-1, ...pool.map((x) => x.score));
  const best = pool.filter((x) => x.score === top);

  if (best.length === 1) {
    const b = best[0];
    if (b.reading) return { outcome: "resolve", reading: b.reading, action: readingAction(b.reading) };
    return { outcome: "infer", need: { kind: "extend", key: b.key, dir: b.extend!, text } };
  }
  if (best.length > 1) {
    const readings = best.flatMap((x) => (x.reading ? [x.reading] : []));
    if (readings.length > 1) return { outcome: "ask", readings };
    if (readings.length === 1) return { outcome: "resolve", reading: readings[0], action: readingAction(readings[0]) };
  }
  if (thingsNamed.size) return { outcome: "infer", need: { kind: "unknown", text, things: [...thingsNamed] } };
  return { outcome: "context", action: { type: "context", ctx: { prompts: [...(s.ctx.prompts ?? []), text] } } };
}
