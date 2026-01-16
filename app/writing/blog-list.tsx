"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { PostList } from "@/components/post";
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
  return (
    <PageLayout page="writing">
      <PostList
        posts={posts}
        basePath="/writing"
        renderMeta={(post) => <time>{formatDate(post.date)}</time>}
      />
    </PageLayout>
  );
}
