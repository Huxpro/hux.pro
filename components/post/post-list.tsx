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
import { MagneticContent } from "@/components/motion-primitives/magnetic-content";
import { Link } from "next-view-transitions";
import { useState, type ReactNode } from "react";

interface PostListProps<T extends Post> {
  posts: T[];
  basePath: string; // e.g., "/writing" or "/docs"

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
  renderMeta,
}: PostListProps<T>) {
  const { locale } = useLocale();
  const [includeOther, setIncludeOther] = useState(false);

  const filteredPosts = posts.filter((post) =>
    shouldShowPost(post, locale, includeOther)
  );

  return (
    <>
      {/* Language filter pills */}
      <div className="mb-8 flex items-center gap-1">
        <button
          onClick={() => setIncludeOther(false)}
          className={cn(
            "px-2.5 py-1 text-xs font-mono rounded-md transition-colors",
            !includeOther
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {locale === "en" ? "EN" : "中文"}
        </button>
        <button
          onClick={() => setIncludeOther(true)}
          className={cn(
            "px-2.5 py-1 text-xs font-mono rounded-md transition-colors",
            includeOther
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {t(locale, "allLanguages")}
        </button>
      </div>

      {/* Post list */}
      <section className="space-y-0">
        {filteredPosts.map((post) => {
          const altLang = getAlternateLangLabel(post, locale);
          const description = getLocalizedDescription(post, locale);
          const showLangTag =
            includeOther &&
            post.language !== "both" &&
            post.language !== locale;

          const cursorContent = (
            <div className="space-y-1.5 max-w-[14rem]">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {description}
              </p>
              {altLang && (
                <p className="text-[10px] text-muted-foreground/70">
                  {t(locale, "alsoIn")}{" "}
                  <span className="text-foreground/80">{altLang.label}</span>
                </p>
              )}
            </div>
          );

          return (
            <article key={post.slug} className="group relative">
              <MagneticContent
                content={cursorContent}
                enabled={!!description}
                className="block"
              >
                <Link
                  href={getPostHref(post, locale, basePath)}
                  className="flex items-baseline justify-between gap-4 py-4 -mx-4 px-4 rounded-lg transition-all duration-200 hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-normal text-foreground">
                        {getLocalizedTitle(post, locale)}
                      </h2>
                      {showLangTag && (
                        <span className="px-1.5 py-0.5 text-xs font-mono bg-muted text-muted-foreground rounded shrink-0">
                          {post.language === "en" ? "EN" : "中文"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meta (date or reading time) */}
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    {renderMeta
                      ? renderMeta(post)
                      : getLocalizedReadingTime(post, locale)}
                  </span>
                </Link>
              </MagneticContent>
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
