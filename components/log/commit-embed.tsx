"use client";

/**
 * CommitEmbed - Unified commit display component
 *
 * Dispatches to type-specific embed components based on commit.type.
 * Supports three display variants for different contexts.
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

/**
 * Display variants for CommitEmbed:
 * - "timeline": Shows icon, timeline-optimized spacing, used in /works
 * - "card": Standalone in prose/MDX, wrapped with border/bg frame
 * - "bare": Minimal frameless version for use inside stacks/widgets
 */
export type CommitEmbedVariant = "timeline" | "card" | "bare";

export interface CommitEmbedProps {
  /** The commit data to display */
  commit: Commit;
  /** Display locale for i18n */
  locale?: Locale;
  /**
   * Display variant:
   * - "timeline": Shows icon, for /works timeline
   * - "card": Standalone with border/bg frame, for MDX (default)
   * - "bare": Minimal frameless, for use inside stacks/widgets
   */
  variant?: CommitEmbedVariant;
  /** Whether to start in expanded state */
  defaultExpanded?: boolean;
  /** Optional className for custom styling */
  className?: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function CommitEmbed({
  commit,
  locale = "en",
  variant = "card",
  defaultExpanded = false,
  className,
}: CommitEmbedProps) {
  const Icon = commitIcons[commit.type];

  // Derive behavior from variant
  const isBare = variant === "bare";
  const isTimeline = variant === "timeline";
  const isCard = variant === "card";

  // Dispatch to type-specific embed
  const content = (() => {
    switch (commit.type) {
      case "project":
        return isBare ? (
          <ProjectEmbedCompact commit={commit} locale={locale} />
        ) : (
          <ProjectEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "talk":
        return isBare ? (
          <TalkEmbedCompact commit={commit} locale={locale} />
        ) : (
          <TalkEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "post":
        return isBare ? (
          <PostEmbedCompact commit={commit} locale={locale} />
        ) : (
          <PostEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "role":
        return isBare ? (
          <RoleEmbedCompact commit={commit} locale={locale} />
        ) : (
          <RoleEmbed
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "social":
        return isBare ? (
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

  // Card variant: self-contained with border/bg frame
  if (isCard) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/5 overflow-hidden",
          "p-4",
          className
        )}
      >
        {content}
      </div>
    );
  }

  // Bare variant: minimal, no frame, for use inside containers
  if (isBare) {
    return <div className={className}>{content}</div>;
  }

  // Timeline variant: shows icon, timeline-optimized spacing
  return (
    <div className={cn("group relative", className)}>
      {/* Type icon */}
      <div className="absolute left-0 top-4 z-10 w-6 h-6 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>

      {/* Content area with icon offset */}
      <div
        className={cn(
          "ml-6 -my-2",
          "p-4 rounded-lg transition-colors duration-200 hover:bg-muted/10"
        )}
      >
        {content}
      </div>
    </div>
  );
}
