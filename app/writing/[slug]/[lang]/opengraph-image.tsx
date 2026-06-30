import { getLocalizedReadingTime, getLocalizedTitle } from "@/lib/content";
import { locales, type Locale } from "@/lib/i18n";
import { getBlogPostBySlug, getBlogSlugs } from "@/lib/mdx";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const dynamicParams = false;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Mirror the post page so every writing/locale gets a baked card at build time.
export function generateStaticParams() {
  const params: { slug: string; lang: string }[] = [];
  for (const slug of getBlogSlugs()) {
    const post = getBlogPostBySlug(slug);
    if (!post) continue;
    if (post.language === "both") {
      for (const lang of locales) params.push({ slug, lang });
    } else {
      params.push({ slug, lang: post.language });
    }
  }
  return params;
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  const locale = lang as Locale;
  const post = getBlogPostBySlug(slug);

  // Fall back to the section card if the post can't be resolved.
  if (!post) {
    return renderOgImage({
      title: "Writing",
      eyebrow: "/writing",
      meta: "thoughts on craft, software, and practice",
    });
  }

  const title = getLocalizedTitle(post, locale);
  const cover = locale === "zh" && post.coverZh ? post.coverZh : post.cover;
  const year = post.date?.slice(0, 4);
  const readingTime = getLocalizedReadingTime(post, locale);
  const meta = [year, readingTime].filter(Boolean).join(" · ");

  return renderOgImage({
    title,
    eyebrow: "/writing",
    meta,
    cover,
  });
}
