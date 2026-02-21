"use client";

/**
 * TimelineCommit — Dense git-log style commit row for /works timeline.
 *
 * Summary: hash · icon · title · [link-icons] ··· date
 * Expanded: subtitle, description, links, tags, stats, commentary, media
 *
 * Responsive grid: [icon | content] on small, [hash | icon | content] on @sm+.
 * Uses the same shared primitives as CommitCard to ensure visual sync.
 * Consumes NormalizedCommit — fully type-agnostic.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { NormalizedCommit } from "./commit-data";
import { commitIcons } from "./icons";
import {
  LinkIcon,
  LinksRow,
  Description,
  Commentary,
  TagBadges,
  Stats,
} from "./embeds/shared";
import { MediaRenderer } from "./media";

interface TimelineCommitProps {
  data: NormalizedCommit;
  defaultExpanded?: boolean;
  className?: string;
}

export function TimelineCommit({
  data,
  defaultExpanded = false,
  className,
}: TimelineCommitProps) {
  const Icon = commitIcons[data.type];
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasExpandableContent = !!(
    data.description ||
    data.commentary ||
    data.tags.length > 0 ||
    data.stats ||
    data.nonLinkMedia.length > 0
  );

  return (
    <div
      id={data.hash}
      className={cn(
        "group -mx-3 px-3 py-2.5 rounded-lg transition-colors duration-150 cursor-default",
        "@container hover:bg-muted/10",
        className,
      )}
      onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
    >
      {/* Grid: [icon][content] on small, [hash][icon][content] on @sm+ */}
      <div className="grid grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
        {/* Hash — own column, hidden on small containers */}
        <span className="hidden @sm:inline font-mono text-xs text-muted-foreground/40 select-all pt-px">
          {data.hash}
        </span>

        {/* Icon — always visible, own column */}
        <Icon className="w-3 h-3 text-muted-foreground/50 mt-0.5" />

        {/* Primary row: title · [link-icons] ··· date */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-foreground min-w-0 flex-1">
            {data.primaryUrl ? (
              <a
                href={data.primaryUrl}
                target={data.primaryUrl.startsWith("/") ? undefined : "_blank"}
                rel={
                  data.primaryUrl.startsWith("/")
                    ? undefined
                    : "noopener noreferrer"
                }
                className="hover:underline decoration-1 underline-offset-4"
                onClick={(e) => e.stopPropagation()}
              >
                {data.title}
              </a>
            ) : (
              data.title
            )}
          </span>

          {/* Link indicators (icon-only, inline) */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {data.links.map((link, i) => (
              <a
                key={`link-${i}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                <LinkIcon icon={link.icon} />
              </a>
            ))}
          </div>

          <span className="font-mono text-xs text-muted-foreground/50 shrink-0 ml-auto">
            {data.date}
          </span>
        </div>

        {/* Secondary row: meta (always visible, muted) — content column */}
        {data.meta && (
          <div className="col-start-2 @sm:col-start-3 mt-1 text-xs font-mono text-muted-foreground/40">
            {data.meta}
          </div>
        )}

        {/* Expanded content — content column */}
        {isExpanded && (
          <div className="col-start-2 @sm:col-start-3 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            {data.subtitle && (
              <div className="text-xs text-muted-foreground/60">
                {data.subtitle}
              </div>
            )}

            <Description text={data.description} isExpanded />

            {data.links.length > 0 && <LinksRow links={data.links} />}

            {data.tags.length > 0 && <TagBadges items={data.tags} />}

            {data.stats && <Stats {...data.stats} />}

            {data.commentary && <Commentary text={data.commentary} />}
          </div>
        )}

        {/* Rich media (video, embed, image) — shown when expanded */}
        {isExpanded && data.nonLinkMedia.length > 0 && (
          <div className="col-start-2 @sm:col-start-3 mt-2">
            <MediaRenderer
              media={data.nonLinkMedia}
              layout="stack"
              size="default"
            />
          </div>
        )}
      </div>
    </div>
  );
}
