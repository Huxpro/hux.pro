"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronUp } from "lucide-react";
import type { TalkCommit, Media } from "@/lib/log";
import { localize, localizeOptional, formatCommitDate, isVideoMedia, isLinkMedia, getMediaThumbnail } from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  TitleRow,
  LinksRow,
  LinkIcon,
  MetaRow,
  Description,
  Commentary,
  ExpandedContent,
} from "./shared";
import { MediaRenderer } from "../media";

interface TalkEmbedProps {
  commit: TalkCommit;
  locale: Locale;
  defaultExpanded?: boolean;
}

/**
 * Split media into video toggle links and regular links.
 * Video links get an onClick handler instead of navigating.
 */
type SimpleLink = { url: string; label: string; icon: string };

function partitionMediaLinks(
  media: Media[],
  locale: "en" | "zh"
): { videoLinks: SimpleLink[]; otherLinks: SimpleLink[] } {
  const videoLinks: SimpleLink[] = [];
  const otherLinks: SimpleLink[] = [];

  for (const m of media) {
    if (isVideoMedia(m)) {
      const platformLabel: Record<string, string> = {
        bilibili: "Bilibili",
        youtube: locale === "zh" ? "观看视频" : "YouTube",
        vimeo: "Vimeo",
      };
      videoLinks.push({
        url: m.url,
        label: platformLabel[m.platform] ?? m.platform,
        icon: m.platform,
      });
    } else if (isLinkMedia(m)) {
      otherLinks.push({
        url: m.url,
        label: m.label || (locale === "zh" ? "链接" : "Link"),
        icon: m.icon || "external",
      });
    }
  }

  return { videoLinks, otherLinks };
}

export function TalkEmbed({
  commit,
  locale,
  defaultExpanded = false,
}: TalkEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showPlayer, setShowPlayer] = useState(false);

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);

  const hasDetails = !!commentary;

  const media = commit.media ?? [];
  const { videoLinks, otherLinks } = partitionMediaLinks(media, locale);
  const playableMedia = media.filter(isVideoMedia);
  const hasPlayer = playableMedia.length > 0;

  return (
    <div className="space-y-2">
      {/* Compact text row - same density as other commit types */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <TitleRow
            title={title}
            url={commit.conference.url}
            hasDetails={hasDetails}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />

          {/* Links: video toggles + regular links */}
          <div
            className="flex items-center gap-3 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            {videoLinks.map((link, i) => (
              <button
                key={`video-${i}`}
                type="button"
                onClick={() => setShowPlayer(!showPlayer)}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs transition-colors",
                  showPlayer
                    ? "text-red-500"
                    : "text-muted-foreground hover:text-red-500"
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
            <LinksRow links={otherLinks} />
          </div>
        </div>

        <MetaRow date={date} meta={commit.conference.name} />
        <Description text={description} isExpanded={isExpanded} />

        <ExpandedContent isExpanded={isExpanded}>
          {commentary && <Commentary text={commentary} />}
        </ExpandedContent>
      </div>

      {/* Inline video expand - like a git diff unfold */}
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
              media={playableMedia}
              layout="stack"
              size="default"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// Compact Variant (Home Widget / Stack)
// Simple thumbnail + Title + Date (navigates on click, no inline player)
// =============================================================================

export function TalkEmbedCompact({
  commit,
  locale,
}: {
  commit: TalkCommit;
  locale: Locale;
}) {
  const title = localize(commit.title, locale);
  const date = formatCommitDate(commit, locale);
  const media = commit.media ?? [];

  // Get primary media for thumbnail
  const primaryMedia = media.find(isVideoMedia) || media[0];
  const thumbnailUrl = primaryMedia ? getMediaThumbnail(primaryMedia) : null;
  const videoUrl = primaryMedia?.url;

  return (
    <div className="space-y-2">
      {/* Simple thumbnail - no play button overlay for compact view */}
      {thumbnailUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full aspect-video rounded-lg overflow-hidden bg-muted/20 border border-border/50 hover:border-border transition-colors"
        >
          <img
            src={thumbnailUrl}
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

      <div className="min-w-0 space-y-1">
        <div className="text-sm text-foreground truncate">{title}</div>
        <MetaRow date={date} />
      </div>
    </div>
  );
}
