"use client";

/**
 * WorkItemEmbed - Unified work item display component
 *
 * Dispatches to type-specific embed components based on item.type.
 * Can be used standalone in MDX or within the EraTimeline.
 *
 * @see components/eras/embeds/ - Individual embed components
 */

import { cn } from "@/lib/utils";
import type { WorkItem } from "@/lib/eras";
import type { Locale } from "@/lib/i18n";
import { itemIcons } from "./icons";
import {
  ProjectEmbed,
  TalkEmbed,
  PostEmbed,
  RoleEmbed,
  SocialEmbed,
} from "./embeds";

// =============================================================================
// Types
// =============================================================================

export interface WorkItemEmbedProps {
  /** The work item data to display */
  item: WorkItem;
  /** Display locale for i18n */
  locale?: Locale;
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

export function WorkItemEmbed({
  item,
  locale = "en",
  defaultExpanded = false,
  className,
  showIcon = true,
}: WorkItemEmbedProps) {
  const Icon = itemIcons[item.type];

  // Dispatch to type-specific embed
  const content = (() => {
    switch (item.type) {
      case "project":
        return (
          <ProjectEmbed
            item={item}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "talk":
        return (
          <TalkEmbed
            item={item}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "post":
        return (
          <PostEmbed
            item={item}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "role":
        return (
          <RoleEmbed
            item={item}
            locale={locale}
            defaultExpanded={defaultExpanded}
          />
        );
      case "social":
        return (
          <SocialEmbed
            item={item}
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
          "p-4 rounded-lg transition-colors duration-200",
          "hover:bg-muted/10"
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
 * TimelineItem - Legacy wrapper for EraTimeline compatibility
 * @deprecated Use WorkItemEmbed directly for new code
 */
export function TimelineItem({
  item,
  locale,
}: {
  item: WorkItem;
  locale: Locale;
  isFirst?: boolean;
}) {
  return <WorkItemEmbed item={item} locale={locale} showIcon={true} />;
}
