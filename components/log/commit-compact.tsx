"use client";

/**
 * CommitCompact — Generic minimal commit renderer for VStack/HStack widgets.
 *
 * Replaces the 5 per-type compact components. Fully type-agnostic —
 * all type-specific decisions are made by the adapter (normalizeCommit).
 *
 * Layout: optional thumbnail → title → secondaryLine → date
 */

import type { NormalizedCommit } from "./commit-data";
import { ExternalImage } from "./media/external-image";
import { useLocale } from "@/services";
import { markFor, MediaMark } from "./media/media-mark";

interface CommitCompactProps {
  data: NormalizedCommit;
  className?: string;
}

export function CommitCompact({ data, className }: CommitCompactProps) {
  const { locale } = useLocale();
  return (
    <div className={className}>
      {/* Thumbnail (any commit with video/image media) */}
      {data.thumbnail && (
        <a
          href={data.thumbnail.linkUrl ?? data.thumbnail.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pressable relative block w-full aspect-video rounded-lg overflow-hidden bg-muted/20 border border-border/50 hover:border-border active:border-border active:opacity-80 transition-[border-color,opacity] mb-2 group/thumb"
        >
          <ExternalImage
            src={data.thumbnail.url}
            className="w-full h-full object-cover"
          />
          {/* The cover's chip — the platform on a recording, `Slides` on a
              deck — so a widget cover reads the way the row's does. */}
          <MediaMark mark={markFor(data.thumbnail.media, locale)} size="compact" />
        </a>
      )}

      <div className="space-y-1 min-w-0">
        {/* Title truncates, but the language badge stays pinned and visible
            (shrink-0) — a talk's language must not get clipped with a long
            title. */}
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm text-foreground truncate min-w-0">
            {data.title}
          </span>
          {data.languageBadge && (
            <span className="shrink-0 text-xs font-mono text-tertiary-foreground">
              {data.languageBadge}
            </span>
          )}
        </div>
        {data.secondaryLine && data.secondaryLine !== data.description && (
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wide truncate">
            {data.secondaryLine}
          </div>
        )}
        {data.secondaryLine === data.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {data.description}
          </div>
        )}
        {/* Date — shown separately when secondaryLine doesn't include it */}
        {data.secondaryLine === data.description && (
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
            {data.date}
          </div>
        )}
      </div>
    </div>
  );
}
