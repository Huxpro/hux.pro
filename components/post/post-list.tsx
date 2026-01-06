"use client";

import { useLocale } from "@/components/providers";
import { SystemNav } from "@/components/ui/system-nav";
import {
  getAlternateLangLabel,
  getLocalizedDescription,
  getLocalizedReadingTime,
  getLocalizedTitle,
  shouldShowPost,
  type Post,
} from "@/lib/content";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState, type ReactNode } from "react";

interface PostListProps<T extends Post> {
  posts: T[];

  // Page configuration
  title: string; // Translation key for the page title
  backHref: string;
  backLabel: string;
  basePath: string; // e.g., "/prose" or "/docs"

  // Optional: render custom meta for each post (e.g., date)
  renderMeta?: (post: T) => ReactNode;
}

export function PostList<T extends Post>({
  posts,
  title,
  backHref,
  backLabel,
  basePath,
  renderMeta,
}: PostListProps<T>) {
  const { locale } = useLocale();
  const [includeOther, setIncludeOther] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const filteredPosts = posts.filter((post) =>
    shouldShowPost(post, locale, includeOther)
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[680px] px-6 pt-24 pb-32">
        {/* Back link - System UI */}
        <SystemNav href={backHref} path={backLabel} className="mb-16" />

        {/* Header */}
        <header className="mb-20 text-center">
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
            {t(locale, title as Parameters<typeof t>[1])}
          </h1>
        </header>

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
            const isHovered = hoveredSlug === post.slug;
            const showLangTag =
              includeOther &&
              post.language !== "both" &&
              post.language !== locale;

            return (
              <article
                key={post.slug}
                className="group relative"
                onMouseEnter={() => setHoveredSlug(post.slug)}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <Link
                  href={`${basePath}/${post.slug}`}
                  className={cn(
                    "flex items-baseline justify-between gap-4 py-4 -mx-4 px-4 rounded-lg transition-all duration-200",
                    isHovered && "bg-muted/50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-3">
                      <h2
                        className={cn(
                          "text-base font-normal transition-colors duration-200",
                          isHovered ? "text-foreground" : "text-foreground"
                        )}
                      >
                        {getLocalizedTitle(post, locale)}
                      </h2>
                      {showLangTag && (
                        <span className="px-1.5 py-0.5 text-xs font-mono bg-muted text-muted-foreground rounded shrink-0">
                          {post.language === "en" ? "EN" : "中文"}
                        </span>
                      )}
                    </div>

                    {/* Hover content: description and also-in */}
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-out",
                        isHovered
                          ? "max-h-24 opacity-100 mt-2"
                          : "max-h-0 opacity-0 mt-0"
                      )}
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {getLocalizedDescription(post, locale)}
                      </p>
                      {altLang && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t(locale, "alsoIn")}{" "}
                          <span className="text-foreground/80">
                            {altLang.label}
                          </span>
                        </p>
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
              </article>
            );
          })}
        </section>

        {filteredPosts.length === 0 && (
          <p className="text-muted-foreground text-center py-12">
            {t(locale, "noResults")}
          </p>
        )}
      </main>
    </div>
  );
}
