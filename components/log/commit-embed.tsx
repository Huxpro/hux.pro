"use client";

/**
 * Commit Components
 *
 * Unified commit display system. Commits are work items (project, talk, post, etc.)
 * that can have attached Media for external content.
 *
 * Terminology:
 * - Commit: A work item (ProjectCommit, TalkCommit, etc.)
 * - Media: Attached external content (video, embed, link, image)
 *
 * @see components/log/embeds/ - Individual commit type components
 * @see components/log/media/ - Media rendering components
 */

import type { Locale } from "@/lib/i18n";
import type { Commit as CommitData } from "@/lib/log";
import { cn } from "@/lib/utils";
import {
  Post,
  PostCompact,
  Project,
  ProjectCompact,
  Role,
  RoleCompact,
  Social,
  SocialCompact,
  Talk,
  TalkCompact,
} from "./embeds";
import { commitIcons } from "./icons";

// =============================================================================
// Types
// =============================================================================

/**
 * Display variants for Commit:
 * - "timeline": Shows icon, timeline-optimized spacing, used in /works
 * - "card": Standalone in prose/MDX, wrapped with border/bg frame
 * - "bare": Minimal frameless version for use inside stacks/widgets
 */
export type CommitVariant = "timeline" | "card" | "bare";

export interface CommitProps {
  /** The commit data to display */
  commit: CommitData;
  /** Display locale for i18n */
  locale?: Locale;
  /**
   * Display variant:
   * - "timeline": Shows icon, for /works timeline
   * - "card": Standalone with border/bg frame, for MDX (default)
   * - "bare": Minimal frameless, for use inside stacks/widgets
   */
  variant?: CommitVariant;
  /** Whether to start in expanded state */
  defaultExpanded?: boolean;
  /** Optional className for custom styling */
  className?: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function Commit({
  commit,
  locale = "en",
  variant = "card",
  defaultExpanded = false,
  className,
}: CommitProps) {
  const Icon = commitIcons[commit.type];

  // Derive behavior from variant
  const isBare = variant === "bare";
  const isTimeline = variant === "timeline";
  const isCard = variant === "card";

  // Dispatch to type-specific component
  const content = (() => {
    switch (commit.type) {
      case "project":
        return isBare ? (
          <ProjectCompact commit={commit} locale={locale} />
        ) : (
          <Project
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "talk":
        return isBare ? (
          <TalkCompact commit={commit} locale={locale} />
        ) : (
          <Talk
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "post":
        return isBare ? (
          <PostCompact commit={commit} locale={locale} />
        ) : (
          <Post
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "role":
        return isBare ? (
          <RoleCompact commit={commit} locale={locale} />
        ) : (
          <Role
            commit={commit}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "social":
        return isBare ? (
          <SocialCompact commit={commit} locale={locale} />
        ) : (
          <Social
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
          className,
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
          "p-4 rounded-lg transition-colors duration-200 hover:bg-muted/10",
        )}
      >
        {content}
      </div>
    </div>
  );
}

