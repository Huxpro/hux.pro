"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { LanguageFilter, PostList } from "@/components/post";
import type { BlogPost } from "@/lib/content";
import { useState } from "react";

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
  const [includeOther, setIncludeOther] = useState(false);

  return (
    <PageLayout
      page="writing"
      headerActions={
        <LanguageFilter
          includeOther={includeOther}
          setIncludeOther={setIncludeOther}
        />
      }
    >
      <PostList
        posts={posts}
        basePath="/writing"
        includeOther={includeOther}
        renderMeta={(post) => <time>{formatDate(post.date)}</time>}
      />
    </PageLayout>
  );
}
