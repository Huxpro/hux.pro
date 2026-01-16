"use client";

import { PostList } from "@/components/post";
import { PageLayout } from "@/components/ui/page-layout";
import type { Doc } from "@/lib/content";
import { t, useLocale } from "@/services";

interface DocsPageListProps {
  docs: Doc[];
}

export function DocsPageList({ docs }: DocsPageListProps) {
  const { locale } = useLocale();

  return (
    <PageLayout
      title={t(locale, "docsTitle")} /* docs page uses static title */
    >
      <PostList
        posts={docs}
        basePath="/docs"
        // Docs use reading time (default behavior, no renderMeta needed)
      />
    </PageLayout>
  );
}
