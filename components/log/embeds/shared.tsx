"use client";

/**
 * Shared UI primitives for commit rendering.
 * Used by TimelineCommit and CommitCompact.
 */

import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Github,
  Globe,
  Instagram,
  MessageCircle,
  Presentation,
  Twitter,
  Youtube,
  FileText,
} from "lucide-react";

// =============================================================================
// Link Icon
// =============================================================================

export function LinkIcon({ icon }: { icon?: string }) {
  switch (icon?.toLowerCase()) {
    case "github":
      return <Github className="w-3 h-3" />;
    case "globe":
    case "website":
      return <Globe className="w-3 h-3" />;
    case "youtube":
      return <Youtube className="w-3 h-3" />;
    case "bilibili":
    case "vimeo":
    case "video":
      return <Youtube className="w-3 h-3" />;
    case "x":
    case "twitter":
      return <Twitter className="w-3 h-3" />;
    case "instagram":
      return <Instagram className="w-3 h-3" />;
    case "tiktok":
      return <MessageCircle className="w-3 h-3" />;
    case "slides":
      return <Presentation className="w-3 h-3" />;
    case "file":
      return <FileText className="w-3 h-3" />;
    default:
      return <ExternalLink className="w-3 h-3" />;
  }
}

// =============================================================================
// Description
// =============================================================================

interface DescriptionProps {
  text: string;
  isExpanded?: boolean;
  className?: string;
}

export function Description({
  text,
  isExpanded = false,
  className,
}: DescriptionProps) {
  return (
    <p
      className={cn(
        "text-xs text-tertiary-foreground leading-relaxed",
        !isExpanded && "line-clamp-2",
        className
      )}
    >
      {text}
    </p>
  );
}

// =============================================================================
// Commentary Block
// =============================================================================

interface CommentaryProps {
  text: string;
  className?: string;
}

export function Commentary({ text, className }: CommentaryProps) {
  return (
    <p
      className={cn(
        "text-xs italic text-quaternary-foreground leading-relaxed",
        className
      )}
    >
      &ldquo;{text}&rdquo;
    </p>
  );
}

// =============================================================================
// Tag Badges
// =============================================================================

interface TagBadgesProps {
  items: string[];
  className?: string;
}

export function TagBadges({ items, className }: TagBadgesProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}>
      {items.map((tag) => (
        <span
          key={tag}
          className="text-[10px] uppercase tracking-wider font-mono text-quaternary-foreground"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// Stats Display
// =============================================================================

interface StatsProps {
  stars?: number;
  downloads?: string;
  users?: string;
  className?: string;
}

export function Stats({ stars, downloads, users, className }: StatsProps) {
  const items = [
    stars && { label: "Stars", value: stars.toLocaleString() },
    downloads && { label: "Downloads", value: downloads },
    users && { label: "Users", value: users },
  ].filter(Boolean) as { label: string; value: string }[];

  if (items.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {items.map((item) => (
        <span key={item.label} className="text-xs font-mono text-quaternary-foreground">
          {item.value} {item.label}
        </span>
      ))}
    </div>
  );
}
