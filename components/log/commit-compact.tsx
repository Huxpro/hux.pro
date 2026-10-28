"use client";

/**
 * CommitCompact: generic minimal commit renderer for VStack/HStack widgets.
 *
 * Replaces the 5 per-type compact components. Type-agnostic: all
 * type-specific decisions are made by the adapter (normalizeCommit).
 *
 * Layout: optional thumbnail → title → secondaryLine → date
 */

import { COVER_WASH } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import type { NormalizedCommit } from "./commit-data";
import { ExternalImage } from "./media/external-image";

interface CommitCompactProps {
  data: NormalizedCommit;
  className?: string;
}

export function CommitCompact({ data, className }: CommitCompactProps) {
  return (
    <div className={className}>
      {/* Thumbnail (any commit with video/image media) */}
      {data.thumbnail && (
        <a
          href={data.thumbnail.linkUrl ?? data.thumbnail.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group/thumb pressable relative mb-2 block aspect-video w-full overflow-hidden rounded-lg border border-border/50 bg-muted/20 transition-colors hover:border-border active:border-border"
        >
          <ExternalImage
            src={data.thumbnail.url}
            className="h-full w-full object-cover"
          />
          <span className={COVER_WASH} />
          {/* No chip on a widget cover (media-mark.tsx): the widget's line
              under it says what the commit is. */}
        </a>
      )}

      <div className="space-y-1 min-w-0">
        {/* Title truncates, but the language badge stays pinned and visible
            (shrink-0). A talk's language must not get clipped with a long
            title. */}
        {/* The same pair the /works row prints: a heading over its message
            (`TYPE.rowHeading` / `TYPE.message`), a plain title otherwise. */}
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className={cn(
              "truncate min-w-0",
              data.secondaryLine === data.description ? TYPE.rowHeading : TYPE.rowTitle,
            )}
          >
            {data.title}
          </span>
          {data.languageBadge && (
            <span className="shrink-0 text-xs font-mono text-tertiary-foreground">
              {data.languageBadge}
            </span>
          )}
        </div>
        {data.secondaryLine && data.secondaryLine !== data.description && (
          <div className="text-xs font-mono text-muted-foreground truncate">
            {data.secondaryLine}
          </div>
        )}
        {data.secondaryLine === data.description && (
          <div className={cn("line-clamp-2", TYPE.message)}>
            {data.description}
          </div>
        )}
        {/* Date, shown separately when secondaryLine doesn't include it */}
        {data.secondaryLine === data.description && (
          <div className="text-xs font-mono text-muted-foreground">
            {data.date}
          </div>
        )}
      </div>
    </div>
  );
}
