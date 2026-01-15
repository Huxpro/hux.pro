"use client";

import { useState } from "react";
import type { ProjectCommit } from "@/lib/log";
import {
  localize,
  localizeOptional,
  formatCommitDate,
} from "@/lib/log";
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
  commit: ProjectCommit;
  locale: Locale;
  defaultExpanded?: boolean;
}

export function ProjectEmbed({
  commit,
  locale,
  defaultExpanded = false,
}: ProjectEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);

  const hasDetails = !!(
    commentary ||
    (commit.techStack && commit.techStack.length > 0) ||
    commit.stats
  );

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <TitleRow
          title={title}
          url={commit.links[0]?.url}
          hasDetails={hasDetails}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
        />
        <LinksRow links={commit.links} />
      </div>

      <Description text={description} isExpanded={isExpanded} />

      <ExpandedContent isExpanded={isExpanded}>
        {commit.techStack && <TechStack items={commit.techStack} />}
        {commit.stats && <Stats {...commit.stats} />}
        {commentary && <Commentary text={commentary} />}
      </ExpandedContent>
    </div>
  );
}

// =============================================================================
// Compact Variant (Home Widget / Stack)
// Title + Date only
// =============================================================================

export function ProjectEmbedCompact({
  commit,
  locale,
}: {
  commit: ProjectCommit;
  locale: Locale;
}) {
  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const date = formatCommitDate(commit, locale);

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="text-sm text-foreground truncate">{title}</div>
      <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {description}
      </div>
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
        {date}
      </div>
    </div>
  );
}
