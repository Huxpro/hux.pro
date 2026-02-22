"use client";

import {
  getAlternateLangLabel,
  getLocalizedDescription,
  getLocalizedReadingTime,
  getLocalizedTitle,
  getPostHref,
  shouldShowPost,
  type Post,
} from "@/lib/content";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import type { Locale } from "@/lib/i18n";
import { Link } from "next-view-transitions";
import { type ReactNode } from "react";

interface LanguageFilterProps {
  includeOther: boolean;
  setIncludeOther: (value: boolean) => void;
}

export function LanguageFilter({
  includeOther,
  setIncludeOther,
}: LanguageFilterProps) {
  const { locale } = useLocale();

  return (
    <span className="inline-flex items-center gap-0.5 font-mono text-xs select-none">
      <button
        onClick={() => setIncludeOther(false)}
        className={cn(
          "px-2 py-1 rounded transition-colors duration-200",
          !includeOther
            ? "bg-foreground/5 text-muted-foreground"
            : "text-muted-foreground/40 hover:text-muted-foreground/60"
        )}
      >
        {locale === "en" ? "EN" : "中文"}
      </button>
      <button
        onClick={() => setIncludeOther(true)}
        className={cn(
          "px-2 py-1 rounded transition-colors duration-200",
          includeOther
            ? "bg-foreground/5 text-muted-foreground"
            : "text-muted-foreground/40 hover:text-muted-foreground/60"
        )}
      >
        {t(locale, "allLanguages")}
      </button>
    </span>
  );
}

interface PostListProps<T extends Post> {
  posts: T[];
  basePath: string; // e.g., "/writing" or "/docs"
  includeOther: boolean;

  // Optional: render custom meta for each post (e.g., date)
  renderMeta?: (post: T) => ReactNode;
}

/**
 * PostList - A pure list component for displaying posts
 *
 * This component handles:
 * - Language filtering (current locale vs all)
 * - Post rendering with magnetic cursor previews
 * - Localized titles/descriptions
 *
 * Layout (PageLayout) should be handled at the app router level.
 */
export function PostList<T extends Post>({
  posts,
  basePath,
  includeOther,
  renderMeta,
}: PostListProps<T>) {
  const { locale } = useLocale();

  const filteredPosts = posts.filter((post) =>
    shouldShowPost(post, locale, includeOther)
  );

  return (
    <>
      <section className="space-y-0">
        {filteredPosts.map((post) => {
          const altLang = getAlternateLangLabel(post, locale);
          const description = getLocalizedDescription(post, locale);
          const showLangTag =
            includeOther &&
            post.language !== "both" &&
            post.language !== locale;

          const preview = (
            <PostPreview
              description={description}
              altLangLabel={altLang?.label}
              locale={locale}
            />
          );

          const postRow = (
            <Link
              href={getPostHref(post, locale, basePath)}
              className="flex items-baseline justify-between gap-4 py-3 sm:py-4 -mx-4 px-4 rounded-lg transition-colors duration-200 hover:bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-sm sm:text-base font-normal">
                  {getLocalizedTitle(post, locale)}
                  {showLangTag && (
                    <span className="ml-2 text-xs font-mono text-muted-foreground/40 align-baseline">
                      {post.language === "en" ? "EN" : "中文"}
                    </span>
                  )}
                </h2>
              </div>

              <span className="font-mono text-xs text-muted-foreground shrink-0">
                {renderMeta
                  ? renderMeta(post)
                  : getLocalizedReadingTime(post, locale)}
              </span>
            </Link>
          );

          return (
            <article key={post.slug} className="group relative">
              <MagneticPreview preview={preview} enabled={!!description}>
                {postRow}
              </MagneticPreview>
            </article>
          );
        })}
      </section>

      {filteredPosts.length === 0 && (
        <p className="text-muted-foreground text-center py-12">
          {t(locale, "noResults")}
        </p>
      )}
    </>
  );
}

// =============================================================================
// Preview Content (for MagneticPreview)
// =============================================================================

function PostPreview({
  description,
  altLangLabel,
  locale,
}: {
  description: string | undefined;
  altLangLabel: string | undefined;
  locale: Locale;
}) {
  return (
    <div className="space-y-1.5 max-w-[14rem]">
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {description}
      </p>
      {altLangLabel && (
        <p className="text-[10px] text-muted-foreground/70">
          {t(locale, "alsoIn")}{" "}
          <span className="text-foreground/80">{altLangLabel}</span>
        </p>
      )}
    </div>
  );
}
