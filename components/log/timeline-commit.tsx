"use client";

/**
 * TimelineCommit — Dense git-log style commit row for /works timeline.
 *
 * Summary: hash · icon · title · [link-icons] ··· date
 * Expanded: description, links, tags, stats, commentary, media, video player
 *
 * Consumes NormalizedCommit — fully type-agnostic.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronUp } from "lucide-react";
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

// Indent to align expanded content under the title (past hash + gap + icon + gap)
const INDENT = "ml-[calc(7ch+0.5rem+0.75rem+0.5rem)]";

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
  const [showPlayer, setShowPlayer] = useState(false);

  const hasPlayer = data.playableMedia.length > 0;
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
        "hover:bg-muted/10",
        className,
      )}
      onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
    >
      {/* Primary row: hash · icon · title · [link-icons] ··· date */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs text-muted-foreground/40 shrink-0 select-all">
          {data.hash}
        </span>
        <Icon className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        <span className="text-sm text-foreground truncate min-w-0 flex-1">
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
          {data.videoLinks.map((link, i) => (
            <button
              key={`video-${i}`}
              type="button"
              onClick={() => setShowPlayer(!showPlayer)}
              className={cn(
                "transition-colors",
                showPlayer
                  ? "text-red-500"
                  : "text-muted-foreground/40 hover:text-red-500",
              )}
            >
              {showPlayer ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <LinkIcon icon={link.icon} />
              )}
            </button>
          ))}
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

      {/* Secondary row: meta (always visible, muted) */}
      {data.meta && (
        <div
          className={cn(
            "mt-1 text-xs font-mono text-muted-foreground/40",
            INDENT,
          )}
        >
          {data.meta}
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div
          className={cn(
            "mt-2 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150",
            INDENT,
          )}
        >
          {data.subtitle && (
            <div className="text-sm text-muted-foreground font-medium">
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

      {/* Inline video player — any commit with VideoMedia */}
      <AnimatePresence initial={false}>
        {showPlayer && hasPlayer && (
          <motion.div
            key="player"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={cn("overflow-hidden mt-2", INDENT)}
          >
            <MediaRenderer
              media={data.playableMedia}
              layout="stack"
              size="default"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-video rich media (images, embeds) — shown when expanded */}
      {isExpanded &&
        data.nonLinkMedia.filter((m) => m.type !== "video").length > 0 && (
          <div className={cn("mt-2", INDENT)}>
            <MediaRenderer
              media={data.nonLinkMedia.filter((m) => m.type !== "video")}
              layout="stack"
              size="default"
            />
          </div>
        )}
    </div>
  );
}
