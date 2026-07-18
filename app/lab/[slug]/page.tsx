import { getLabItemBySlug, getLabSlugs } from "@/lib/mdx";
import { defaultLocale } from "@/lib/i18n";
import { notFound, redirect } from "next/navigation";

export function generateStaticParams() {
  // Only items with a detail page (inline / embed). External items link out.
  return getLabSlugs()
    .map((slug) => ({ slug, item: getLabItemBySlug(slug) }))
    .filter(({ item }) => item && item.type !== "external")
    .map(({ slug }) => ({ slug }));
}

export default async function LabItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getLabItemBySlug(slug);

  if (!item || item.type === "external") {
    notFound();
  }

  redirect(`/lab/${slug}/${defaultLocale}`);
}
