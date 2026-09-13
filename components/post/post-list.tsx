"use client";

import {
  getLocalizedDescription,
  getLocalizedReadingTime,
  getLocalizedTitle,
  getPostHref,
  getVisibleTags,
  isDecoratorTag,
  shouldShowPost,
  type CoverFit,
  type Post,
  type PostLanguage,
} from "@/lib/content";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { MagneticPreview, PEEK_W } from "@/components/motion-primitives/magnetic-preview";
import { PeekCover } from "@/components/log/media/peek-cover";
import { useOptionalDevtool } from "@/systems/devtool/provider";
import { Link } from "next-view-transitions";
import { useEffect, type ReactNode } from "react";

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

  // Devtool hook: when the panel is enabled, hovering a row publishes that
  // post's frontmatter to the shared inspector (same channel the article page
  // uses). No-op — and zero cost — for normal visitors; the data is already in
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
          const description = getLocalizedDescription(post, locale);
          const showLangTag =
            includeOther &&
            post.language !== "both" &&
            post.language !== locale;

          // Pull post-specific extras off as a plain shape — keeps PostPreview
          // independent of the Post union (BlogPost has tags/origin/excerpt/
          // cover, Doc/Note don't; PostPreview simply omits sections that
          // aren't supplied).
          const postExtras = post as Post & {
            tags?: string[];
            origin?: string;
            originZh?: string;
            excerpt?: string;
            excerptZh?: string;
            cover?: string;
            coverZh?: string;
            coverFit?: CoverFit;
            coverAspect?: string;
            // Present on blog posts (kept in the list payload); undefined for
            // Doc / Note. Powers the devtool hover inspector.
            frontmatter?: Record<string, unknown>;
            frontmatterZh?: Record<string, unknown>;
            featured?: boolean;
          };
          // Locale-aware pick with cross-language fallback: prefer the
          // viewer's locale, fall back to the other when missing. Otherwise a
          // single-language post (e.g. js-20yrs-preface is zh-only) renders
          // no peek for viewers in the other locale even though its row is
          // visible — `excerpt` would be undefined on the en side, `excerptZh`
          // would never be consulted.
          const pick = <T,>(zh: T | undefined, en: T | undefined) =>
            locale === "zh" ? zh ?? en : en ?? zh;
          const peekOrigin = pick(postExtras.originZh, postExtras.origin);
          const peekExcerpt = pick(postExtras.excerptZh, postExtras.excerpt);
          const peekCover = pick(postExtras.coverZh, postExtras.cover);
          // Drop decorator tags (译 / 知乎) that aren't visible in this locale —
          // their visibility is declared centrally in `tagLocaleVisibility`.
          const peekTags = postExtras.tags
            ? getVisibleTags(postExtras.tags, locale)
            : undefined;
          // Decorator tags (译 / 知乎) double as a visible row annotation —
          // the calm replacement for the old hardcoded 「译」 title prefix.
          // peekTags is already locale-filtered, so only decorators visible in
          // this locale surface here.
          const rowDecorators = peekTags?.filter(isDecoratorTag) ?? [];
          // `featured` renders in the same badge as the provenance decorators:
          // like 译 / 知乎 it is a fact about the piece (editorial, not
          // viewer-relative), whereas the EN / 中文 tag below is a transient
          // filter-state hint and deliberately stays plain and quiet.
          const rowBadges = postExtras.featured
            ? [...rowDecorators, t(locale, "writingFeatured")]
            : rowDecorators;

          const preview = (
            <PostPreview
              description={description}
              meta={{
                language: post.language,
                readingTime: getLocalizedReadingTime(post, locale),
                tags: peekTags,
                origin: peekOrigin,
                excerpt: peekExcerpt,
                cover: peekCover,
                coverFit: postExtras.coverFit,
                coverAspect: postExtras.coverAspect,
              }}
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
                  {rowBadges.map((tag) => (
                    // The leading NBSP + nowrap wrapper glue the badge to the
                    // title's last word, so it wraps together with the title
                    // instead of dropping onto a line by itself (the badge is
                    // an inline-block, which otherwise has a break point before
                    // it). The NBSP also supplies the gap — no left margin.
                    <span key={tag} className="whitespace-nowrap">
                      {" "}
                      <span className="ml-0.5 inline-block rounded bg-foreground/5 px-1.5 py-0.5 align-[0.1em] text-[10px] font-mono text-muted-foreground">
                        {tag}
                      </span>
                    </span>
                  ))}
                  {showLangTag && (
                    <span className="ml-2 text-xs font-mono text-muted-foreground/40 align-baseline">
                      {post.language === "en" ? "EN" : "中文"}
                    </span>
                  )}
                </h2>
              </div>

              {/* Same tier as a commit row's date on /works (muted/50) so the
                  writing list and the log read as one metadata register. */}
              <span className="font-mono text-xs text-muted-foreground/50 shrink-0">
                {renderMeta
                  ? renderMeta(post)
                  : getLocalizedReadingTime(post, locale)}
              </span>
            </Link>
          );

          // Peek surfaces whenever any of the post's "inner page" bits exist:
          // curated description, body excerpt, or a cover image. Posts that
          // are pure title + date (no rich content) skip the peek silently.
          const peekEnabled =
            !!description || !!peekExcerpt || !!peekCover;

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
                preview={preview}
                enabled={peekEnabled}
                // p-0 strips the default panel padding so the cover sits flush
                // against the rounded panel edge; PostPreview owns its own
                // internal padding around the text content. The panel IS the
                // visible card here, so it opts into shadow-raised.
                panelClassName="p-0 overflow-hidden max-w-md shadow-raised"
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

