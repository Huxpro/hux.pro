"use client";

import { PostContent } from "@/components/post";
import { useVisitor } from "@/services";
import type { PostLanguage } from "@/lib/content";
import { useRef, type ReactNode } from "react";

interface BlogPostContentProps {
  title: string;
  titleZh?: string;
  date: string;
  language: PostLanguage;
  readingTime?: string;
  readingTimeZh?: string;
  children: {
    en: ReactNode | null;
    zh: ReactNode | null;
  };
}

// Format date like "oct 2024"
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
  language,
  readingTime,
  readingTimeZh,
  children,
}: BlogPostContentProps) {
  const { recordVisit } = useVisitor();
  const hasRecordedVisit = useRef(false);

  // Handle visit recording
  const handleMount = (slug: string, postTitle: string) => {
    if (!hasRecordedVisit.current) {
      hasRecordedVisit.current = true;
      recordVisit({
        slug,
        title: postTitle,
        type: "blog",
      });
    }
  };

  return (
    <PostContent
      title={title}
      titleZh={titleZh}
      language={language}
      readingTime={readingTime}
      readingTimeZh={readingTimeZh}
      backHref="/prose"
      backLabel="/prose"
      headerMeta={<time>{formatDate(date)}</time>}
      onMount={handleMount}
    >
      {children}
    </PostContent>
  );
}
