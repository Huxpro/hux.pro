"use client";

import { PostList } from "@/components/post";
import type { Doc } from "@/lib/content";

interface DocsPageListProps {
  docs: Doc[];
}

export function DocsPageList({ docs }: DocsPageListProps) {
  return (
    <PostList
      posts={docs}
      title="docsTitle"
      backHref="/"
      backLabel="λhux"
      basePath="/docs"
      // Docs use reading time (default behavior, no renderMeta needed)
    />
  );
}
