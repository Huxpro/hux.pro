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
          className="block w-full aspect-video rounded-lg overflow-hidden bg-muted/20 border border-border/50 hover:border-border transition-colors mb-2"
        >
          <img
            src={data.thumbnail.url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src.includes("maxresdefault")) {
                target.src = target.src.replace("maxresdefault", "hqdefault");
              }
            }}
          />
        </a>
      )}

      <div className="space-y-1 min-w-0">
        <div className="text-sm text-foreground truncate">
          {data.title}
          {data.languageBadge && (
            <span
              className="ml-1.5 inline-flex items-center align-[2px] font-mono text-[10px] leading-none text-muted-foreground/60 border border-border/60 rounded-sm px-1 py-0.5"
              title={data.languageBadge === "EN" ? "In English" : "In Chinese"}
            >
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
