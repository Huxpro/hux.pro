// =============================================================================
// Words ⇄ tree: the first binding.
//
// The prompt is not only where a tree came from: it stays bound to it. Spans
// of it name a thing, an intent of it, and the kind they say (Tree.spans), and
// that binding is the model's, written with the tree. Here it is kept live:
//
//   an edit to the words      read into one event: a span reworded (its new
//                             words name a kind → ① resolve; they go further
//                             along → a kind more; neither → ② infer), a span
//                             deleted (the evidence is gone: the model believes
//                             again), or words added outside every span (a
//                             sentence said: the usual recognizer, and the
//                             words bound to what it lands on)
//   a pick from the words     the kind chosen, and the span rewritten to say it
//   the tree moving on        (a drag, an answer) a span whose kind is no
//                             longer the value "differs": its words can follow
// =============================================================================

import type { Value } from "./space";
import { key, type Intent, type Span, type Tree } from "./tree";

/** An author's (or a model's) binding, in reading order: [words, node, intent?, kind?]. */
export type Binding = readonly [string, string, string?, string?];

/** Spans from bindings, each found after the one before it. */
export function bindWords(prompt: string, list: readonly Binding[]): Span[] {
  const out: Span[] = [];
  let at = 0;
  for (const [text, node, intent, kind] of list) {
    const from = prompt.indexOf(text, at);
    if (from < 0) continue;
    out.push({ id: `w${out.length + 1}`, from, to: from + text.length, node, intent, kind, by: "model" });
    at = from + text.length;
  }
  return out;
}

export const textOf = (tree: Tree, s: Span) => tree.prompt.slice(s.from, s.to);

// -----------------------------------------------------------------------------
// Where the words and the tree stand with each other.
// -----------------------------------------------------------------------------

export type SpanStatus =
  /** Names a thing or an intent; says no kind. */
  | "names"
  /** Says the kind the tree has now. */
  | "agrees"
  /** Says one kind; the tree has another (a drag, an answer, a leaning moved it). */
  | "differs"
  /** Reworded, and nothing in the tree reads the new words (yet). */
  | "unread";

export function spanStatus(s: Span, values: Record<string, Value>): SpanStatus {
  if (s.unread) return "unread";
  if (!s.intent || !s.kind) return "names";
  const v = values[key(s.node, s.intent)];
  return !v || v.kind === s.kind ? "agrees" : "differs";
}

/** How a kind is said, to write it back into the words. */
export const wordsOf = (intent: Intent, kind: string) => intent.kinds[kind]?.words ?? intent.kinds[kind]?.label.zh ?? kind;

/** The prompt with one span's words replaced, every span after it shifted. */
export function rewrite(tree: Tree, spanId: string, text: string, patch: Partial<Span> = {}): { prompt: string; spans: Span[] } {
  const spans = tree.spans ?? [];
  const s = spans.find((x) => x.id === spanId);
  if (!s) return { prompt: tree.prompt, spans };
  const delta = text.length - (s.to - s.from);
  return {
    prompt: tree.prompt.slice(0, s.from) + text + tree.prompt.slice(s.to),
    spans: spans.map((x) => (x.id === s.id ? { ...x, ...patch, to: x.from + text.length } : x.from >= s.to ? { ...x, from: x.from + delta, to: x.to + delta } : x)),
  };
}

/** A span added (or one at the same place replaced), kept in order. */
export function withSpan(spans: readonly Span[], s: Span): Span[] {
  return [...spans.filter((x) => x.to <= s.from || x.from >= s.to), s].sort((a, b) => a.from - b.from);
}

let seq = 0;
export const spanId = () => `e${++seq}${Math.random().toString(36).slice(2, 5)}`;

// -----------------------------------------------------------------------------
// An edit to the words, read.
// -----------------------------------------------------------------------------

export type WordEdit =
  | { kind: "none" }
  /** A bound span's words changed: `span` is the span as it is now (its new words at from–to). */
  | { kind: "reword"; span: Span; text: string; old: string }
  /** A bound span's words are gone. */
  | { kind: "unsay"; span: Span; old: string }
  /** Words added outside every span. */
  | { kind: "insert"; text: string; from: number; to: number };

/**
 * The prompt edited to `next`: the changed stretch (between what the two share
 * at the start and the end), the spans moved past it, and what it means for
 * the one span it touches (or for none).
 */
export function readEdit(tree: Tree, next: string): { spans: Span[]; edit: WordEdit } {
  const prev = tree.prompt;
  const spans = tree.spans ?? [];
  if (prev === next) return { spans, edit: { kind: "none" } };
  let p = 0;
  while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
  let s = 0;
  while (s < prev.length - p && s < next.length - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  const oldEnd = prev.length - s;
  const newEnd = next.length - s;
  const delta = next.length - prev.length;
  // Touched: overlapping the old stretch, or (for an insertion) strictly inside a span.
  const touched = spans.filter((x) => (oldEnd > p ? x.from < oldEnd && x.to > p : x.from < p && x.to > p));
  const moved = spans.filter((x) => !touched.includes(x)).map((x) => (x.from >= oldEnd ? { ...x, from: x.from + delta, to: x.to + delta } : x));

  if (!touched.length) {
    const text = next.slice(p, newEnd).trim();
    return { spans: moved, edit: text ? { kind: "insert", text, from: p, to: newEnd } : { kind: "none" } };
  }
  // The first span touched is the one the edit is about; any others it ran into are gone.
  const t = touched[0];
  const from = Math.min(t.from, p);
  const to = Math.max(t.to, oldEnd) + delta;
  const words = next.slice(from, Math.max(from, to));
  const old = prev.slice(t.from, t.to);
  if (!words.trim() || (oldEnd > p && newEnd === p && t.from >= p && t.to <= oldEnd)) return { spans: moved, edit: { kind: "unsay", span: t, old } };
  const span: Span = { ...t, from, to, unread: true, by: "person" };
  return { spans: withSpan(moved, span), edit: { kind: "reword", span, text: words, old } };
}

// -----------------------------------------------------------------------------
// New words for an intent: which kind they say.
// -----------------------------------------------------------------------------

const MORE_WORDS = ["更", "再", "还要", "越发", "极", "超", "特别", "非常", "离谱", "得像", "得吓人", "more", "even"];
const LESS_WORDS = ["一点点", "稍", "微微", "没那么", "不太", "less", "slightly"];

/**
 * A kind of `intent` the words name (its words, label or aka: the longest that
 * appears), or which way along an ordered intent they go when they name none.
 */
export function readWords(intent: Intent, text: string): { kind: string } | { dir: 1 | -1 } | null {
  const t = text.toLowerCase();
  let best: { kind: string; len: number } | null = null;
  for (const [id, k] of Object.entries(intent.kinds))
    for (const w of [k.words, k.label.zh, k.label.en, ...(k.aka ?? [])])
      if (w && t.includes(w.toLowerCase()) && (!best || w.length > best.len)) best = { kind: id, len: w.length };
  if (best) return { kind: best.kind };
  if (!intent.ordered) return null;
  if ([...(intent.more ?? []), ...MORE_WORDS].some((w) => t.includes(w))) return { dir: 1 };
  if ([...(intent.less ?? []), ...LESS_WORDS].some((w) => t.includes(w))) return { dir: -1 };
  return null;
}
