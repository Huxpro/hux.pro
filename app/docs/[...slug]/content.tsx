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
  /** The colophon: provenance and the page's skill (page.tsx `colophon`). */
  origin?: string;
  originZh?: string;
  children: ReactNode;
}

export function DocContent({
  title,
  titleZh,
  locale,
  language,
  readingTime,
  readingTimeZh,
  origin,
  originZh,
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
      origin={origin}
      originZh={originZh}
      backHref="/docs"
      backLabel="/docs"
    >
      {children}
    </PostContent>
  );
}
