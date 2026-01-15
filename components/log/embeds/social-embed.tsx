"use client";

import { useState } from "react";
import type { SocialCommit, ItemLink } from "@/lib/log";
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

interface SocialEmbedProps {
  commit: SocialCommit;
  locale: Locale;
  defaultExpanded?: boolean;
}

export function SocialEmbed({
  commit,
  locale,
  defaultExpanded = false,
}: SocialEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);

  const hasDetails = !!commentary;

  const links: ItemLink[] = [
    {
      url: commit.url,
      label: commit.platform,
      icon: "external",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <TitleRow
          title={title}
          url={commit.url}
          hasDetails={hasDetails}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
        <LinksRow links={links} />
      </div>

      <MetaRow date={date} meta={commit.platform} />
      <Description text={description} isExpanded={isExpanded} />

      <ExpandedContent isExpanded={isExpanded}>
        {commentary && <Commentary text={commentary} />}
      </ExpandedContent>
    </div>
  );
}

// =============================================================================
// Compact Variant (Home Widget / Stack)
// Title + Platform + Date
// =============================================================================

export function SocialEmbedCompact({
  commit,
  locale,
}: {
  commit: SocialCommit;
  locale: Locale;
}) {
  const title = localize(commit.title, locale);
  const date = formatCommitDate(commit, locale);

  return (
    <div className="space-y-1 min-w-0">
      <div className="text-sm text-foreground truncate">{title}</div>
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
        {commit.platform}
        {" · "}
        {date}
      </div>
    </div>
  );
}
