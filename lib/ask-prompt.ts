import languagesData from "@/content/languages.json";
import logData from "@/content/log.json";
import promptsData from "@/content/prompts.json";
import { blogPosts } from "@/lib/data";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// =============================================================================
// Ask's system prompt: who the assistant is, how it answers, and a map of the
// site.
//
// The map is what the model always has: every post, conviction, era and
// project by title and link, a few thousand tokens that never change between
// requests. The text behind each entry it fetches when it needs it, through
// the tools (systems/ask/lib/tools.ts). The whole site in every request would
// cost hundreds of thousands of tokens; the map and a few reads cost a small
// fraction of that.
//
// Server only. Built once per server instance and kept byte-identical, so a
// provider's prompt cache can hold it.
// =============================================================================

type Localized = string | { en?: string; zh?: string } | null | undefined;

function both(value: Localized): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  const { en, zh } = value;
  return en && zh && en !== zh ? `${en} / ${zh}` : en || zh || "";
}

/** The About, as prose: who Hux is, in his own words. */
function about(): string {
  const raw = readFileSync(join(process.cwd(), "content/about/en.mdx"), "utf8");
  return raw
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/<Footnotes>[\s\S]*?<\/Footnotes>/g, (m) => m.replace(/<[^>]+>/g, " "))
    .replace(/<Fn[^>]*\/>/g, "")
    .replace(/<\/?[A-Za-z][^>]*>/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function siteMap(): string {
  const posts = blogPosts.map((p) => {
    const langs = p.language === "both" ? ["en", "zh"] : [p.language];
    const title = p.titleZh && p.titleZh !== p.title ? `${p.title} / ${p.titleZh}` : p.title;
    const links = langs.map((l) => `/writing/${p.slug}/${l}`).join(" ");
    const tags = p.tags?.length ? ` [${p.tags.join(", ")}]` : "";
    return `- ${p.date} ${title}${tags}: ${links} (doc ids: ${langs.map((l) => `post:${p.slug}:${l}`).join(", ")})`;
  });
  const convictions = promptsData.convictions.map(
    (c) => `- ${both(c.anchor)}: ${both(c.statements[0]?.text)} (doc id: conviction:${c.id}:en|zh)`,
  );
  const influences = promptsData.influences.map(
    (i) => `- ${both(i.name as Localized)} (${both(i.context as Localized)}) (doc id: influence:${i.id}:en|zh)`,
  );
  const eras = logData.tags.map(
    (t) => `- ${t.startDate} ${both(t.title)}${t.company ? `, ${both(t.company as Localized)}` : ""} (doc id: era:${t.id}:en|zh)`,
  );
  const works = logData.commits.map(
    (c) => `- ${c.date} [${c.type}] ${both(c.title as Localized)} (doc id: work:${c.id}:en|zh)`,
  );
  const languages = languagesData.languages.map((l) => both(l.name as Localized)).join(", ");

  return [
    "## Posts (/writing)",
    ...posts,
    "",
    "## Convictions (/prompt, how Hux prompts himself)",
    ...convictions,
    "",
    "## Influences (/prompt)",
    ...influences,
    "",
    "## Career eras (/works)",
    ...eras,
    "",
    "## Talks and projects (/works)",
    ...works,
    "",
    "## Programming languages on the PL chart (/writing/pl-chart/en)",
    languages,
  ].join("\n");
}

let cached: string | null = null;

export function askSystemPrompt(): string {
  cached ??= `You are Ask, the assistant built into hux.pro, the personal site of Hux. You are not Hux: speak about him in the third person, and from what the site says.

# How to answer
- Questions about Hux, his work, his writing or his views: search the site first (search_site), and read a doc when a snippet is not enough. Search in both English and Chinese when the topic could be in either.
- Ground every claim in what you found. If the site does not say, say so plainly instead of guessing.
- Link what you used, with Markdown links to the site's own paths (e.g. [the PL chart](/writing/pl-chart/en)). Prefer the page in the reader's language when both exist.
- Reply in the language of the question. Keep it short: a few short paragraphs or a short list. No headings.
- Always end your turn with a written reply. A few searches are usually enough; stop and answer as soon as you can.
- General questions with nothing to do with the site: answer briefly, and do not search.

# About Hux (his own words, from the site's About)
${about()}

# Map of the site
Every entry is searchable and readable with the tools; the doc id is what read takes.
${siteMap()}`;
  return cached;
}
