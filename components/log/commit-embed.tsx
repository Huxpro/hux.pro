"use client";

/**
 * CommitEmbed - Unified commit display component
 *
 * Dispatches to type-specific embed components based on commit.type.
 * Can be used standalone in MDX or within the LogTimeline.
 *
 * @see components/log/embeds/ - Individual embed components
 */

import { cn } from "@/lib/utils";
import type { Commit } from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import { commitIcons } from "./icons";
import {
  ProjectEmbed,
  TalkEmbed,
  PostEmbed,
  RoleEmbed,
  SocialEmbed,
  ProjectEmbedCompact,
  TalkEmbedCompact,
  PostEmbedCompact,
  RoleEmbedCompact,
  SocialEmbedCompact,
} from "./embeds";

// =============================================================================
// Types
// =============================================================================

export interface CommitEmbedProps {
  /** The commit data to display */
  commit: Commit;
  /** Display locale for i18n */
  locale?: Locale;
  /** Render compact embed variant (for stacks/widgets) */
  compact?: boolean;
  /** Whether to start in expanded state */
  defaultExpanded?: boolean;
  /** Optional className for custom styling */
  className?: string;
  /** Show the type icon on the left (for timeline context) */
  showIcon?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export function CommitEmbed({
  commit,
  locale = "en",
  compact = false,
  defaultExpanded = false,
  className,
  showIcon = true,
}: CommitEmbedProps) {
  const Icon = commitIcons[commit.type];

  // Dispatch to type-specific embed
  const content = (() => {
    switch (commit.type) {
      case "project":
        return compact ? (
          <ProjectEmbedCompact commit={commit} locale={locale} />
        ) : (
          <ProjectEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "talk":
        return compact ? (
          <TalkEmbedCompact commit={commit} locale={locale} />
        ) : (
          <TalkEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "post":
        return compact ? (
          <PostEmbedCompact commit={commit} locale={locale} />
        ) : (
          <PostEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "role":
        return compact ? (
          <RoleEmbedCompact commit={commit} locale={locale} />
        ) : (
          <RoleEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "social":
        return compact ? (
          <SocialEmbedCompact commit={commit} locale={locale} />
        ) : (
          <SocialEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div className={cn("group relative", className)}>
      {/* Type icon (timeline context only) */}
      {showIcon && (
        <div className="absolute left-0 top-4 z-10 w-6 h-6 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}

      {/* Content area */}
      <div
        className={cn(
          // Timeline mode: offset for icon, negative margin for tighter spacing
          showIcon && "ml-6 -my-2",
          // Shared styles
          !compact && "p-4 rounded-lg transition-colors duration-200 hover:bg-muted/10"
        )}
      >
        {content}
      </div>
    </div>
  );
}

// =============================================================================
// Legacy Export
// =============================================================================

/**
 * TimelineItem - Wrapper for LogTimeline compatibility
 */
export function TimelineItem({
  commit,
  locale,
}: {
  commit: Commit;
  locale: Locale;
  isFirst?: boolean;
}) {
  return <CommitEmbed commit={commit} locale={locale} showIcon={true} />;
}
