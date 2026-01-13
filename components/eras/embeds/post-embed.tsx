"use client";

import { useState } from "react";
import type { PostItem } from "@/lib/eras";
import { localize, localizeOptional, formatItemDate } from "@/lib/eras";
import type { Locale } from "@/lib/i18n";
import {
  TitleRow,
  MetaRow,
  Description,
  Commentary,
  ExpandedContent,
} from "./shared";

interface PostEmbedProps {
  item: PostItem;
  locale: Locale;
  defaultExpanded?: boolean;
}

export function PostEmbed({
  item,
  locale,
  defaultExpanded = false,
}: PostEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const title = localize(item.title, locale);
  const description = localize(item.description, locale);
  const commentary = localizeOptional(item.commentary, locale);
  const date = formatItemDate(item, locale);

  const hasDetails = !!commentary;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <TitleRow
          title={title}
          url={item.url}
          hasDetails={hasDetails}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide shrink-0">
          {item.publication.name}
        </span>
      </div>

      <MetaRow date={date} />
      <Description text={description} isExpanded={isExpanded} />

      <ExpandedContent isExpanded={isExpanded}>
        {commentary && <Commentary text={commentary} />}
      </ExpandedContent>
    </div>
  );
}
