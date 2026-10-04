import languagesData from "@/content/languages.json";
import logData from "@/content/log.json";
import promptsData from "@/content/prompts.json";
import { blogPosts } from "@/lib/data";
import { ASK_INSTRUCTIONS, ASK_MAP_SECTIONS } from "@/systems/ask/prompts";
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
// The words are systems/ask/prompts.ts; this file only fills them in.
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
    ASK_MAP_SECTIONS.posts,
    ...posts,
    "",
    ASK_MAP_SECTIONS.convictions,
    ...convictions,
    "",
    ASK_MAP_SECTIONS.influences,
    ...influences,
    "",
    ASK_MAP_SECTIONS.eras,
    ...eras,
    "",
    ASK_MAP_SECTIONS.works,
    ...works,
    "",
    ASK_MAP_SECTIONS.languages,
    languages,
  ].join("\n");
}

let cached: string | null = null;

export function askSystemPrompt(): string {
  cached ??= ASK_INSTRUCTIONS({ about: about(), map: siteMap() });
  return cached;
}
