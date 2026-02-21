import { getBlogPostBySlug, getBlogSlugs } from "@/lib/mdx";
import { defaultLocale } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  const slugs = getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Redirect bare /writing/slug to /writing/slug/{locale}
  // Middleware handles cookie-based locale preference;
  // this is the fallback for direct static access
  redirect(`/writing/${slug}/${defaultLocale}`);
}
