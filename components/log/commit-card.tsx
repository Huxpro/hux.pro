"use client";

/**
 * CommitCard — Generic full-content commit renderer.
 *
 * Replaces the 5 per-type embed components (ProjectEmbed, TalkEmbed, etc.)
 * with a single type-agnostic renderer that consumes NormalizedCommit.
 * Video player toggle works for ANY commit with VideoMedia.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedCommit } from "./commit-data";
import {
  TitleRow,
  LinksRow,
  LinkIcon,
  MetaRow,
  Description,
  Commentary,
  TagBadges,
  Stats,
  ExpandedContent,
} from "./embeds/shared";
import { MediaRenderer } from "./media";

interface CommitCardProps {
  data: NormalizedCommit;
  defaultExpanded?: boolean;
  className?: string;
}

export function CommitCard({
  data,
  defaultExpanded = false,
  className,
}: CommitCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showPlayer, setShowPlayer] = useState(false);

  const hasPlayer = data.playableMedia.length > 0;
  const hasDetails = !!(
    data.commentary ||
    data.tags.length > 0 ||
    data.stats
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        {/* Title + Links row */}
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <TitleRow
            title={data.title}
            url={data.primaryUrl}
            hasDetails={hasDetails}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />

          {/* Video toggle buttons + regular links */}
          <div
            className="flex items-center gap-3 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            {data.videoLinks.map((link, i) => (
              <button
                key={`video-${i}`}
                type="button"
                onClick={() => setShowPlayer(!showPlayer)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs transition-colors",
                  showPlayer
                    ? "text-red-500"
                    : "text-muted-foreground hover:text-red-500",
                )}
              >
                {showPlayer ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <LinkIcon icon={link.icon} />
                )}
                <span>{link.label}</span>
              </button>
            ))}
            <LinksRow links={data.links} />
          </div>
        </div>

        {/* Subtitle (e.g. roleTitle) */}
        {data.subtitle && (
          <div className="text-sm text-muted-foreground font-medium">
            {data.subtitle}
          </div>
        )}

        <MetaRow date={data.date} meta={data.meta} />
        <Description text={data.description} isExpanded={isExpanded} />

        <ExpandedContent isExpanded={isExpanded}>
          {data.tags.length > 0 && <TagBadges items={data.tags} />}
          {data.stats && <Stats {...data.stats} />}
          {data.commentary && <Commentary text={data.commentary} />}
        </ExpandedContent>
      </div>

      {/* Inline video player — any commit with VideoMedia */}
      <AnimatePresence initial={false}>
        {showPlayer && hasPlayer && (
          <motion.div
            key="player"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <MediaRenderer
              media={data.playableMedia}
              layout="stack"
              size="default"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Non-link, non-video media (images, embeds) */}
      {data.nonLinkMedia.filter((m) => m.type !== "video").length > 0 && (
        <MediaRenderer
          media={data.nonLinkMedia.filter((m) => m.type !== "video")}
          layout="stack"
          size="default"
        />
      )}
    </div>
  );
}
