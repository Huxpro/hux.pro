import { MDXRenderer } from "@/components/mdx-renderer";
import { getDocBySlug, getDocSlugs } from "@/lib/mdx";
import { defaultLocale, locales, type Locale } from "@/lib/i18n";
import { getLocalizedDescription, getLocalizedTitle } from "@/lib/content";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DocContent } from "./content";

/** Where a skill's file is read: the repository, since `.claude/` is not served. */
const SKILL_URL = "https://github.com/Huxpro/hux.pro/blob/main/.claude/skills";

/**
 * The colophon a doc closes with, the way a post's `origin` closes the post:
 * its provenance, then the skill(s) it is the long form of. Small print, not a
 * banner over the title: a reader looks it up once, an agent reads the skill.
 */
function colophon(origin: string | undefined, skills: string[] | undefined, lang: Locale) {
  const links = (skills ?? []).map((name) => `[${name}](${SKILL_URL}/${name}/SKILL.md)`);
  const skillNote = links.length
    ? lang === "zh"
      ? `本页的清单版本是 Claude Code skill：${links.join("、")}`
      : `The checklist form of this page is the Claude Code ${links.length > 1 ? "skills" : "skill"} ${links.join(", ")}`
    : undefined;
  const parts = [origin, skillNote].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export function generateStaticParams() {
  const slugs = getDocSlugs();
  const params: { slug: string[] }[] = [];

  for (const docSlug of slugs) {
    const doc = getDocBySlug(docSlug);
    if (!doc) continue;

    if (doc.language === "both") {
      for (const lang of locales) {
        params.push({ slug: [docSlug, lang] });
      }
    } else {
      params.push({ slug: [docSlug, doc.language] });
    }
  }

  return params;
}

// Enable dynamic rendering in development for hot-reloading new docs
export const dynamicParams = true;

function parseSlugAndLocale(slugSegments: string[]): {
  docSlug: string;
  locale: Locale | null;
} {
  const last = slugSegments[slugSegments.length - 1];
  if (last === "en" || last === "zh") {
    return {
      docSlug: slugSegments.slice(0, -1).join("/"),
      locale: last as Locale,
    };
  }
  return { docSlug: slugSegments.join("/"), locale: null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { docSlug, locale } = parseSlugAndLocale(slug);

  if (!locale) return {};

  const doc = getDocBySlug(docSlug);
  if (!doc) return {};

  const title = getLocalizedTitle(doc, locale);
  const description = getLocalizedDescription(doc, locale);

  const metadata: Metadata = { title, description };

  if (doc.language === "both") {
    metadata.alternates = {
      languages: {
        en: `/docs/${docSlug}/en`,
        zh: `/docs/${docSlug}/zh`,
      },
    };
  }

  return metadata;
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const { docSlug, locale } = parseSlugAndLocale(slug);

  // Bare /docs/slug → redirect to /docs/slug/{locale}
  if (!locale) {
    redirect(`/docs/${docSlug}/${defaultLocale}`);
  }

  const doc = getDocBySlug(docSlug);

  if (!doc) {
    notFound();
  }

  // Remove the title from content since we display it separately
  const rawContent =
    locale === "zh" && doc.contentZh ? doc.contentZh : doc.content;
  // Frontmatter leaves a blank line before the title: allow for it.
  const content = rawContent.replace(/^\s*#\s+.+\n/, "");

  return (
    <DocContent
      title={doc.title}
      titleZh={doc.titleZh}
      locale={locale}
      language={doc.language}
      readingTime={doc.readingTime}
      readingTimeZh={doc.readingTimeZh}
      origin={colophon(doc.origin, doc.skills, "en")}
      originZh={colophon(doc.originZh, doc.skills, "zh")}
    >
      <MDXRenderer source={content} />
    </DocContent>
  );
}
