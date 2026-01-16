"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { PostList } from "@/components/post";
import { t, useLocale } from "@/services";
import type { Doc } from "@/lib/content";

interface DocsPageListProps {
  docs: Doc[];
}

export function DocsPageList({ docs }: DocsPageListProps) {
  const { locale } = useLocale();

  return (
    <PageLayout title={t(locale, "docsTitle")}>
      <PostList
        posts={docs}
        basePath="/docs"
        // Docs use reading time (default behavior, no renderMeta needed)
      />
    </PageLayout>
  );
}
