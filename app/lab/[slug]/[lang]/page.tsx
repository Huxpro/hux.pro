import { MDXRenderer } from "@/components/mdx-renderer";
import { getLabItemBySlug, getLabSlugs } from "@/lib/mdx";
import { locales, type Locale } from "@/lib/i18n";
import { getLocalizedDescription, getLocalizedTitle } from "@/lib/content";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LabItemContent } from "../content";

export const dynamicParams = false;

export function generateStaticParams() {
  const params: { slug: string; lang: string }[] = [];

  for (const slug of getLabSlugs()) {
    const item = getLabItemBySlug(slug);
    if (!item || item.type === "external") continue;

    if (item.language === "both") {
      for (const lang of locales) params.push({ slug, lang });
    } else {
      params.push({ slug, lang: item.language });
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
  const item = getLabItemBySlug(slug);

  if (!item) return {};

  return {
    title: getLocalizedTitle(item, locale),
    description: getLocalizedDescription(item, locale),
  };
}

export default async function LabItemLangPage({
  params,
}: {
  params: Promise<{ slug: string; lang: string }>;
}) {
  const { slug, lang } = await params;
  const locale = lang as Locale;
  const item = getLabItemBySlug(slug);

  if (!item || item.type === "external") {
    notFound();
  }

  const content =
    locale === "zh" && item.contentZh ? item.contentZh : item.content;
  const credit =
    locale === "zh" && item.creditZh ? item.creditZh : item.credit;

  return (
    <LabItemContent
      slug={item.slug}
      title={item.title}
      titleZh={item.titleZh}
      date={item.date}
      type={item.type}
      href={item.href}
      credit={credit}
      locale={locale}
      language={item.language}
    >
      <MDXRenderer source={content} />
    </LabItemContent>
  );
}
