"use client";

import { PostContent } from "@/components/post";
import type { PostLanguage } from "@/lib/content";
import type { ReactNode } from "react";

interface DocContentProps {
  title: string;
  titleZh?: string;
  language: PostLanguage;
  readingTime?: string;
  readingTimeZh?: string;
  children: {
    en: ReactNode | null;
    zh: ReactNode | null;
  };
}

export function DocContent({
  title,
  titleZh,
  language,
  readingTime,
  readingTimeZh,
  children,
}: DocContentProps) {
  return (
    <PostContent
      title={title}
      titleZh={titleZh}
      language={language}
      readingTime={readingTime}
      readingTimeZh={readingTimeZh}
      backHref="/docs"
      backLabel="/docs"
    >
      {children}
    </PostContent>
  );
}
