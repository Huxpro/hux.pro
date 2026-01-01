"use client";

import { useLocale } from "@/components/providers";
import {
  getAlternateLangLabel,
  getLocalizedDescription,
  getLocalizedTitle,
  shouldShowPost,
  type BlogPost,
} from "@/lib/content";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface BlogPostListProps {
  posts: BlogPost[];
}

export function BlogPostList({ posts }: BlogPostListProps) {
  const { locale } = useLocale();
  const [includeOther, setIncludeOther] = useState(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const filteredPosts = posts.filter((post) =>
    shouldShowPost(post, locale, includeOther)
  );

  // Format date like "oct 2024"
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date
      .toLocaleDateString("en-US", { month: "short", year: "numeric" })
      .toLowerCase();
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[680px] px-6 pt-24 pb-32">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-16"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(locale, "home")}
        </Link>

        {/* Header */}
        <header className="mb-20 text-center">
          <h1 className="text-3xl font-light tracking-tight text-foreground">
            {t(locale, "blogTitle")}
          </h1>
          <p className="mt-3 font-serif italic text-muted-foreground">
            {t(locale, "blogSubtitle")}
          </p>
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
                  href={`/blog/${post.slug}`}
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

                    {/* Hover content: excerpt and also-in */}
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

                  {/* Date */}
                  <time className="font-mono text-sm text-muted-foreground shrink-0">
                    {formatDate(post.date)}
                  </time>
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
