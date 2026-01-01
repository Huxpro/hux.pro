"use client";

import { useLocale } from "@/components/providers";
import { t } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";

interface BlogPostContentProps {
  title: string;
  titleZh?: string;
  date: string;
  language: "en" | "zh" | "both";
  readingTime?: string;
  children: {
    en: ReactNode;
    zh: ReactNode | null;
  };
}

export function BlogPostContent({
  title,
  titleZh,
  date,
  language,
  readingTime,
  children,
}: BlogPostContentProps) {
  const { locale, setLocale } = useLocale();

  // Determine which title to show
  const displayTitle = locale === "zh" && titleZh ? titleZh : title;

  // Determine which content to show
  const displayContent =
    locale === "zh" && children.zh ? children.zh : children.en;

  // Check if alternate language is available
  const hasAlternate = language === "both";
  const alternateLocale = locale === "en" ? "zh" : "en";
  const alternateLabel = locale === "en" ? "中文" : "English";

  // Switch to alternate language
  const switchLanguage = () => {
    setLocale(alternateLocale);
  };

  // Format date like "oct 2024"
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date
      .toLocaleDateString("en-US", { month: "short", year: "numeric" })
      .toLowerCase();
  };

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-[680px] px-6 pt-16 pb-32">
        {/* Back link - quiet, almost invisible */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-12"
        >
          <span>←</span>
          <span>{t(locale, "backToWriting")}</span>
        </Link>

        {/* Header */}
        <header className="mb-12">
          <h1 className="font-serif text-4xl font-normal text-foreground leading-tight tracking-tight mb-4">
            {displayTitle}
          </h1>
          <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <time>{formatDate(date)}</time>
            {readingTime && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{readingTime}</span>
              </>
            )}
            {hasAlternate && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <button
                  onClick={switchLanguage}
                  className="hover:text-foreground transition-colors"
                >
                  {t(locale, "alsoIn")}{" "}
                  <span className="underline underline-offset-2">
                    {alternateLabel}
                  </span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Server-rendered MDX Content */}
        <div className="prose-article">{displayContent}</div>
      </article>
    </div>
  );
}
