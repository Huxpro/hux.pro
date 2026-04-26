import { MDXRenderer } from "@/components/mdx-renderer";
import { getBlogPostBySlug, getBlogSlugs } from "@/lib/mdx";
import { defaultLocale, locales, type Locale } from "@/lib/i18n";
import { getLocalizedDescription, getLocalizedTitle } from "@/lib/content";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlogPostContent } from "../content";

export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = getBlogSlugs();
  const params: { slug: string; lang: string }[] = [];

  for (const slug of slugs) {
    const post = getBlogPostBySlug(slug);
    if (!post) continue;

    if (post.language === "both") {
      for (const lang of locales) {
        params.push({ slug, lang });
      }
    } else {
      params.push({ slug, lang: post.language });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}): Promise<Metadata> {
  const { slug, lang } = await params;
  const locale = lang as Locale;
  const post = getBlogPostBySlug(slug);

  if (!post) return {};

  const title = getLocalizedTitle(post, locale);
  const description = getLocalizedDescription(post, locale);

  const metadata: Metadata = { title, description };

  if (post.language === "both") {
    metadata.alternates = {
      languages: {
        en: `/writing/${slug}/en`,
        zh: `/writing/${slug}/zh`,
      },
    };
  }

  return metadata;
}

export default async function BlogPostLangPage({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  const locale = lang as Locale;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Select the content for the requested locale
  const content =
    locale === "zh" && post.contentZh ? post.contentZh : post.content;

  return (
    <BlogPostContent
      title={post.title}
      titleZh={post.titleZh}
      date={post.date}
      locale={locale}
      language={post.language}
      readingTime={post.readingTime}
      readingTimeZh={post.readingTimeZh}
      origin={post.origin}
      originZh={post.originZh}
    >
      <MDXRenderer source={content} />
    </BlogPostContent>
  );
}
