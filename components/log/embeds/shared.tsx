"use client";

/**
 * Shared UI primitives for commit embeds.
 * These components are used across all embed types.
 */

import { cn } from "@/lib/utils";
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
    <h3 className="text-base font-medium text-foreground flex items-center gap-2">
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
            "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors",
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
        "text-sm text-muted-foreground leading-relaxed",
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
    <div
      className={cn(
        "text-xs font-serif italic text-muted-foreground/80 pl-3 border-l-2 border-muted",
        className
      )}
    >
      "{text}"
    </div>
  );
}

// =============================================================================
// Tech Stack Tags
// =============================================================================

interface TechStackProps {
  items: string[];
  className?: string;
}

export function TechStack({ items, className }: TechStackProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((tech) => (
        <span
          key={tech}
          className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground/70 bg-muted/30 px-1.5 py-0.5 rounded-sm"
        >
          {tech}
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
    <div className={cn("flex items-center gap-4", className)}>
      {items.map((item) => (
        <div key={item.label} className="text-xs text-muted-foreground">
          <span className="font-mono">{item.value}</span>{" "}
          <span className="text-muted-foreground/60">{item.label}</span>
        </div>
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
    <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200 space-y-3">
      {children}
    </div>
  );
}
