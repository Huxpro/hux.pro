"use client";

import { useState } from "react";
import type { ProjectCommit } from "@/lib/log";
import {
  localize,
  localizeOptional,
  formatCommitDate,
  isLinkMedia,
} from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import {
  TitleRow,
  LinksRow,
  Description,
  Commentary,
  TagBadges,
  Stats,
  ExpandedContent,
} from "./shared";
import { MediaRenderer } from "../media";

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

  const media = commit.media ?? [];
  const links = media.filter(isLinkMedia);
  const nonLinkMedia = media.filter((m) => !isLinkMedia(m));
  const hasDetails = !!(
    commentary ||
    (commit.tags && commit.tags.length > 0) ||
    commit.stats
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <TitleRow
            title={title}
            url={links[0]?.url}
            hasDetails={hasDetails}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
          />
          <LinksRow links={links.map(m => ({ url: m.url, label: m.label || "", icon: m.icon }))} />
        </div>

        <Description text={description} isExpanded={isExpanded} />

        <ExpandedContent isExpanded={isExpanded}>
          {commit.tags && commit.tags.length > 0 && <TagBadges items={commit.tags} />}
          {commit.stats && <Stats {...commit.stats} />}
          {commentary && <Commentary text={commentary} />}
        </ExpandedContent>
      </div>

      {nonLinkMedia.length > 0 && (
        <MediaRenderer
          media={nonLinkMedia}
          layout="stack"
          size="default"
        />
      )}
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
