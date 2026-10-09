import { headingId } from "@/lib/heading-id";

type DocLang = "en" | "zh";

/** A doc's link to another doc, as the files write it: `./slug.md#anchor`. */
const DOC_LINK = /\]\(\.\/([\w-]+)\.mdx?(#[^)\s]*)?\)/g;

/**
 * The ids a doc's headings wear on its page: h1–h3 take one from their text
 * (components/heading-link.tsx), an h4 does not. A `#` in a code block is
 * not a heading.
 */
export function headingIds(markdown: string): Set<string> {
  const ids = new Set<string>();
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const m = fenced ? null : /^#{1,3}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = m[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*~`]/g, "");
    ids.add(headingId(text));
  }
  return ids;
}

/**
 * A doc's links to other docs, pointed at their pages. The files link
 * `./other.md#anchor` so the link works on GitHub; on the site the page is
 * /docs/other/<lang>. A Chinese page keeps its reader in Chinese, unless the
 * other doc has no Chinese version or the anchor is a heading only the
 * English page has (a translation links the English heading's id).
 */
export function linkDocs(
  markdown: string,
  lang: DocLang,
  idsOf: (slug: string, lang: DocLang) => Set<string> | undefined,
): string {
  return markdown.replace(DOC_LINK, (_, slug: string, hash = "") => {
    let target: DocLang = lang;
    if (lang === "zh") {
      const ids = idsOf(slug, "zh");
      if (!ids || (hash && !ids.has(decodeURIComponent(hash.slice(1))))) target = "en";
    }
    return `](/docs/${slug}/${target}${hash})`;
  });
}
