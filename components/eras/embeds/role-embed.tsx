"use client";

import { useState } from "react";
import type { RoleItem, ItemLink } from "@/lib/eras";
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

interface RoleEmbedProps {
  item: RoleItem;
  locale: Locale;
  defaultExpanded?: boolean;
}

export function RoleEmbed({
  item,
  locale,
  defaultExpanded = false,
}: RoleEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const company = localize(item.company, locale);
  const roleTitle = localize(item.roleTitle, locale);
  const description = localize(item.description, locale);
  const commentary = localizeOptional(item.commentary, locale);
  const date = formatItemDate(item, locale);

  const hasDetails = !!commentary;

  const links: ItemLink[] = [];
  if (item.url) {
    links.push({
      url: item.url,
      label: locale === "zh" ? "网站" : "Website",
      icon: "globe",
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <TitleRow
          title={company}
          url={item.url}
          hasDetails={hasDetails}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
        <LinksRow links={links} />
      </div>

      <div className="text-sm text-muted-foreground font-medium">
        {roleTitle}
      </div>

      <MetaRow date={date} meta={item.location} />
      <Description text={description} isExpanded={isExpanded} />

      <ExpandedContent isExpanded={isExpanded}>
        {commentary && <Commentary text={commentary} />}
      </ExpandedContent>
    </div>
  );
}