// =============================================================================
// Preview Content (for MagneticPreview)
// =============================================================================

/** Post-side metadata surfaced in the peek. Tags / origin / excerpt / cover
 *  are blog-only (Doc / Note simply leave them unset). */
interface PostPreviewMeta {
  language: PostLanguage;
  readingTime: string;
  tags?: string[];
  origin?: string;
  excerpt?: string;
  cover?: string;
  /** Peek-cover fill mode (frontmatter `coverFit`). Default: fixed cover. */
  coverFit?: CoverFit;
  /** Fixed-mode aspect override (frontmatter `coverAspect`). */
  coverAspect?: string;
}

const LANGUAGE_LABEL: Record<PostLanguage, string> = {
  en: "English",
  zh: "中文",
  both: "Bilingual",
};

/**
 * Strip markdown link syntax `[text](url)` to plain `text`. Origin strings are
 * authored as markdown (so the post body can render them with live links) but
 * the peek is a non-interactive surface — flattening keeps the provenance
 * legible without exposing dead anchor text.
 */
function flattenMarkdownLinks(md: string): string {
  return md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}

/**
 * Peek preview — the disclosure layer for a post row.
 *
 * Designed as a card-shaped surface roughly half the width of the prose page:
 * cover image flush at top (when present), then a content well with the
 * post's hidden artifacts laid out as an editorial composition. Sections in
 * order:
 *   1. cover image  — visual vibe, the first image the article opens with
 *   2. top meta     — caption (LANG · READING TIME) + provenance (italic),
 *                     stacked. The caption itself signals BILINGUAL when the
 *                     post has both languages, so no separate alt-lang line.
 *   3. description  — curated frontmatter summary, serif italic (editorial dek)
 *   4. excerpt      — opening paragraphs of the body (sans, prose recipe)
 *   5. hairline rule
 *   6. tags         — plain text, middle-dot separated
 *
 * Title and date are deliberately omitted (both already on the hovered row).
 * No chips, no icons, no colored accents — keeps the surface inside the
 * project's content UI calm even though the panel chrome itself is system
 * Liquid Glass.
 */
function PostPreview({
  description,
  meta,
}: {
  description: string | undefined;
  meta: PostPreviewMeta;
}) {
  const origin = meta.origin ? flattenMarkdownLinks(meta.origin) : undefined;
  const hasTags = !!(meta.tags && meta.tags.length);

  return (
    <div className={cn(PEEK_W, "max-w-full")}>
      {meta.cover && (
        // Shared cover slot — `fit`/`aspect` come from the post's frontmatter
        // (`coverFit` / `coverAspect`). Default is a fixed cropped rectangle;
        // `coverFit: natural` shows the whole cover at its own aspect (e.g. a
        // tall portrait screenshot) instead of slicing it into a band.
        <PeekCover
          src={meta.cover}
          fit={meta.coverFit}
          aspect={meta.coverAspect}
        />
      )}

      <div className="p-4 space-y-3">
        {/* Caption strip — matches the article inner page's meta line
            (`date · min read · origin` mono uppercase, middle-dot separated).
            Origin appends with the same separator instead of starting a new
            italic line, so the peek's header reads as the page's header. */}
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 leading-relaxed">
          <span>{LANGUAGE_LABEL[meta.language]}</span>
          <span className="mx-1.5 text-muted-foreground/30">·</span>
          <span>{meta.readingTime}</span>
          {origin && (
            <>
              <span className="mx-1.5 text-muted-foreground/30">·</span>
              <span>{origin}</span>
            </>
          )}
        </div>

        {/* Description acts as a subtitle / dek — serif italic for the
            editorial vibe, distinct register from the sans excerpt below. */}
        {description && (
          <p className="font-serif italic text-sm text-foreground/80 leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Excerpt mirrors the actual article body (sans, the `.prose-article`
            recipe) — reads as a snippet from the real reading experience. */}
        {meta.excerpt && (
          <p className="text-sm text-foreground/75 leading-relaxed line-clamp-5">
            {meta.excerpt}
          </p>
        )}

        {hasTags && (
          // Same recipe as the top caption (mono uppercase tracking-wider)
          // so the card frames its content with a matched pair of meta
          // strips — top: language/reading; bottom: tags.
          <div className="pt-3 border-t border-border/30 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 leading-relaxed">
            {meta.tags!.join("  ·  ")}
          </div>
        )}
      </div>
    </div>
  );
}
