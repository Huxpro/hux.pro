"use client";

import { PeekCover } from "@/components/log/media/peek-cover";
import { PEEK_W } from "@/components/motion-primitives/magnetic-preview";
import type { PostLanguage, PostPeek } from "@/lib/content";
import { langOf } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";

// =============================================================================
// PostPeekView — a post, summoned.
//
// The /writing row's peek, and every other place a post is summoned the same
// way: a magic link in prose peeks with it under the pointer, and on a phone
// the attachment drawer shows it where the peek cannot (components/magic-link,
// systems/attachments). One view, so a post looks like the same thing
// wherever it is asked for.
// =============================================================================

/**
 * The cursor panel a post peek arrives in. p-0 strips the default panel
 * padding so the cover sits flush against the rounded edge; the view owns
 * its padding. The panel IS the visible card here, so it lifts.
 */
export const POST_PEEK_PANEL = "p-0 overflow-hidden max-w-md shadow-raised";

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
 *   4. excerpt      — the first paragraph, whole (sans, prose recipe)
 *   5. hairline rule
 *   6. tags         — plain text, middle-dot separated
 *
 * Title and date are deliberately omitted (both already on the hovered row).
 * No chips, no icons, no colored accents — keeps the surface inside the
 * project's content UI calm even though the panel chrome itself is system
 * Liquid Glass.
 */
export function PostPeekView({
  peek: meta,
  className,
  whole = false,
}: {
  peek: PostPeek;
  /** The width: the peek's own (PEEK_W) unless a surface sets it. */
  className?: string;
  /** Print the dek and the paragraph in full: a drawer has the room a
   *  pointer's peek doesn't, which clamps them to a few lines. */
  whole?: boolean;
}) {
  const origin = meta.origin ? flattenMarkdownLinks(meta.origin) : undefined;
  const hasTags = !!(meta.tags && meta.tags.length);
  const description = meta.description;

  return (
    <div className={cn(className ?? PEEK_W, "max-w-full")}>
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
        <div className={cn(TYPE.labelSm, "leading-relaxed")}>
          <span>{LANGUAGE_LABEL[meta.language]}</span>
          {/* The /writing list's payload leaves the reading time out of
              some posts; an empty slot would print as "· ·". */}
          {meta.readingTime && (
            <>
              <span className="mx-1.5 text-quaternary-foreground">·</span>
              <span>{meta.readingTime}</span>
            </>
          )}
          {origin && (
            <>
              <span className="mx-1.5 text-quaternary-foreground">·</span>
              <span>{origin}</span>
            </>
          )}
        </div>

        {/* Description acts as a subtitle / dek — serif italic for the
            editorial vibe, distinct register from the sans excerpt below.
            A peek field only: the post's page doesn't print it. */}
        {description && (
          <p
            lang={langOf(description)}
            className={cn(TYPE.dek, "text-sm", !whole && "line-clamp-2")}
          >
            {description}
          </p>
        )}

        {/* The first paragraph, whole (lib/mdx `extractLead`), in the article
            body's recipe: it reads as the start of the real thing. */}
        {meta.excerpt && (
          <p className={cn("text-sm text-foreground/75 leading-relaxed", !whole && "line-clamp-5")}>
            {meta.excerpt}
          </p>
        )}

        {hasTags && (
          // Same recipe as the top caption (mono uppercase tracking-wider)
          // so the card frames its content with a matched pair of meta
          // strips — top: language/reading; bottom: tags.
          <div className={cn("pt-3 border-t border-border/30 leading-relaxed", TYPE.labelSm)}>
            {meta.tags!.join("  ·  ")}
          </div>
        )}
      </div>
    </div>
  );
}
