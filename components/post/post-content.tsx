"use client";

import { SystemNav } from "@/components/ui/system-nav";
import type { PostLanguage } from "@/lib/content";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { usePostLanguage } from "./use-post-language";

interface PostContentProps {
  // Content
  title: string;
  titleZh?: string;
  language: PostLanguage;
  children: {
    en: ReactNode | null;
    zh: ReactNode | null;
  };

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

function PostContentInner({
  title,
  titleZh,
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

  // Use the bilingual language hook
  const { displayLocale, switchLanguage, hasAlternate, alternateLabel } =
    usePostLanguage({ language });

  // Call onMount callback once
  useEffect(() => {
    if (onMount) {
      const slug = pathname.split("/").pop() || "";
      onMount(slug, title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive localized content
  const displayTitle = displayLocale === "zh" && titleZh ? titleZh : title;
  const displayContent =
    displayLocale === "zh" && children.zh
      ? children.zh
      : children.en || children.zh;
  const displayReadingTime =
    displayLocale === "zh" && readingTimeZh ? readingTimeZh : readingTime;

  return (
    <div className="min-h-screen">
      <article className="mx-auto max-w-[680px] px-6 pt-24 pb-32">
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
          {displayContent}
        </div>
      </article>
    </div>
  );
}

// Loading skeleton
function PostContentSkeleton() {
  return (
    <div className="min-h-screen">
      <article className="mx-auto max-w-[680px] px-6 pt-16 pb-32">
        <div className="animate-pulse">
          <div className="h-4 w-24 bg-muted rounded mb-12" />
          <div className="h-10 w-3/4 bg-muted rounded mb-4" />
          <div className="h-4 w-32 bg-muted rounded mb-12" />
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-5/6" />
            <div className="h-4 bg-muted rounded w-4/6" />
          </div>
        </div>
      </article>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams (used by the hook)
export function PostContent(props: PostContentProps) {
  return (
    <Suspense fallback={<PostContentSkeleton />}>
      <PostContentInner {...props} />
    </Suspense>
  );
}
