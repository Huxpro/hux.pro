// =============================================================================
// The corpus Ask reads: the shape of the index the build writes to
// public/ask/index.json (scripts/ask-index.ts) and the browser searches
// (./search.ts).
//
// Everything the site says is a doc: a post in one language, a conviction or
// an influence from /prompt, a commit or an era from /works, a language from
// the PL chart. A doc is cut into chunks at its headings and, past a length,
// at its paragraphs, so a search returns the passage and not the whole post.
// Each doc knows where it lives (`href`), so whatever the agent reads it can
// link to.
// =============================================================================

export type AskLang = "en" | "zh";

export type AskDocKind =
  | "post"
  | "conviction"
  | "influence"
  | "work"
  | "era"
  | "language";

export interface AskDoc {
  /** `post:pl-chart:en`, `conviction:reality:zh`, … */
  id: string;
  kind: AskDocKind;
  lang: AskLang;
  title: string;
  /** Where it lives on the site. */
  href: string;
  /** One line: a description, a date, a company. */
  summary?: string;
  date?: string;
}

export interface AskChunk {
  /** `<doc id>#<n>` */
  id: string;
  doc: string;
  /** The heading the passage sits under, if any. */
  heading?: string;
  /** The id of the nearest heading the page links (a post's h1 to h3):
   *  `<doc href>#<anchor>` lands on it. */
  anchor?: string;
  text: string;
}

export interface AskIndex {
  version: 1;
  docs: AskDoc[];
  chunks: AskChunk[];
}

/** Where the index is served. */
export const ASK_INDEX_URL = "/ask/index.json";
