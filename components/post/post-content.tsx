"use client";

import { SystemNav } from "@/components/ui/system-nav";
import type { PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { usePostLanguage } from "./use-post-language";

interface PostContentProps {
  // Content
  title: string;
  titleZh?: string;
  locale: Locale;
  language: PostLanguage;
  children: ReactNode;

  // Optional metadata
  readingTime?: string;
  readingTimeZh?: string;

  // Navigation
  backHref: string;
  backLabel: string;

  // Optional header content (e.g., date for blog posts)
  headerMeta?: ReactNode;

  // Optional callback when content is mounted (e.g., for visit tracking)
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

  // Call onMount callback once
  useEffect(() => {
    if (onMount) {
      // Extract slug: second-to-last segment (last is locale)
      const segments = pathname.split("/");
      const slug = segments[segments.length - 2] || "";
      onMount(slug, title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive localized metadata
  const displayTitle = displayLocale === "zh" && titleZh ? titleZh : title;
  const displayReadingTime =
    displayLocale === "zh" && readingTimeZh ? readingTimeZh : readingTime;

  return (
    <div className="min-h-screen">
      <article className="mx-auto max-w-[680px] px-6 pt-6 sm:pt-24 pb-32">
        {/* Back link - System UI */}
        <SystemNav href={backHref} path={backLabel} className="mb-12" />

        {/* Header */}
        <header className="mb-12">
          <h1 className="font-sans text-xl sm:text-2xl font-medium text-foreground leading-tight mb-4">
            {displayTitle}
          </h1>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {/* Optional header meta (e.g., date) */}
            {headerMeta}

            {/* Reading time */}
            {displayReadingTime && (
              <>
                {headerMeta && (
                  <span className="text-muted-foreground/40">·</span>
                )}
                <span>{displayReadingTime}</span>
              </>
            )}

            {/* Language switcher */}
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
        </header>

        {/* Server-rendered MDX Content */}
        <div className="prose-article" lang={displayLocale}>
          {children}
        </div>
      </article>
    </div>
  );
}
