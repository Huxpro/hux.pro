"use client";

import { LanguageFilter, PostList } from "@/components/post";
import { PageLayout } from "@/components/ui/page-layout";
import type { Doc } from "@/lib/content";
import { t, useLocale } from "@/services";
import { useState } from "react";

interface DocsPageListProps {
  docs: Doc[];
}

export function DocsPageList({ docs }: DocsPageListProps) {
  const { locale } = useLocale();
  const [includeOther, setIncludeOther] = useState(false);

  return (
    <PageLayout
      title={t(locale, "docsTitle")}
      headerActions={
        <LanguageFilter
          includeOther={includeOther}
          setIncludeOther={setIncludeOther}
        />
      }
    >
      <PostList
        posts={docs}
        basePath="/docs"
        includeOther={includeOther}
      />
    </PageLayout>
  );
}
