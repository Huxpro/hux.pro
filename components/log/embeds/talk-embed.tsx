"use client";

import { useState } from "react";
import type { TalkCommit, Media } from "@/lib/log";
import { localize, localizeOptional, formatCommitDate, isVideoMedia, isLinkMedia, getMediaThumbnail } from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import {
  TitleRow,
  LinksRow,
  LinkIcon,
  MetaRow,
  Description,
  Commentary,
  TagBadges,
  ExpandedContent,
} from "./shared";

interface TalkEmbedProps {
  commit: TalkCommit;
  locale: Locale;
  defaultExpanded?: boolean;
}

type SimpleLink = { url: string; label: string; icon: string };

function collectMediaLinks(
  media: Media[],
  locale: "en" | "zh"
): SimpleLink[] {
  const links: SimpleLink[] = [];

  for (const m of media) {
    if (isVideoMedia(m)) {
      const platformLabel: Record<string, string> = {
        bilibili: "Bilibili",
        youtube: locale === "zh" ? "观看视频" : "YouTube",
        vimeo: "Vimeo",
      };
      links.push({
        url: m.url,
        label: platformLabel[m.platform] ?? m.platform,
        icon: m.platform,
      });
    } else if (isLinkMedia(m)) {
      links.push({
        url: m.url,
        label: m.label || (locale === "zh" ? "链接" : "Link"),
        icon: m.icon || "external",
      });
    }
  }

  return links;
}

export function TalkEmbed({
  commit,
  locale,
  defaultExpanded = false,
}: TalkEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);

  const hasTags = (commit.tags ?? []).length > 0;
  const hasDetails = !!(commentary || hasTags);

  const media = commit.media ?? [];
  const allLinks = collectMediaLinks(media, locale);

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <TitleRow
            title={title}
            url={commit.conference.url}
            hasDetails={hasDetails}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />

          <LinksRow links={allLinks} />
        </div>

        <MetaRow date={date} meta={commit.conference.name} />
        <Description text={description} isExpanded={isExpanded} />

        <ExpandedContent isExpanded={isExpanded}>
          {hasTags && <TagBadges items={commit.tags!} />}
          {commentary && <Commentary text={commentary} />}
        </ExpandedContent>
      </div>
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
