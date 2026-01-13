"use client";

import { useState } from "react";
import type { SocialItem, ItemLink } from "@/lib/eras";
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

interface SocialEmbedProps {
  item: SocialItem;
  locale: Locale;
  defaultExpanded?: boolean;
}

export function SocialEmbed({
  item,
  locale,
  defaultExpanded = false,
}: SocialEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const title = localize(item.title, locale);
  const description = localize(item.description, locale);
  const commentary = localizeOptional(item.commentary, locale);
  const date = formatItemDate(item, locale);

  const hasDetails = !!commentary;

  const links: ItemLink[] = [
    {
      url: item.url,
      label: item.platform,
      icon: "external",
    },
  ];

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
        <LinksRow links={links} />
      </div>

      <MetaRow date={date} meta={item.platform} />
      <Description text={description} isExpanded={isExpanded} />

      <ExpandedContent isExpanded={isExpanded}>
        {commentary && <Commentary text={commentary} />}
      </ExpandedContent>
    </div>
  );
}
