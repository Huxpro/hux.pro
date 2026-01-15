"use client";

import { useState } from "react";
import type { PostCommit } from "@/lib/log";
import { localize, localizeOptional, formatCommitDate } from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import {
  TitleRow,
  MetaRow,
  Description,
  Commentary,
  ExpandedContent,
} from "./shared";

interface PostEmbedProps {
  commit: PostCommit;
  locale: Locale;
  defaultExpanded?: boolean;
}

export function PostEmbed({
  commit,
  locale,
  defaultExpanded = false,
}: PostEmbedProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const title = localize(commit.title, locale);
  const description = localize(commit.description, locale);
  const commentary = localizeOptional(commit.commentary, locale);
  const date = formatCommitDate(commit, locale);

  const hasDetails = !!commentary;

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
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide shrink-0">
          {commit.publication.name}
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

// =============================================================================
// Compact Variant (Home Widget / Stack)
// Title + Publication + Date
// =============================================================================

export function PostEmbedCompact({
  commit,
  locale,
}: {
  commit: PostCommit;
  locale: Locale;
}) {
  const title = localize(commit.title, locale);
  const date = formatCommitDate(commit, locale);

  return (
    <div className="space-y-1 min-w-0">
      <div className="text-sm text-foreground truncate">{title}</div>
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
        {commit.publication.name}
        {" · "}
        {date}
      </div>
    </div>
  );
}
