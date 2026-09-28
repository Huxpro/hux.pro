import { MDXRenderer } from "@/components/mdx-renderer";
import { getBlogPostBySlug, getBlogSlugs } from "@/lib/mdx";
import { defaultLocale, locales, type Locale } from "@/lib/i18n";
import { postCardOf } from "@/lib/content";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BlogPostContent } from "../content";
import { DevtoolPageMeta } from "@/systems/devtool";

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

const OG_LOCALE: Record<Locale, string> = { en: "en_US", zh: "zh_CN" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}): Promise<Metadata> {
  const { slug, lang } = await params;
  const locale = lang as Locale;
  const post = getBlogPostBySlug(slug);

  if (!post) return {};

  const card = postCardOf(post, locale);

  // What a crawler reads off this page: the post's title (no "| Hux.Pro")
  // and its first paragraph, the ones this site's own cards of the post
  // print. The image is the card baked for sharing it, which the
  // `opengraph-image` route beside this page adds by itself. Set whole,
  // because a page's `openGraph` replaces the layout's rather than merging
  // with it.
  const metadata: Metadata = {
    title: card.title,
    description: card.description,
    alternates: { canonical: card.url },
    openGraph: {
      type: "article",
      siteName: "Hux.Pro",
      url: card.url,
      title: card.title,
      description: card.description,
      locale: OG_LOCALE[locale],
      publishedTime: card.date,
    },
    twitter: {
      card: "summary_large_image",
      title: card.title,
      description: card.description,
    },
  };

  if (post.language === "both") {
    metadata.alternates!.languages = {
      en: `/writing/${slug}/en`,
      zh: `/writing/${slug}/zh`,
    };
    metadata.openGraph = {
      ...metadata.openGraph,
      alternateLocale: OG_LOCALE[locale === "en" ? "zh" : "en"],
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

  // Verbatim frontmatter for the locale being rendered — fed to the devtool
  // inspector. Falls back to the primary file's frontmatter when a locale
  // variant is absent.
  const frontmatter =
    (locale === "zh" ? post.frontmatterZh ?? post.frontmatter : post.frontmatter) ??
    {};

  return (
    <>
      <DevtoolPageMeta
        slug={slug}
        lang={lang}
        language={post.language}
        frontmatter={frontmatter}
      />
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
    </>
  );
}
