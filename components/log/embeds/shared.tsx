"use client";

/**
 * Shared UI primitives for commit embeds.
 * These components are used across all embed types.
 */

import { cn } from "@/lib/utils";
import type { Commit } from "@/lib/log";
import { getCommitThumbnail, localize } from "@/lib/log";
import type { Locale } from "@/lib/i18n";
import {
  ChevronDown,
  ExternalLink,
  Github,
  Globe,
  Instagram,
  MessageCircle,
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
    case "file":
      return <FileText className="w-3 h-3" />;
    default:
      return <ExternalLink className="w-3 h-3" />;
  }
}

// =============================================================================
// Title Row
// =============================================================================

interface TitleRowProps {
  title: string;
  url?: string;
  hasDetails?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function TitleRow({
  title,
  url,
  hasDetails = false,
  isExpanded = false,
  onToggle,
}: TitleRowProps) {
  return (
    <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline decoration-1 underline-offset-4"
          onClick={(e) => e.stopPropagation()}
        >
          {title}
        </a>
      ) : (
        <span>{title}</span>
      )}
      {hasDetails && onToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-0.5 -m-0.5 hover:bg-muted/30 rounded transition-colors"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      )}
    </h3>
  );
}

// =============================================================================
// Links Row
// =============================================================================

interface LinksRowProps {
  links: { url: string; label: string; icon?: string }[];
  className?: string;
}

export function LinksRow({ links, className }: LinksRowProps) {
  if (links.length === 0) return null;

  return (
    <div
      className={cn("flex items-center gap-3 flex-wrap", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1 text-xs text-muted-foreground/50 transition-colors",
            link.icon === "youtube" || link.icon === "video"
              ? "hover:text-red-500"
              : "hover:text-foreground"
          )}
        >
          <LinkIcon icon={link.icon} />
          <span>{link.label}</span>
        </a>
      ))}
    </div>
  );
}

// =============================================================================
// Meta Row
// =============================================================================

interface MetaRowProps {
  date: string;
  meta?: string;
  className?: string;
}

export function MetaRow({ date, meta, className }: MetaRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wide",
        className
      )}
    >
      {meta && (
        <>
          <span>{meta}</span>
          <span>·</span>
        </>
      )}
      <span>{date}</span>
    </div>
  );
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
        "text-xs text-muted-foreground/60 leading-relaxed",
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
        "text-xs italic text-muted-foreground/30 leading-relaxed",
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
          className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground/40"
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
        <span key={item.label} className="text-xs font-mono text-muted-foreground/40">
          {item.value} {item.label}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// Expanded Content Wrapper
// =============================================================================

interface ExpandedContentProps {
  isExpanded: boolean;
  children: React.ReactNode;
}

export function ExpandedContent({ isExpanded, children }: ExpandedContentProps) {
  if (!isExpanded) return null;

  return (
    <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-150 space-y-1.5">
      {children}
    </div>
  );
}

// =============================================================================
// Commit Cursor Preview (for magnetic cursor)
// =============================================================================

interface CommitCursorPreviewProps {
  commit: Commit;
  locale: Locale;
}

/**
 * Renders cursor-following preview content for a commit.
 * Shows thumbnail when available, otherwise a text summary.
 * Returns null if there's nothing meaningful to preview.
 */
export function CommitCursorPreview({ commit, locale }: CommitCursorPreviewProps) {
  const thumbnail = getCommitThumbnail(commit);
  const description = localize(commit.description, locale);

  if (thumbnail) {
    return (
      <div className="space-y-2">
        <img
          src={thumbnail}
          alt=""
          className="w-48 aspect-video object-cover rounded"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src.includes("maxresdefault")) {
              target.src = target.src.replace("maxresdefault", "hqdefault");
            }
          }}
        />
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed max-w-[12rem]">
          {description}
        </p>
      </div>
    );
  }

  // Text-only preview for commits without thumbnails
  return (
    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed max-w-[14rem]">
      {description}
    </p>
  );
}
