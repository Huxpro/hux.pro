"use client";

import { useState } from "react";
import type { ProjectItem } from "@/lib/eras";
import {
  localize,
  localizeOptional,
  formatItemDate,
} from "@/lib/eras";
import type { Locale } from "@/lib/i18n";
import {
  TitleRow,
  LinksRow,
  Description,
  Commentary,
  TechStack,
  Stats,
  ExpandedContent,
} from "./shared";

interface ProjectEmbedProps {
  item: ProjectItem;
  locale: Locale;
  defaultExpanded?: boolean;
}

export function ProjectEmbed({
  item,
  locale,
  defaultExpanded = false,
}: ProjectEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const title = localize(item.title, locale);
  const description = localize(item.description, locale);
  const commentary = localizeOptional(item.commentary, locale);
  const date = formatItemDate(item, locale);

  const hasDetails = !!(
    commentary ||
    (item.techStack && item.techStack.length > 0) ||
    item.stats
  );

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <TitleRow
          title={title}
          url={item.links[0]?.url}
          hasDetails={hasDetails}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
        <LinksRow links={item.links} />
      </div>

      <Description text={description} isExpanded={isExpanded} />

      <ExpandedContent isExpanded={isExpanded}>
        {item.techStack && <TechStack items={item.techStack} />}
        {item.stats && <Stats {...item.stats} />}
        {commentary && <Commentary text={commentary} />}
      </ExpandedContent>
    </div>
  );
}
