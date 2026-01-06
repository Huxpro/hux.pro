import { MDXRenderer } from "@/components/mdx-renderer";
import { getBlogPostBySlug, getBlogSlugs } from "@/lib/mdx";
import { notFound } from "next/navigation";
import { BlogPostContent } from "./content";

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

  return (
    <BlogPostContent
      title={post.title}
      titleZh={post.titleZh}
      date={post.date}
      language={post.language}
      readingTime={post.readingTime}
      readingTimeZh={post.readingTimeZh}
    >
      {{
        en: post.content ? <MDXRenderer source={post.content} /> : null,
        zh: post.contentZh ? <MDXRenderer source={post.contentZh} /> : null,
      }}
    </BlogPostContent>
  );
}
