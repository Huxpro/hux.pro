"use client";

import { useLocale } from "@/components/providers";
import { localeNames, t, type Locale } from "@/lib/i18n";
import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

interface BlogPostContentProps {
  title: string;
  titleZh?: string;
  date: string;
  language: "en" | "zh" | "both";
  readingTime?: string;
  readingTimeZh?: string;
  children: {
    en: ReactNode | null;
    zh: ReactNode | null;
  };
}

// Language conflict dialog component - System UI aesthetic
function LanguageConflictDialog({
  sharedLang,
  systemLang,
  onChoose,
}: {
  sharedLang: Locale;
  systemLang: Locale;
  onChoose: (lang: Locale) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={() => onChoose(systemLang)}
      />

      {/* Dialog */}
      <div className="relative w-full sm:w-auto sm:min-w-[320px] sm:max-w-sm bg-background/95 backdrop-blur-xl border-t sm:border border-border/50 sm:rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 fade-in duration-200">
        {/* Compact header with language indicator */}
        <div className="px-5 pt-5 pb-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-mono text-muted-foreground mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
            {systemLang === "en" ? "Language mismatch" : "语言不匹配"}
          </div>
          <p className="text-sm text-muted-foreground">
            {systemLang === "en" ? (
              <>
                Shared in{" "}
                <span className="font-medium text-foreground">
                  {localeNames[sharedLang]}
                </span>
                , you prefer{" "}
                <span className="font-medium text-foreground">
                  {localeNames[systemLang]}
                </span>
              </>
            ) : (
              <>
                分享语言{" "}
                <span className="font-medium text-foreground">
                  {localeNames[sharedLang]}
                </span>
                ，您偏好{" "}
                <span className="font-medium text-foreground">
                  {localeNames[systemLang]}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Action buttons - stacked on mobile for thumb reach */}
        <div className="px-3 pb-3 space-y-1.5">
          <button
            onClick={() => onChoose(sharedLang)}
            className="w-full px-4 py-3 bg-foreground text-background rounded-lg font-medium text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {sharedLang === "en" ? "Read in English" : "阅读中文版"}
          </button>
          <button
            onClick={() => onChoose(systemLang)}
            className="w-full px-4 py-3 text-muted-foreground rounded-lg font-medium text-sm transition-all hover:bg-muted/50 active:scale-[0.98]"
          >
            {systemLang === "en" ? "Keep English" : "保持中文"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Inner component that uses useSearchParams
function BlogPostContentInner({
  title,
  titleZh,
  date,
  language,
  readingTime,
  readingTimeZh,
  children,
}: BlogPostContentProps) {
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
  // For bilingual posts with URL lang param, show conflict dialog if different from system
  const [effectiveLocale, setEffectiveLocale] = useState<Locale>(systemLocale);

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

  // Format date like "oct 2024"
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d
      .toLocaleDateString("en-US", { month: "short", year: "numeric" })
      .toLowerCase();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Language conflict dialog */}
      {showConflictDialog && urlLang && (
        <LanguageConflictDialog
          sharedLang={urlLang}
          systemLang={systemLocale}
          onChoose={handleConflictChoice}
        />
      )}

      <article className="mx-auto max-w-[680px] px-6 pt-16 pb-32">
        {/* Back link - quiet, almost invisible */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-12"
        >
          <span>←</span>
          <span>{t(displayLocale, "backToWriting")}</span>
        </Link>

        {/* Header */}
        <header className="mb-12">
          <h1 className="font-serif text-4xl font-normal text-foreground leading-tight tracking-tight mb-4">
            {displayTitle}
          </h1>
          <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <time>{formatDate(date)}</time>
            {displayReadingTime && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{displayReadingTime}</span>
              </>
            )}
            {hasAlternate && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <button
                  onClick={switchLanguage}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-md transition-colors bg-muted text-foreground cursor-pointer"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span>{alternateLabel}</span>
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

// Wrapper with Suspense for useSearchParams
export function BlogPostContent(props: BlogPostContentProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
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
      }
    >
      <BlogPostContentInner {...props} />
    </Suspense>
  );
}
