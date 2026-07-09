"use client";

/**
 * CommitCompact — Generic minimal commit renderer for VStack/HStack widgets.
 *
 * Replaces the 5 per-type compact components. Fully type-agnostic —
 * all type-specific decisions are made by the adapter (normalizeCommit).
 *
 * Layout: optional thumbnail → title → secondaryLine → date
 */

import { Play } from "lucide-react";
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
          className="relative block w-full aspect-video rounded-lg overflow-hidden bg-muted/20 border border-border/50 hover:border-border transition-colors mb-2 group/thumb"
        >
          <ExternalImage
            src={data.thumbnail.url}
            className="w-full h-full object-cover"
          />
          {/* Play affordance for video-ish covers (real videos + talk-recording
              links like GitNation), so widget talk covers read as playable. */}
          {data.thumbnail.isVideo && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm ring-1 ring-white/25 transition-transform group-hover/thumb:scale-105">
                <Play className="h-4 w-4 translate-x-px" fill="currentColor" />
              </span>
            </span>
          )}
        </a>
      )}

      <div className="space-y-1 min-w-0">
        <div className="text-sm text-foreground truncate">
          {data.title}
          {data.languageBadge && (
            <span className="ml-2 text-xs font-mono text-muted-foreground/40 align-baseline">
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
