"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { TalkCommit, ItemLink } from "@/lib/log";
import { localize, localizeOptional, formatCommitDate } from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import {
  TitleRow,
  LinksRow,
  MetaRow,
  Description,
  Commentary,
  ExpandedContent,
} from "./shared";

interface TalkEmbedProps {
  commit: TalkCommit;
  locale: Locale;
  defaultExpanded?: boolean;
}

function TalkThumbnail({
  thumbnail,
  hasVideo,
  className,
}: {
  thumbnail?: string;
  hasVideo: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        "bg-muted/20 border border-border/50 flex items-center justify-center group/thumb relative overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {thumbnail ? (
        <div
          className="w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${thumbnail})` }}
        />
      ) : (
        <Play className="w-6 h-6 text-muted-foreground/30" />
      )}
      {hasVideo && (
        <div className="absolute inset-0 bg-black/5 group-hover/thumb:bg-black/0 transition-colors" />
      )}
    </div>
  );
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

  const hasDetails = !!commentary;

  // Collect links
  const links: ItemLink[] = [];
  if (commit.video) {
    links.push({
      url: commit.video.url,
      label: locale === "zh" ? "观看视频" : "YouTube",
      icon: "youtube",
    });
  }
  if (commit.slides) {
    links.push({
      url: commit.slides.url,
      label: locale === "zh" ? "幻灯片" : "Slides",
      icon: "slides",
    });
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
      <TalkThumbnail
        thumbnail={commit.video?.thumbnail}
        hasVideo={!!commit.video}
        className="shrink-0 self-start w-32 aspect-video rounded-sm"
      />

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <TitleRow
            title={title}
            url={commit.conference.url}
            hasDetails={hasDetails}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />
          <LinksRow links={links} />
        </div>

        <MetaRow date={date} meta={commit.conference.name} />
        <Description text={description} isExpanded={isExpanded} />

        <ExpandedContent isExpanded={isExpanded}>
          {commentary && <Commentary text={commentary} />}
        </ExpandedContent>
      </div>
    </div>
  );
}

// =============================================================================
// Compact Variant (Home Widget / Stack)
// Thumbnail + Title + Date only
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

  return (
    <div className="space-y-3">
      <TalkThumbnail
        thumbnail={commit.video?.thumbnail}
        hasVideo={!!commit.video}
        className="w-full aspect-video rounded-lg"
      />

      <div className="min-w-0 space-y-1">
        <div className="text-sm text-foreground truncate">{title}</div>
        <MetaRow date={date} />
      </div>
    </div>
  );
}
