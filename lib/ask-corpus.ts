import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getBlogPostBySlug, getBlogSlugs } from "@/lib/mdx";
import type {
  AskChunk,
  AskDoc,
  AskIndex,
  AskLang,
} from "@/systems/ask/lib/corpus";

// =============================================================================
// The site, read once at build time into the index Ask searches
// (systems/ask/lib/corpus.ts has the shape; scripts/ask-index.ts writes it).
//
// Node only: it reads the posts and the JSON content off disk, the same
// records the pages render.
// =============================================================================

const LANGS: AskLang[] = ["en", "zh"];

/** Read off disk, typed as the module: plain Node will not import JSON
 *  without an attribute Next does not want. */
function readContent<T>(file: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), "content", file), "utf8")) as T;
}

const promptsData = readContent<typeof import("@/content/prompts.json")>("prompts.json");
const logData = readContent<typeof import("@/content/log.json")>("log.json");
const languagesData = readContent<typeof import("@/content/languages.json")>("languages.json");

/** A passage longer than this is cut at its paragraphs. Characters, not
 *  tokens: a Chinese passage of this length is about as many tokens. */
const MAX_CHUNK = 1200;

type Localized = string | { en?: string; zh?: string } | null | undefined;

/** The string in `lang`, the other language's when only that exists. */
function loc(value: Localized, lang: AskLang): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] ?? value[lang === "en" ? "zh" : "en"] ?? "";
}

/** Has its own text in `lang` (not a fallback). */
function hasLang(value: Localized, lang: AskLang): boolean {
  if (value == null) return false;
  if (typeof value === "string") return true;
  return Boolean(value[lang]);
}

/** MDX as plain prose: no frontmatter, components, markup or URLs. */
export function toPlainText(mdx: string): string {
  return (
    mdx
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/^\s*(import|export)\s.*$/gm, "")
      // Fenced code stays (it is content) but loses its fences.
      .replace(/^```.*$/gm, "")
      // Components and HTML: the tags go, any text between them stays.
      .replace(/<\/?[A-Za-z][^>]*\/?>/g, " ")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^>\s?/gm, "")
      .replace(/[*_~`]{1,3}/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Paragraph runs of at most MAX_CHUNK characters. */
function pack(text: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (current && current.length + p.length + 2 > MAX_CHUNK) {
      out.push(current);
      current = "";
    }
    // A single paragraph past the limit is cut where it must be.
    if (p.length > MAX_CHUNK) {
      for (let i = 0; i < p.length; i += MAX_CHUNK) out.push(p.slice(i, i + MAX_CHUNK));
      continue;
    }
    current = current ? `${current}\n\n${p}` : p;
  }
  if (current) out.push(current);
  return out;
}

