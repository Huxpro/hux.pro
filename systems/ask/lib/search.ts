import MiniSearch from "minisearch";
import { ASK_INDEX_URL, type AskChunk, type AskDoc, type AskIndex } from "./corpus";
import type { ReadInput, ReadOutput, SearchHit, SearchInput } from "./tools";
import { normalizeTerm, tokenize } from "./tokenize";

// =============================================================================
// The site's text, searchable in the browser.
//
// Fetched once, the first time something asks (opening Ask, or a full-text
// query in the palette), then kept for the page's life; nothing is loaded
// with the page itself. One file with the text in it, so `read` needs no
// second request: at this size (a few hundred KB gzipped) a separate file per
// doc would save little on the first load and cost a round trip on every
// read. Built into a BM25 index (MiniSearch) on arrival.
// =============================================================================

export type { ReadOutput, SearchHit };

export interface AskSearch {
  /** The docs among these ids that exist (a passage id counts as its doc),
   *  once each, in order. */
  docsOf: (ids: readonly string[]) => AskDoc[];
  docs: Map<string, AskDoc>;
  search: (input: SearchInput) => SearchHit[];
  read: (input: ReadInput) => ReadOutput;
}

/** A doc read in full is cut here; long posts are read a passage at a time. */
const MAX_READ = 12000;
const SNIPPET = 220;

let pending: Promise<AskSearch> | null = null;

export function loadAskSearch(): Promise<AskSearch> {
  pending ??= fetch(ASK_INDEX_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`ask index: ${r.status}`);
      return r.json() as Promise<AskIndex>;
    })
    .then(build)
    .catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}

/** The text around the first query word found, on one line. */
function snippetOf(text: string, terms: string[]): string {
  const flat = text.replace(/\s+/g, " ");
  const lower = flat.toLowerCase();
  const at = terms
    .map((t) => lower.indexOf(t.toLowerCase()))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0];
  if (at === undefined || flat.length <= SNIPPET) return flat.slice(0, SNIPPET);
  const start = Math.max(0, at - SNIPPET / 3);
  return `${start > 0 ? "…" : ""}${flat.slice(start, start + SNIPPET)}…`;
}

/** Where a passage lives: its doc, at the heading it sits under when the
 *  page links its headings. */
function hrefOf(doc: AskDoc, chunk?: AskChunk): string {
  return chunk?.anchor ? `${doc.href}#${chunk.anchor}` : doc.href;
}

function build(index: AskIndex): AskSearch {
  const docs = new Map(index.docs.map((d) => [d.id, d]));
  const chunks = new Map(index.chunks.map((c) => [c.id, c]));
  const byDoc = new Map<string, AskChunk[]>();
  for (const c of index.chunks) {
    const list = byDoc.get(c.doc) ?? [];
    list.push(c);
    byDoc.set(c.doc, list);
  }

  const mini = new MiniSearch<{ id: string; title: string; heading: string; text: string; lang: string }>({
    fields: ["title", "heading", "text"],
    storeFields: ["lang"],
    tokenize,
    processTerm: normalizeTerm,
    searchOptions: {
      boost: { title: 3, heading: 2 },
      prefix: (term) => term.length > 2,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
    },
  });
  mini.addAll(
    index.chunks.map((c) => ({
      id: c.id,
      title: docs.get(c.doc)?.title ?? "",
      heading: c.heading ?? "",
      text: c.text,
      lang: docs.get(c.doc)?.lang ?? "en",
    })),
  );

  function search({ query, lang = "any", limit = 6 }: SearchInput): SearchHit[] {
    const n = Math.min(Math.max(Math.round(limit) || 6, 1), 10);
    const results = mini.search(query, {
      filter: lang === "any" ? undefined : (r) => r.lang === lang,
    });
    const terms = tokenize(query);
    const hits: SearchHit[] = [];
    const perDoc = new Map<string, number>();
    for (const r of results) {
      const chunk = chunks.get(String(r.id));
      const doc = chunk && docs.get(chunk.doc);
      if (!chunk || !doc) continue;
      // At most two passages from one doc, so one long post cannot crowd out
      // everything else.
      const seen = perDoc.get(doc.id) ?? 0;
      if (seen >= 2) continue;
      perDoc.set(doc.id, seen + 1);
      hits.push({
        id: chunk.id,
        doc: doc.id,
        kind: doc.kind,
        lang: doc.lang,
        title: doc.title,
        ...(chunk.heading ? { heading: chunk.heading } : {}),
        href: hrefOf(doc, chunk),
        snippet: snippetOf(chunk.text, terms),
      });
      if (hits.length >= n) break;
    }
    return hits;
  }

  function read({ id }: ReadInput): ReadOutput {
    const chunk = chunks.get(id);
    const doc = docs.get(chunk ? chunk.doc : id);
    if (!doc) return { error: `No doc or passage with id "${id}". Use an id from search_site.` };
    const parts = chunk ? [chunk] : (byDoc.get(doc.id) ?? []);
    const full = parts
      .map((c) => (c.heading ? `## ${c.heading}\n${c.text}` : c.text))
      .join("\n\n");
    return {
      id,
      doc: doc.id,
      title: doc.title,
      href: hrefOf(doc, chunk),
      lang: doc.lang,
      ...(doc.summary ? { summary: doc.summary } : {}),
      ...(doc.date ? { date: doc.date } : {}),
      text: full.slice(0, MAX_READ),
      ...(full.length > MAX_READ ? { truncated: true } : {}),
    };
  }

  function docsOf(ids: readonly string[]): AskDoc[] {
    const out = new Map<string, AskDoc>();
    for (const id of ids) {
      const doc = docs.get(chunks.get(id)?.doc ?? id);
      if (doc) out.set(doc.id, doc);
    }
    return [...out.values()];
  }

  return { docs, search, read, docsOf };
}
