"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { PostList } from "@/components/post";
import { t, useLocale } from "@/services";
import type { BlogPost } from "@/lib/content";

interface BlogPostListProps {
  posts: BlogPost[];
}

// Format date like "oct 2024"
function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toLowerCase();
}

export function BlogPostList({ posts }: BlogPostListProps) {
  const { locale } = useLocale();

  return (
    <PageLayout title={t(locale, "blogTitle")}>
      <PostList
        posts={posts}
        basePath="/prose"
        renderMeta={(post) => <time>{formatDate(post.date)}</time>}
      />
    </PageLayout>
  );
}
