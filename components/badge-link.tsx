"use client";

/**
 * Badge link — a project chip that opens in the site's own surfaces.
 *
 * Usable in MDX and in React. A plain click follows the attachment policy's
 * native home: a page in the in-app browser, a recording or a deck on the
 * theater stage, an image or a social widget in the attachment surface.
 * Modified clicks keep the real href.
 */

import { LinkIcon } from "@/components/log/embeds/shared";
import type { Media, SocialEmbedPlatform, VideoPlatform } from "@/lib/log";
import { cn } from "@/lib/utils";
import { useOptionalAbout } from "@/systems/about/provider";
import { useOptionalAttachments } from "@/systems/attachments";
import type { MouseEvent, ReactNode } from "react";

export interface BadgeLinkProps {
  /** Destination. `href` is the MDX-friendly alias of `url`. */
  url?: string;
  href?: string;
  /** Media kind. Omitted, a video host becomes a recording and anything else a page. */
  kind?: "link" | "video" | "slides" | "image" | "social" | "social-embed";
  /** Video platform. Read from the URL when omitted. */
  platform?: string;
  /** Cover for a deck or a still. */
  thumbnail?: string;
  /** Accessible title for a deck. */
  title?: string;
  /** Alt text for an image. */
  alt?: string;
  /** Pill label. Falls back to the children, then the host. */
  label?: string;
  /** Icon key — the same vocabulary as a commit pill (`github`, `globe`, …). */
  icon?: string;
  children?: ReactNode;
  className?: string;
}

export function BadgeLink({
  url,
  href,
  kind,
  platform,
  thumbnail,
  title,
  alt,
  label,
  icon,
  children,
  className,
}: BadgeLinkProps) {
  const attachments = useOptionalAttachments();
  const about = useOptionalAbout();
  const target = url || href || "";
  const text = label || (typeof children === "string" ? children : "") || hostOf(target);
  const media = target ? mediaFromBadge({ url: target, kind, platform, thumbnail, title, alt }) : null;
  const glyph = icon || iconFor(media);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!media || !attachments) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (about?.open) about.dismiss();
    attachments.act(
      {
        id: `badge:${target}`,
        title: text || title || hostOf(target),
        items: [media],
      },
      0,
    );
  };

  return (
    <a
      href={target || undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 align-middle",
        "rounded-md border border-border bg-muted px-2 py-0.5",
        "text-xs text-foreground no-underline",
        "transition-colors duration-200 hover:bg-accent",
        className,
      )}
    >
      <LinkIcon icon={glyph} />
      <span>{children ?? text}</span>
    </a>
  );
}

function mediaFromBadge(input: {
  url: string;
  kind?: BadgeLinkProps["kind"];
  platform?: string;
  thumbnail?: string;
  title?: string;
  alt?: string;
}): Media {
  const kind = input.kind ?? inferKind(input.url);
  if (kind === "video") {
    return {
      kind: "video",
      url: input.url,
      platform: videoPlatform(input.platform, input.url),
      thumbnail: input.thumbnail,
    };
  }
  if (kind === "slides") {
    return {
      kind: "slides",
      url: input.url,
      thumbnail: input.thumbnail,
      title: input.title,
    };
  }
  if (kind === "image") {
    return { kind: "image", url: input.url, alt: input.alt || input.title };
  }
  if (kind === "social" || kind === "social-embed") {
    return {
      kind: "social-embed",
      url: input.url,
      platform: socialPlatform(input.platform, input.url),
    };
  }
  return { kind: "link", url: input.url, present: "card" };
}

function inferKind(url: string): NonNullable<BadgeLinkProps["kind"]> {
  return knownVideoPlatform(undefined, url) ? "video" : "link";
}

function videoPlatform(explicit: string | undefined, url: string): VideoPlatform {
  return knownVideoPlatform(explicit, url) ?? "youtube";
}

function knownVideoPlatform(explicit: string | undefined, url: string): VideoPlatform | null {
  const value = (explicit || "").toLowerCase();
  if (value === "youtube" || value === "bilibili" || value === "vimeo") return value;
  const host = hostOf(url);
  if (host.includes("youtu")) return "youtube";
  if (host.includes("bilibili")) return "bilibili";
  if (host.includes("vimeo")) return "vimeo";
  return null;
}

function socialPlatform(explicit: string | undefined, url: string): SocialEmbedPlatform | undefined {
  const value = (explicit || "").toLowerCase();
  if (value === "x" || value === "twitter" || value === "instagram" || value === "tiktok") {
    return value === "twitter" ? "x" : value;
  }
  const host = hostOf(url);
  if (host.includes("instagram")) return "instagram";
  if (host.includes("tiktok")) return "tiktok";
  if (host === "x.com" || host.includes("twitter")) return "x";
  return undefined;
}

function iconFor(media: Media | null): string {
  if (!media) return "globe";
  switch (media.kind) {
    case "video":
      return media.platform;
    case "slides":
      return "slides";
    case "image":
      return "image";
    case "social-embed":
      return media.platform || "x";
    default:
      return hostOf(media.url).includes("github") ? "github" : "globe";
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
