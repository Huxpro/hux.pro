"use client";

import { PageLayout } from "@/components/ui/page-layout";
import type { PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { usePostLanguage } from "./use-post-language";

// Tracks how many PostContent instances are currently mounted.
// Prevents premature class removal during view transitions where the
// incoming and outgoing post-content pages overlap briefly.
let postContentMountCount = 0;

interface PostContentProps {
  title: string;
  titleZh?: string;
  locale: Locale;
  language: PostLanguage;
  children: ReactNode;

  readingTime?: string;
  readingTimeZh?: string;

  backHref: string;
  backLabel: string;

  headerMeta?: ReactNode;

  onMount?: (slug: string, title: string) => void;
}

export function PostContent({
  title,
  titleZh,
  locale,
  language,
  children,
  readingTime,
  readingTimeZh,
  backHref,
  backLabel,
  headerMeta,
  onMount,
}: PostContentProps) {
  const pathname = usePathname();

  const { displayLocale, switchLanguage, hasAlternate, alternateLabel } =
    usePostLanguage({ locale, language });

  useEffect(() => {
    postContentMountCount++;
    document.documentElement.classList.add("post-content");
    return () => {
      postContentMountCount--;
      if (postContentMountCount === 0) {
        document.documentElement.classList.remove("post-content");
      }
    };
  }, []);

  useEffect(() => {
    if (onMount) {
      const segments = pathname.split("/");
      const slug = segments[segments.length - 2] || "";
      onMount(slug, title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayTitle = displayLocale === "zh" && titleZh ? titleZh : title;
  const displayReadingTime =
    displayLocale === "zh" && readingTimeZh ? readingTimeZh : readingTime;
  const hasHeaderMetaContent =
    !!headerMeta || !!displayReadingTime || hasAlternate;
  const headerMetaRow = (
    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
      {headerMeta}

      {displayReadingTime && (
        <>
          {headerMeta && <span className="text-muted-foreground/40">·</span>}
          <span>{displayReadingTime}</span>
        </>
      )}

      {hasAlternate && (
        <>
          {(headerMeta || displayReadingTime) && (
            <span className="text-muted-foreground/40">·</span>
          )}
          <button
            onClick={switchLanguage}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          >
            <Languages className="h-3 w-3" />
            <span>{alternateLabel}</span>
          </button>
        </>
      )}
    </div>
  );

  return (
    <PageLayout
      title={displayTitle}
      backHref={backHref}
      backLabel={backLabel}
      variant="reader"
      headerActions={hasHeaderMetaContent ? headerMetaRow : undefined}
      className="min-h-screen"
    >
      <div className="prose-article" lang={displayLocale}>
        {children}
      </div>
    </PageLayout>
  );
}
