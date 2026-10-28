"use client";

import {
  getLocalizedReadingTime,
  getLocalizedTitle,
  getPostHref,
  isDecoratorTag,
  postPeekHasContent,
  postPeekOf,
  shouldShowPost,
  type Post,
  type PostPeekSource,
} from "@/lib/content";
import { HeaderAction } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { POST_PEEK_PANEL, PostPeekView } from "./post-peek";
import { useOptionalDevtool } from "@/systems/devtool/provider";
import { Link } from "next-view-transitions";
import { useEffect, type ReactNode } from "react";

import { TYPE } from "@/lib/typography";
interface LanguageFilterProps {
  includeOther: boolean;
  setIncludeOther: (value: boolean) => void;
}

export function LanguageFilter({
  includeOther,
  setIncludeOther,
}: LanguageFilterProps) {
  const { locale } = useLocale();

  // The chip spec moved to HeaderAction so the article header can be the same
  // control rather than a fourth copy of it.
  return (
    <span className="inline-flex items-center gap-0.5 font-mono text-xs select-none">
      <HeaderAction active={!includeOther} onClick={() => setIncludeOther(false)}>
        {locale === "en" ? "EN" : "中文"}
      </HeaderAction>
      <HeaderAction active={includeOther} onClick={() => setIncludeOther(true)}>
        {t(locale, "allLanguages")}
      </HeaderAction>
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

  // Devtool hook: when the panel is enabled, hovering a row publishes that
  // post's frontmatter to the shared inspector (same channel the article page
  // uses). No-op, at zero cost, for normal visitors; the data is already in
  // the list payload, so this adds no network. `useOptionalDevtool` keeps the
  // component usable outside the provider (never throws).
  const devtool = useOptionalDevtool();
  const devtoolEnabled = devtool?.isEnabled ?? false;
  const setPageMeta = devtool?.setPageMeta;
  // Clear the inspector when leaving the list so it doesn't show a stale row.
  useEffect(() => {
    if (!setPageMeta) return;
    return () => setPageMeta(null);
  }, [setPageMeta]);

  const filteredPosts = posts.filter((post) =>
    shouldShowPost(post, locale, includeOther)
  );

  return (
    <>
      <section className="space-y-0">
        {filteredPosts.map((post) => {
          const showLangTag =
            includeOther &&
            post.language !== "both" &&
            post.language !== locale;

          // The row's peek (components/post/post-peek.tsx): the post's
          // "inner page" bits, for this locale, falling back to the other.
          const peek = postPeekOf(post as PostPeekSource, locale);
          // Decorator tags (译 / 知乎) double as a visible row annotation.
          // They replace the old hardcoded 「译」 title prefix.
          // The peek's tags are already locale-filtered, so only decorators
          // visible in this locale surface here.
          //
          // `featured` is deliberately not among them. Curation does its work
          // on the home card, where it decides which posts are shown; in the
          // archive every post is already present, in date order, and a badge
          // on three of them is a second hierarchy over the one the list has.
          const rowDecorators = peek.tags?.filter(isDecoratorTag) ?? [];
          // Present on blog posts (kept in the list payload); undefined for
          // Doc / Note. Powers the devtool hover inspector.
          const postExtras = post as Post & {
            frontmatter?: Record<string, unknown>;
            frontmatterZh?: Record<string, unknown>;
          };

          const postRow = (
            <Link
              href={getPostHref(post, locale, basePath)}
              className="pressable flex items-baseline justify-between gap-4 py-3 sm:py-4 -mx-4 px-4 rounded-lg transition-colors duration-200 hover:bg-muted/50 active:bg-muted/60"
            >
              <div className="flex-1 min-w-0">
                <h2 className={cn(TYPE.rowTitle, "sm:text-base font-normal")}>
                  {getLocalizedTitle(post, locale)}
                  {rowDecorators.map((tag) => (
                    // Provenance (译 / 知乎) is a word after the title in the
                    // row's metadata ink, not a box: the same register as the
                    // EN / 中文 hint beside it and the date across from it, so
                    // the row has one voice for everything that is not the
                    // title. The leading NBSP + nowrap glue it to the title's
                    // last word so it never wraps onto a line by itself.
                    <span key={tag} className="whitespace-nowrap">
                      {" "}
                      <span className={cn("ml-1", TYPE.rowMeta)}>{tag}</span>
                    </span>
                  ))}
                  {showLangTag && (
                    <span className={cn("ml-2 align-baseline", TYPE.rowMeta)}>
                      {post.language === "en" ? "EN" : "中文"}
                    </span>
                  )}
                </h2>
              </div>

              {/* Same tier as a commit row's date on /works (muted/50) so the
                  writing list and the log read as one metadata register. */}
              <span className={cn("shrink-0", TYPE.rowMeta)}>
                {renderMeta
                  ? renderMeta(post)
                  : getLocalizedReadingTime(post, locale)}
              </span>
            </Link>
          );

          // Peek surfaces whenever any of the post's "inner page" bits exist:
          // curated description, body excerpt, or a cover image. Posts that
          // are pure title + date (no rich content) skip the peek silently.
          const peekEnabled = postPeekHasContent(peek);

          // Devtool inspector: on hover, publish this row's frontmatter for the
          // locale it would open in. Only wired when the devtool is enabled and
          // the post actually carries frontmatter (blog posts do; docs don't).
          const rowLang = post.language === "both" ? locale : post.language;
          const rowFrontmatter =
            rowLang === "zh"
              ? postExtras.frontmatterZh ?? postExtras.frontmatter
              : postExtras.frontmatter;
          const publishFrontmatter =
            devtoolEnabled && rowFrontmatter && setPageMeta
              ? () =>
                  setPageMeta({
                    slug: post.slug,
                    lang: rowLang,
                    language: post.language,
                    frontmatter: rowFrontmatter,
                  })
              : undefined;

          return (
            <article
              key={post.slug}
              className="group relative"
              onMouseEnter={publishFrontmatter}
              onFocus={publishFrontmatter}
            >
              <MagneticPreview
                preview={<PostPeekView peek={peek} />}
                enabled={peekEnabled}
                panelClassName={POST_PEEK_PANEL}
              >
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
