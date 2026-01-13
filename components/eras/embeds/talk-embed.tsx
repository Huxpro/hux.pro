"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { TalkItem, ItemLink } from "@/lib/eras";
import { localize, localizeOptional, formatItemDate } from "@/lib/eras";
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
  item: TalkItem;
  locale: Locale;
  defaultExpanded?: boolean;
}

function TalkThumbnail({
  thumbnail,
  hasVideo,
}: {
  thumbnail?: string;
  hasVideo: boolean;
}) {
  return (
    <div className="shrink-0 w-32 h-20 bg-muted/20 rounded-sm border border-border/50 flex items-center justify-center group/thumb relative overflow-hidden">
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
  item,
  locale,
  defaultExpanded = false,
}: TalkEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const title = localize(item.title, locale);
  const description = localize(item.description, locale);
  const commentary = localizeOptional(item.commentary, locale);
  const date = formatItemDate(item, locale);

  const hasDetails = !!commentary;

  // Collect links
  const links: ItemLink[] = [];
  if (item.video) {
    links.push({
      url: item.video.url,
      label: locale === "zh" ? "观看视频" : "YouTube",
      icon: "youtube",
    });
  }
  if (item.slides) {
    links.push({
      url: item.slides.url,
      label: locale === "zh" ? "幻灯片" : "Slides",
      icon: "slides",
    });
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <TalkThumbnail
        thumbnail={item.video?.thumbnail}
        hasVideo={!!item.video}
      />

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <TitleRow
            title={title}
            url={item.conference.url}
            hasDetails={hasDetails}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />
          <LinksRow links={links} />
        </div>

        <MetaRow date={date} meta={item.conference.name} />
        <Description text={description} isExpanded={isExpanded} />

        <ExpandedContent isExpanded={isExpanded}>
          {commentary && <Commentary text={commentary} />}
        </ExpandedContent>
      </div>
    </div>
  );
}
