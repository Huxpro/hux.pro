import { defaultFilter } from "cmdk";

const EXACT_PREFIX = "command-exact:";
const DETAIL_PREFIX = "command-detail:";
const INTERNAL_NAMESPACE = /^(?:app|blog)-/;
const SINGLE_LATIN_CHARACTER = /^[a-z0-9]$/i;

/** Encode category terms that should only match as a complete query. */
export function exactKeywords(keywords: string[]): string[] {
  return keywords.filter(Boolean).map((keyword) => `${EXACT_PREFIX}${keyword}`);
}

/**
 * Encode supporting metadata. It remains fuzzy-searchable, except for a
 * single Latin character: one letter occurring in a description or generic
 * alias is not enough evidence to surface an otherwise unrelated result.
 */
export function detailKeywords(keywords: string[]): string[] {
  return keywords.filter(Boolean).map((keyword) => `${DETAIL_PREFIX}${keyword}`);
}

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * The palette's one scoring policy.
 *
 * - Internal collection namespaces (`app-`, `blog-`) never affect relevance.
 * - Primary identity fields keep cmdk's fuzzy matching.
 * - Detail metadata is ignored for one-character Latin queries.
 * - Category metadata only matches a complete term.
 */
export function scorePaletteItem(
  value: string,
  search: string,
  keywords: string[] = [],
): number {
  const query = normalize(search);
  if (!query) return 1;

  const primary: string[] = [];
  const details: string[] = [];
  const exact: string[] = [];

  for (const keyword of keywords) {
    if (keyword.startsWith(EXACT_PREFIX)) {
      exact.push(keyword.slice(EXACT_PREFIX.length));
    } else if (keyword.startsWith(DETAIL_PREFIX)) {
      details.push(keyword.slice(DETAIL_PREFIX.length));
    } else {
      primary.push(keyword);
    }
  }

  const identityScore = defaultFilter(
    value.replace(INTERNAL_NAMESPACE, ""),
    search,
    primary,
  );
  const exactScore = exact.some((keyword) => normalize(keyword) === query) ? 1 : 0;
  const detailScore = SINGLE_LATIN_CHARACTER.test(query)
    ? 0
    : details.reduce(
        (best, keyword) => Math.max(best, defaultFilter(keyword, search)),
        0,
      );

  return Math.max(identityScore, exactScore, detailScore);
}
