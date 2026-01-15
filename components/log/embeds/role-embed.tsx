"use client";

import { useState } from "react";
import type { RoleCommit, ItemLink } from "@/lib/log";
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

interface RoleEmbedProps {
  commit: RoleCommit;
  locale: Locale;
  defaultExpanded?: boolean;
}

export function RoleEmbed({
  commit,
  locale,
  defaultExpanded = false,
}: RoleEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const company = localize(commit.company, locale);
  const roleTitle = localize(commit.roleTitle, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);

  const hasDetails = !!commentary;

  const links: ItemLink[] = [];
  if (commit.url) {
    links.push({
      url: commit.url,
      label: locale === "zh" ? "网站" : "Website",
      icon: "globe",
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <TitleRow
          title={company}
          url={commit.url}
          hasDetails={hasDetails}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
        <LinksRow links={links} />
      </div>

      <div className="text-sm text-muted-foreground font-medium">
        {roleTitle}
      </div>

      <MetaRow date={date} meta={commit.location} />
      <Description text={description} isExpanded={isExpanded} />

      <ExpandedContent isExpanded={isExpanded}>
        {commentary && <Commentary text={commentary} />}
      </ExpandedContent>
    </div>
  );
}

// =============================================================================
// Compact Variant (Home Widget / Stack)
// Company + Role Title + Date
// =============================================================================

export function RoleEmbedCompact({
  commit,
  locale,
}: {
  commit: RoleCommit;
  locale: Locale;
}) {
  const company = localize(commit.company, locale);
  const roleTitle = localize(commit.roleTitle, locale);
  const date = formatCommitDate(commit, locale);

  return (
    <div className="space-y-1 min-w-0">
      <div className="text-sm text-foreground truncate">{company}</div>
      <div className="text-xs text-muted-foreground truncate">{roleTitle}</div>
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
        {date}
      </div>
    </div>
  );
}
