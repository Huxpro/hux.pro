/**
 * A sentence, read against what a render read: each intent's words, its kinds' words, its
 * thing's words (the vocabulary's `About`, passed through the core as `Read.about`). Every event
 * has one of four outcomes, and a sentence is no different:
 *
 *   resolve   it names a kind (or a step along an ordered intent): a person's decision. No model.
 *   ask       it could be more than one intent: a question, whose answer resolves.
 *   infer     the program cannot say it yet (past the end of a scale, a thing with no word for
 *             it): a need, for a model.
 *   context   it is about nothing in particular ("更压抑一点"): said of the whole.
 *
 * The reading is scored per intent: naming the intent counts most, then a kind it names, then a
 * step's own words ("慢一点" names the pace), then generic steps ("大一点"), then the thing.
 * Words that name an intent keep the reading to it (with the hat at its largest, "帽子大一点" is
 * past the hat's end, not the door's next kind).
 */
import type { Read } from '../core/index';
import { kindAbout, MORE, type About } from './vocab';

export interface Reading {
  path: string;
  kind: string;
  /** Ruled out rather than chosen ("不要大得离谱"). */
  not?: boolean;
  via: 'kind' | 'step';
}

export type Need = { kind: 'extend'; path: string; dir: 1 | -1; text: string } | { kind: 'unknown'; text: string; things: string[] };

export type Recognized =
  | { outcome: 'resolve'; reading: Reading }
  | { outcome: 'ask'; readings: Reading[] }
  | { outcome: 'infer'; need: Need }
  | { outcome: 'context'; text: string };

const NEGATION = /不要|别|不准|不想|don't|do not|no longer/i;

/** What a reading writes: a person's value, or kinds ruled out. */
export const said = (r: Reading): unknown => (r.not ? { $not: [r.kind] } : r.kind);

export function recognize(text: string, reads: readonly Read[]): Recognized {
  const t = text.trim().toLowerCase();
  const has = (w?: string) => !!w && t.includes(w.toLowerCase());
  type Scored = { reading?: Reading; extend?: 1 | -1; score: number; path: string; named: boolean };
  const scored: Scored[] = [];
  const thingsNamed = new Set<string>();
  const seen = new Set<string>();

  for (const r of reads) {
    const about = r.about as About | undefined;
    if (!about || !r.kinds || seen.has(r.path) || r.by === 'unknown') continue;
    seen.add(r.path);
    const thingHit = !!about.thing && (has(about.thing.label?.split(' · ')[0]) || about.thing.aka.some(has));
    if (thingHit) thingsNamed.add(r.path.slice(0, r.path.indexOf('#')));
    const named = has(about.label?.split(' · ')[0]) || about.aka.some(has);
    // The kind whose words appear, the longest match winning.
    let kind: { name: string; len: number; word: string } | null = null;
    for (const k of r.kinds.map(String)) {
      const ka = kindAbout(r, k);
      for (const w of [k, ka?.label.split(' · ')[0], ...(ka?.words ?? [])])
        if (w && has(w) && (!kind || w.length > kind.len)) kind = { name: k, len: w.length, word: w };
    }
    const own = about.more !== MORE;
    const dir: 1 | -1 | 0 = !about.ordered ? 0 : about.more.some(has) ? 1 : about.less.some(has) ? -1 : 0;
    if (!kind && !dir) continue;
    const score = (named ? 4 : 0) + (kind ? 3 : 0) + (dir ? (own ? 2 : 1) : 0) + (thingHit ? 1 : 0);
    if (kind) {
      // A negation counts only outside the kind's own words ("别看我" is a kind, not a refusal).
      const not = NEGATION.test(t.replace(kind.word.toLowerCase(), ''));
      scored.push({ reading: { path: r.path, kind: kind.name, not, via: 'kind' }, score, path: r.path, named });
    } else {
      const kinds = r.kinds.map(String);
      const i = kinds.indexOf(String(r.value)) + dir;
      if (i >= 0 && i < kinds.length) scored.push({ reading: { path: r.path, kind: kinds[i], via: 'step' }, score, path: r.path, named });
      else scored.push({ extend: dir as 1 | -1, score, path: r.path, named });
    }
  }

  // Words that name an intent keep the reading to it.
  const pool = scored.some((x) => x.named) ? scored.filter((x) => x.named) : scored;
  const top = Math.max(-1, ...pool.map((x) => x.score));
  const best = pool.filter((x) => x.score === top);

  if (best.length === 1) {
    const b = best[0];
    if (b.reading) return { outcome: 'resolve', reading: b.reading };
    return { outcome: 'infer', need: { kind: 'extend', path: b.path, dir: b.extend!, text } };
  }
  if (best.length > 1) {
    const readings = best.flatMap((x) => (x.reading ? [x.reading] : []));
    if (readings.length > 1) return { outcome: 'ask', readings };
    if (readings.length === 1) return { outcome: 'resolve', reading: readings[0] };
  }
  if (thingsNamed.size) return { outcome: 'infer', need: { kind: 'unknown', text, things: [...thingsNamed] } };
  return { outcome: 'context', text };
}