/** A markdown body cut at its headings, then packed. */
function sections(markdown: string): { heading?: string; text: string }[] {
  const out: { heading?: string; text: string }[] = [];
  let heading: string | undefined;
  let buffer: string[] = [];
  const flush = () => {
    const text = toPlainText(buffer.join("\n"));
    for (const piece of pack(text)) out.push({ heading, text: piece });
    buffer = [];
  };
  for (const line of markdown.split("\n")) {
    const m = /^#{1,4}\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      flush();
      heading = toPlainText(m[1]);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return out;
}

class Builder {
  docs: AskDoc[] = [];
  chunks: AskChunk[] = [];

  add(doc: AskDoc, parts: { heading?: string; text: string }[]) {
    const kept = parts.filter((p) => p.text.trim());
    if (!kept.length) return;
    this.docs.push(doc);
    kept.forEach((p, i) => {
      this.chunks.push({
        id: `${doc.id}#${i}`,
        doc: doc.id,
        ...(p.heading ? { heading: p.heading } : {}),
        text: p.text,
      });
    });
  }
}

function addPosts(b: Builder) {
  for (const slug of getBlogSlugs()) {
    const post = getBlogPostBySlug(slug);
    if (!post) continue;
    const bodies: [AskLang, string | undefined][] = [
      ["en", post.language === "zh" ? undefined : post.content],
      ["zh", post.contentZh],
    ];
    for (const [lang, body] of bodies) {
      if (!body) continue;
      const title = lang === "zh" ? post.titleZh || post.title : post.title;
      const summary =
        (lang === "zh" ? post.descriptionZh : post.description) || undefined;
      b.add(
        {
          id: `post:${slug}:${lang}`,
          kind: "post",
          lang,
          title,
          href: `/writing/${slug}/${lang}`,
          summary,
          date: post.date,
        },
        sections(body),
      );
    }
  }
}

function addPrompts(b: Builder) {
  for (const c of promptsData.convictions) {
    for (const lang of LANGS) {
      const statements = c.statements
        .map((s) => {
          const facet = "facet" in s ? loc(s.facet as Localized, lang) : "";
          const text = loc(s.text, lang);
          const q =
            "quotedFrom" in s && s.quotedFrom
              ? ` (${loc(s.quotedFrom.name as Localized, lang)}${
                  s.quotedFrom.source ? `, ${loc(s.quotedFrom.source as Localized, lang)}` : ""
                })`
              : "";
          return `${facet ? `${facet}: ` : ""}${text}${q}`;
        })
        .join("\n");
      const instances = (c.instances ?? []).map((i) => ({
        heading: toPlainText(loc(i.title as Localized, lang)),
        text: toPlainText(loc(i.text as Localized, lang)),
      }));
      const anchor = loc(c.anchor, lang);
      b.add(
        {
          id: `conviction:${c.id}:${lang}`,
          kind: "conviction",
          lang,
          title: anchor,
          href: `/prompt#${encodeURIComponent(anchor)}`,
          summary: loc(c.statements[0]?.text, lang) || undefined,
        },
        [
          { text: toPlainText(statements) },
          ...pack(toPlainText(loc(c.body as Localized, lang))).map((text) => ({ text })),
          ...instances.flatMap((i) => pack(i.text).map((text) => ({ heading: i.heading, text }))),
        ],
      );
    }
  }
  for (const i of promptsData.influences) {
    for (const lang of LANGS) {
      const anchor = loc(i.anchor, lang);
      const name = loc(i.name as Localized, lang);
      b.add(
        {
          id: `influence:${i.id}:${lang}`,
          kind: "influence",
          lang,
          title: name,
          href: `/prompt#${encodeURIComponent(anchor)}`,
          summary: loc(i.context as Localized, lang) || undefined,
        },
        pack(toPlainText(`${name}\n\n${loc(i.body as Localized, lang)}`)).map((text) => ({
          text,
        })),
      );
    }
  }
}

function addWorks(b: Builder) {
  for (const t of logData.tags) {
    for (const lang of LANGS) {
      const title = loc(t.title, lang);
      const company = loc(t.company as Localized, lang);
      b.add(
        {
          id: `era:${t.id}:${lang}`,
          kind: "era",
          lang,
          title: company ? `${title} (${company})` : title,
          href: "/works",
          summary: loc(t.keywords as Localized, lang) || undefined,
          date: t.startDate,
        },
        [{ text: toPlainText(loc(t.narrative as Localized, lang)) }],
      );
    }
  }
  for (const c of logData.commits) {
    for (const lang of LANGS) {
      if (!hasLang(c.title as Localized, lang)) continue;
      const conference = "conference" in c ? loc(c.conference as Localized, lang) : "";
      const text = [loc(c.title as Localized, lang), conference, loc(c.description as Localized, lang)]
        .filter(Boolean)
        .join("\n\n");
      b.add(
        {
          id: `work:${c.id}:${lang}`,
          kind: "work",
          lang,
          title: loc(c.title as Localized, lang),
          href: c.type === "talk" ? "/works?type=talk" : "/works",
          summary: [c.type, conference].filter(Boolean).join(" · ") || undefined,
          date: c.date,
        },
        [{ text: toPlainText(text) }],
      );
    }
  }
}

function addLanguages(b: Builder) {
  for (const l of languagesData.languages) {
    for (const lang of LANGS) {
      const notes = (l.notes as { en?: string[]; zh?: string[] } | undefined)?.[lang] ?? [];
      const name = loc(l.name as Localized, lang);
      b.add(
        {
          id: `language:${l.id}:${lang}`,
          kind: "language",
          lang,
          title: name,
          href: `/writing/pl-chart/${lang}`,
          summary: `interesting ${l.i13s}/10, used ${l.exp}/10`,
        },
        pack(toPlainText([name, ...notes].join("\n\n"))).map((text) => ({ text })),
      );
    }
  }
}

export function buildAskIndex(): AskIndex {
  const b = new Builder();
  addPosts(b);
  addPrompts(b);
  addWorks(b);
  addLanguages(b);
  return { version: 1, docs: b.docs, chunks: b.chunks };
}
