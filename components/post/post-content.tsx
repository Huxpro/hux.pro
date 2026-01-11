"use client";

import { useLocale, type Locale } from "@/services";
import { SystemNav } from "@/components/ui/system-nav";
import type { PostLanguage } from "@/lib/content";
import { Languages } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { LanguageConflictDialog } from "./language-conflict-dialog";

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
  const { locale: systemLocale, setLocale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlLang = searchParams.get("lang") as Locale | null;
  const isBilingual = language === "both";

  // Track if we should show the conflict dialog
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [hasHandledConflict, setHasHandledConflict] = useState(false);

  // Determine the effective locale for display
  const [effectiveLocale, setEffectiveLocale] = useState<Locale>(systemLocale);

  // Call onMount callback once
  useEffect(() => {
    if (onMount) {
      const slug = pathname.split("/").pop() || "";
      onMount(slug, title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only check for conflicts on bilingual posts with URL lang param that differs from system
    if (
      isBilingual &&
      urlLang &&
      urlLang !== systemLocale &&
      !hasHandledConflict
    ) {
      setShowConflictDialog(true);
      // Temporarily show the shared language version while dialog is open
      setEffectiveLocale(urlLang);
    } else if (urlLang && urlLang === systemLocale) {
      // URL lang matches system locale, no conflict - just use it
      setEffectiveLocale(urlLang);
      setShowConflictDialog(false);
    } else if (!urlLang) {
      // No URL param, use system locale
      setEffectiveLocale(systemLocale);
      setShowConflictDialog(false);
    }
  }, [isBilingual, urlLang, systemLocale, hasHandledConflict]);

  // Handle user's choice in the conflict dialog
  const handleConflictChoice = (chosenLang: Locale) => {
    setShowConflictDialog(false);
    setHasHandledConflict(true);
    setEffectiveLocale(chosenLang);

    // Update URL to reflect the choice
    if (chosenLang === systemLocale) {
      // User chose their system preference, remove the lang param
      router.replace(pathname);
    } else {
      // User chose the shared language, update system locale
      setLocale(chosenLang);
      router.replace(`${pathname}?lang=${chosenLang}`);
    }
  };

  // For single-language posts, always use that language
  const displayLocale =
    language === "both" ? effectiveLocale : language === "zh" ? "zh" : "en";

  // Determine which title to show
  const displayTitle = displayLocale === "zh" && titleZh ? titleZh : title;

  // Determine which content to show
  const displayContent =
    displayLocale === "zh" && children.zh
      ? children.zh
      : children.en || children.zh;

  // Determine which reading time to show
  const displayReadingTime =
    displayLocale === "zh" && readingTimeZh ? readingTimeZh : readingTime;

  // Check if alternate language is available
  const hasAlternate = isBilingual;
  const alternateLocale = displayLocale === "en" ? "zh" : "en";
  const alternateLabel = displayLocale === "en" ? "中文版" : "English";

  // Switch to alternate language via URL
  const switchLanguage = () => {
    router.push(`${pathname}?lang=${alternateLocale}`);
    setEffectiveLocale(alternateLocale);
    setHasHandledConflict(true);
  };

  return (
    <div className="min-h-screen">
      {/* Language conflict dialog */}
      {showConflictDialog && urlLang && (
        <LanguageConflictDialog
          sharedLang={urlLang}
          systemLang={systemLocale}
          onChoose={handleConflictChoice}
        />
      )}

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

// Wrapper with Suspense for useSearchParams
export function PostContent(props: PostContentProps) {
  return (
    <Suspense fallback={<PostContentSkeleton />}>
      <PostContentInner {...props} />
    </Suspense>
  );
}
