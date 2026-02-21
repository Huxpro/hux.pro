"use client";

import { PostContent } from "@/components/post";
import type { PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import type { ReactNode } from "react";

interface DocContentProps {
  title: string;
  titleZh?: string;
  locale: Locale;
  language: PostLanguage;
  readingTime?: string;
  readingTimeZh?: string;
  children: ReactNode;
}

export function DocContent({
  title,
  titleZh,
  locale,
  language,
  readingTime,
  readingTimeZh,
  children,
}: DocContentProps) {
  return (
    <PostContent
      title={title}
      titleZh={titleZh}
      locale={locale}
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
