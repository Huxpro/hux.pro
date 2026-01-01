import { MDXRenderer } from "@/components/mdx-renderer";
import { getDocBySlug, getDocSlugs } from "@/lib/mdx";
import { notFound } from "next/navigation";
import { DocContent } from "./content";

export function generateStaticParams() {
  const slugs = getDocSlugs();
  return slugs.map((slug) => ({ slug: [slug] }));
}

// Enable dynamic rendering in development for hot-reloading new docs
export const dynamicParams = true;

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const docSlug = slug.join("/");
  const doc = getDocBySlug(docSlug);

  if (!doc) {
    notFound();
  }

  // Remove the title from content since we display it separately
  const contentWithoutTitle = doc.content.replace(/^#\s+.+\n/, "");

  return (
    <DocContent title={doc.title} readingTime={doc.readingTime}>
      <MDXRenderer source={contentWithoutTitle} />
    </DocContent>
  );
}
