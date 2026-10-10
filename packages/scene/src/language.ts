// =============================================================================
// The language layer: the words a scene came from, and what they meant.
//
//   prompt     the original words, with the spans that name things marked by
//              the path they resolve to: ["衣柜门打开", "wardrobe.door"]
//   concepts   what the words were understood as, before they were names in
//              code: an entity, a part, a place, a relation, an event, a param
//
// Authored beside each experience (it is the experience's own reading of its
// story), read by an inspector to line words up with things on screen.
// =============================================================================

export type Localized = { zh: string; en: string };

export interface Concept {
  /** The words, as said. */
  words: Localized;
  /** What kind of meaning, and anything it carries. */
  kind: Localized;
  /** The path it resolves to. */
  ref: string;
  /** Where it lands, when that is more than the ref (a param, two instances). */
  lands?: string;
}

export interface LanguageLayer {
  prompt: readonly (string | readonly [string, string])[];
  concepts: readonly Concept[];
}
