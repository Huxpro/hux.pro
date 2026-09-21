// =============================================================================
// Prompt View State — which of the system prompt is on screen.
//
// The page has two kinds of entry and one axis under one of them: a
// conviction is something I hold and sits `on` a topic, an influence is who
// trained it and sits on nobody's shelf. So there are exactly two controls —
// kind and topic — and this module is their vocabulary plus the URL codec
// that makes a reading shareable, the way `lib/log-view` does for /works.
//
// Deliberately free of React and of `lib/prompts` (which reads the file
// system): the client toolbar, the widget on the home screen and the loader
// all need the topic names, and only the loader can touch `fs`.
// =============================================================================

// =============================================================================
// Topics — three, and they are not subject matter.
//
// The first cut of this page filed things by what they were about:
// architecture, craft, process, open source. That is how a blog is indexed,
// and it made the page a library. A belief is not about a subject, though —
// it is about a *mode*: the faculty you are using when you hold it. So the
// shelves are the modes, in the order they build on each other, and they
// double as the page's reading order.
//
//   天行 Worlding — how the world runs, and where my part in it ends
//   修身 Being     — who I am when no one is watching
//   行事 Doing     — how the work is made, and what it owes the people in it
//
// There were four. `知势 Steering` (fortune, timing, position) sat apart
// from `格物 Knowing` (what is true) until each had shrunk to two entries
// and neither had an argument inside it. Folded together they do: the world
// swings on its own → so I go and find out how → so I do my part and stop
// paying rent on the rest → so the result is not mine to settle → and it
// swings again. Split them back out when the material for either grows
// past that loop.
//
// 天行 is Xunzi's heaven, not anyone's god: 「天行有常，不为尧存，不为桀亡」
// — the world runs to its own constant and does not care who is watching.
// Worlding is the same claim in English, the world as a verb rather than a
// container, which is why the label is not 「格物」: three of those four
// entries are about the world's own behaviour, not about my investigating
// it. 「格物致知」 is still on the page — it belongs to one entry inside
// this shelf, not to the shelf.
//
// Each of the three now has a shape of its own: 天行 is a loop, 修身 is a
// loop, 行事 is a pipeline with a multiplier at the end.
//
// The cut is by subject, not by vibe: ask who the sentence governs. The
// world, and the part of it I cannot move → Worlding. Me → Being. The
// artifact and the people around it → Doing.
//
// One shelf each. A second tag is always available and should stay a last
// resort: nearly every belief *touches* two modes — a demo is evidence as
// well as a way of working — and tagging what it touches instead of what it
// governs turns the filter back into a search box, where nothing is
// anywhere in particular. Right now none of them need it, and the three
// shelves partition the page: 4 + 4 + 5. Where a belief really does reach
// into another mode, it says so in an instance that links there, which is
// the more useful sentence anyway.
//
// Only convictions are filed. An influence has no topic — see `Influence`
// in `lib/prompts` — so a topic is a reading of the beliefs, and the people
// behind them are reached through the links, not through the shelf.
// =============================================================================

export const PROMPT_TOPICS = ["worlding", "being", "doing"] as const;

export type PromptTopic = (typeof PROMPT_TOPICS)[number];

const TOPIC_LABEL: Record<PromptTopic, { en: string; zh: string }> = {
  worlding: { en: "Worlding", zh: "天行" },
  being: { en: "Being", zh: "修身" },
  doing: { en: "Doing", zh: "行事" },
};

export function topicLabel(
  topic: PromptTopic,
  locale: "en" | "zh" = "en",
): string {
  return TOPIC_LABEL[topic][locale];
}

export function isPromptTopic(value: string): value is PromptTopic {
  return (PROMPT_TOPICS as readonly string[]).includes(value);
}

// =============================================================================
// Kind — the page's other axis, and the one the reader feels first.
// =============================================================================

export const PROMPT_KINDS = ["conviction", "influence"] as const;

export type PromptKind = (typeof PROMPT_KINDS)[number];

export interface PromptViewState {
  /** Selected kinds; empty is "both" (no filter). */
  kinds: PromptKind[];
  /** Selected topics; empty is "all". */
  topics: PromptTopic[];
}

/** Toggle one value in a selection, keeping the canonical order so two equal
 *  selections always serialize to the same string. */
function toggle<T extends string>(
  selected: readonly T[],
  value: T,
  order: readonly T[],
): T[] {
  const next = selected.includes(value)
    ? selected.filter((v) => v !== value)
    : [...selected, value];
  return order.filter((v) => next.includes(v));
}

export function toggleKind(
  kinds: readonly PromptKind[],
  kind: PromptKind,
): PromptKind[] {
  return toggle(kinds, kind, PROMPT_KINDS);
}

export function toggleTopic(
  topics: readonly PromptTopic[],
  topic: PromptTopic,
): PromptTopic[] {
  return toggle(topics, topic, PROMPT_TOPICS);
}

/**
 * Whether an entry survives the current reading. Empty is everything, and a
 * conviction that did earn a second shelf answers to either of them — the
 * matching is any-of, so the rare double is readable from both sides rather
 * than hidden from one.
 *
 * An influence carries no topics, so picking one narrows the page to the
 * convictions on that shelf and sets the people aside. That is the honest
 * reading — 行事 is a list of what I do, not of who taught me — and a link
 * out of it into an influence lifts the filter rather than dead-ending
 * (`app/prompt/view`).
 */
export function matchesView(
  state: PromptViewState,
  entry: { kind: PromptKind; topics?: readonly PromptTopic[] },
): boolean {
  if (state.kinds.length > 0 && !state.kinds.includes(entry.kind)) return false;
  if (
    state.topics.length > 0 &&
    !entry.topics?.some((topic) => state.topics.includes(topic))
  )
    return false;
  return true;
}

// =============================================================================
// URL codec
// =============================================================================

export const KIND_PARAM = "kind";
export const TOPIC_PARAM = "topic";

/**
 * Read view state out of a query string. Tolerant by design: a hand-edited
 * or stale URL degrades to "everything" rather than to an empty page.
 */
export function parsePromptView(params: URLSearchParams): PromptViewState {
  const read = <T extends string>(param: string, order: readonly T[]): T[] => {
    const raw = params.get(param);
    const requested = raw ? raw.split(",").map((s) => s.trim()) : [];
    return order.filter((v) => requested.includes(v));
  };

  return {
    kinds: read(KIND_PARAM, PROMPT_KINDS),
    topics: read(TOPIC_PARAM, PROMPT_TOPICS),
  };
}

/**
 * Write view state back into a query string, dropping empty params so the
 * plain `/prompt` URL stays clean, and preserving query state another
 * feature owns.
 */
export function serializePromptView(
  state: PromptViewState,
  current?: URLSearchParams,
): string {
  const params = new URLSearchParams(current?.toString());

  for (const [param, values] of [
    [KIND_PARAM, state.kinds],
    [TOPIC_PARAM, state.topics],
  ] as const) {
    if (values.length > 0) params.set(param, values.join(","));
    else params.delete(param);
  }

  return params.toString();
}
