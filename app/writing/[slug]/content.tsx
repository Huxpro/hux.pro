"use client";

import { PostContent } from "@/components/post";
import { useVisitor } from "@/services";
import type { PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { useRef, type ReactNode } from "react";

interface BlogPostContentProps {
  title: string;
  titleZh?: string;
  date: string;
  locale: Locale;
  language: PostLanguage;
  readingTime?: string;
  readingTimeZh?: string;
  origin?: string;
  originZh?: string;
  children: ReactNode;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toLowerCase();
}

export function BlogPostContent({
  title,
  titleZh,
  date,
  locale,
  language,
  readingTime,
  readingTimeZh,
  origin,
  originZh,
  children,
}: BlogPostContentProps) {
  const { recordVisit } = useVisitor();
  const hasRecordedVisit = useRef(false);

  const handleMount = (slug: string, postTitle: string, href: string) => {
    if (!hasRecordedVisit.current) {
      hasRecordedVisit.current = true;
      recordVisit({
        slug,
        title: postTitle,
        type: "blog",
        href,
      });
    }
  };

  return (
    <PostContent
      title={title}
      titleZh={titleZh}
      locale={locale}
      language={language}
      readingTime={readingTime}
      readingTimeZh={readingTimeZh}
      backHref="/writing"
      backLabel="/writing"
      headerMeta={<time>{formatDate(date)}</time>}
      origin={origin}
      originZh={originZh}
      toc
      onMount={handleMount}
    >
      {children}
    </PostContent>
  );
}
