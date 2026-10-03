// =============================================================================
// Words, for search, in both of the site's languages.
//
// Chinese has no spaces, so splitting on them finds nothing. Intl.Segmenter
// cuts it at its words (and English at its own), the same in the browser and
// in Node, so the index and the query are cut the same way. Where it is
// missing, letters and digits in a run stand in, and each Han character is a
// word of its own: coarser, but it still finds things.
// =============================================================================

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("zh", { granularity: "word" })
    : null;

const HAN = /\p{Script=Han}/u;

export function tokenize(text: string): string[] {
  const words: string[] = [];
  if (segmenter) {
    for (const s of segmenter.segment(text)) {
      if (s.isWordLike) words.push(s.segment);
    }
    return words;
  }
  for (const run of text.match(/[\p{L}\p{N}]+/gu) ?? []) {
    if (HAN.test(run)) words.push(...run);
    else words.push(run);
  }
  return words;
}

export function normalizeTerm(term: string): string {
  return term.toLowerCase();
}
