import badgeIconsJson from "@/content/badge-icons.json";
import badgeConfigJson from "@/content/badges.json";
import ogSnapshotJson from "@/content/og-snapshot.json";
import type { AppIconSnapshot, AppIconSnapshotEntry, AppLink } from "@/lib/app-icon-core";
import { APPS_BY_ID, APP_ICONS } from "@/lib/apps";
import { badgeSiteUrl, siteKey, type BadgeConfig } from "@/lib/badge-site";
import type { Locale } from "@/lib/i18n";
import {
  localize,
  type Commit,
  type Media,
  type MediaKind,
  type MediaPreview,
} from "@/lib/log";
import { LOG } from "@/lib/log-client";
import {
  detectSocialEmbedPlatform,
  getDomainLabel,
  SOCIAL_PLATFORM_LABEL,
} from "@/lib/og-core";
import { isPlayableSlidesUrl } from "@/lib/slides";
import type { AttachmentSet } from "@/systems/attachments/lib/types";
import { isInternalLink } from "@/systems/attachments/lib/policy";

// =============================================================================
// Badge resolution — from what an author writes to what a badge opens.
//
// A badge names a thing three ways, and all three land on the site's own
// homes for it, through the attachment policy (systems/attachments):
//
//   commit="lynx-framework"   a commit in content/log.json; opens its media
//                             (`item`, the first by default) — a page in the
//                             in-app browser, a recording or a deck on the
//                             stage, a post on its route.
//   app="lynx-flappy-bird"    an app in content/apps.json; opens in a window,
//                             Lynx runtime or web, as the home screen does.
//   href="…"                  any URL; its kind is read off it the way
//                             <Media /> reads it (`as` forces one): a video,
//                             a deck, an image, a social post, a page, or one
//                             of this site's own paths.
//
// This module is data only: it resolves props to a target, a label, an icon
// and a real href (for ⌘-click, middle-click and no JavaScript). The
// component (badge-link.tsx) does the opening.
// =============================================================================

type Snapshot = Record<string, MediaPreview & { siteName?: string }>;
const SNAPSHOT = ogSnapshotJson as unknown as Snapshot;

export type BadgeKind =
  | "app"
  | "web"
  | "writing"
  | "route"
  | "video"
  | "slides"
  | "image"
  | "social";

export type BadgeTarget =
  | { type: "media"; set: AttachmentSet; media: Media }
  | { type: "app"; app: AppLink };

export type BadgeIcon =
  | { type: "image"; src: string; fill: boolean }
  | { type: "monogram"; letter: string; color?: string }
  | { type: "glyph" };

export interface ResolvedBadge {
  target: BadgeTarget | null;
  kind: BadgeKind;
  label: string;
  /** The real address — what a modified click and a crawler follow. */
  href: string;
  icon: BadgeIcon;
  /** What the badge is, for its tooltip: the title, the domain. */
  title: string;
}

export interface BadgeSpec {
  commit?: string;
  item?: number;
  app?: string;
  href?: string;
  as?: MediaKind;
  icon?: string;
  title?: string;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;
const VIDEO_HOSTS: [RegExp, "youtube" | "bilibili" | "vimeo"][] = [
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)bilibili\.com$/, "bilibili"],
  [/(^|\.)vimeo\.com$/, "vimeo"],
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function videoPlatformOf(url: string) {
  const host = hostOf(url);
  if (!host) return null;
  return VIDEO_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
}

/** An href as a media item, the way <Media /> reads a URL. */
export function mediaFromHref(
  url: string,
  as?: MediaKind,
  title?: string,
): Media {
  const platform = videoPlatformOf(url);
  const kind: MediaKind =
    as ??
    (platform
      ? "video"
      : detectSocialEmbedPlatform(url)
        ? "social-embed"
        : isPlayableSlidesUrl(url)
          ? "slides"
          : IMAGE_EXTENSIONS.test(url)
            ? "image"
            : "link");
  switch (kind) {
    case "video":
      return { kind, url, platform: platform ?? "youtube" };
    case "slides":
      return { kind, url, title };
    case "image":
      return { kind, url, alt: title };
    case "social-embed":
      return { kind, url };
    case "link":
    default: {
      // Whether the page lets itself be framed was read at snapshot time; a
      // page that refuses goes to a tab rather than a window of refusal.
      const frame = SNAPSHOT[url]?.frame;
      return {
        kind: "link",
        url,
        present: "pill",
        ...(frame ? { preview: { frame } } : {}),
      };
    }
  }
}

function kindOf(media: Media): BadgeKind {
  switch (media.kind) {
    case "video":
      return "video";
    case "slides":
      return "slides";
    case "image":
      return "image";
    case "social-embed":
      return "social";
    case "link":
      if (media.internal || media.url.startsWith("/writing")) return "writing";
      return isInternalLink(media) ? "route" : "web";
  }
}

const BADGE_ICONS = badgeIconsJson as AppIconSnapshot;
const BADGE_CONFIG = badgeConfigJson as BadgeConfig;

/** This site's own icon — what a path on it wears (the generative app icon). */
const SITE_ICON: BadgeIcon = { type: "image", src: "/icons/icon.svg", fill: true };

/**
 * An icon drawn for a home screen (a manifest icon, an apple-touch-icon, an
 * app's own art) is opaque and fills its tile; a favicon is a glyph, often on
 * nothing, and sits on a white plate — the way a home screen shows one.
 */
function fromEntry(entry: AppIconSnapshotEntry | undefined): BadgeIcon | null {
  if (!entry?.file) return null;
  const homeScreen = entry.source === "manifest" || entry.source === "apple-touch-icon";
  const big = !!entry.width && entry.width === entry.height && entry.width >= 160;
  return { type: "image", src: entry.file, fill: homeScreen || big };
}

/** The official icon of the site a badge stands for (content/badge-icons.json). */
function siteIcon(spec: BadgeSpec): BadgeIcon | null {
  const url = badgeSiteUrl(spec, LOG.commits, BADGE_CONFIG);
  const key = url && siteKey(url);
  return key ? fromEntry(BADGE_ICONS[key]) : null;
}

function appIcon(app: AppLink): BadgeIcon | null {
  const entry = APP_ICONS[app.id];
  if (!entry) return app.icon ? { type: "image", src: app.icon, fill: true } : null;
  return fromEntry({ ...entry, file: app.icon ?? entry.file });
}

function iconFromProp(icon: string | undefined): BadgeIcon | null {
  if (!icon) return null;
  if (icon.startsWith("/") || /^https?:/.test(icon)) {
    return { type: "image", src: icon, fill: true };
  }
  if (APPS_BY_ID.has(icon)) return appIcon(APPS_BY_ID.get(icon)!);
  return null;
}

function tagColor(commit: Commit): string | undefined {
  return LOG.tags.find((t) => t.id === commit.tagId)?.accentColor;
}

function monogram(label: string, color?: string): BadgeIcon {
  const letter = Array.from(label.trim())[0]?.toUpperCase() ?? "·";
  return { type: "monogram", letter, color };
}

function labelFor(media: Media, locale: Locale): string {
  if (media.kind === "social-embed") {
    const platform = detectSocialEmbedPlatform(media.url);
    return platform ? SOCIAL_PLATFORM_LABEL[platform] : getDomainLabel(media.url);
  }
  if (media.kind === "link") {
    const preview = media.previews?.[locale] ?? media.preview;
    if (media.label) return media.label;
    if (media.url.startsWith("/")) return preview?.title ?? media.url;
  }
  return getDomainLabel(media.url).replace(/^www\./, "");
}

/** The address a badge carries for the browser itself. */
function hrefFor(media: Media, locale: Locale): string {
  if (media.kind === "link") {
    if (media.internal) return media.internal.urls[locale] ?? media.url;
    return media.urls?.[locale] ?? media.url;
  }
  return media.url;
}

export function resolveBadge(spec: BadgeSpec, locale: Locale): ResolvedBadge | null {
  // An app, by id.
  if (spec.app) {
    const app = APPS_BY_ID.get(spec.app);
    if (!app) return null;
    const label =
      spec.title ?? (locale === "zh" && app.titleZh ? app.titleZh : app.title);
    return {
      target: { type: "app", app },
      kind: "app",
      label,
      href: app.url,
      icon: iconFromProp(spec.icon) ?? appIcon(app) ?? monogram(label),
      title: label,
    };
  }

  // A commit, by id: one of its media.
  if (spec.commit) {
    const commit = LOG.commits.find((c) => c.id === spec.commit);
    if (!commit) return null;
    const title = localize(commit.title, locale);
    const media = commit.media?.[spec.item ?? 0];
    const label = spec.title ?? title;
    const icon =
      iconFromProp(spec.icon) ?? siteIcon(spec) ?? monogram(label, tagColor(commit));
    if (!media) {
      return {
        target: null,
        kind: "route",
        label,
        href: "/works",
        icon,
        title,
      };
    }
    return {
      target: {
        type: "media",
        media,
        set: { id: `badge:${commit.id}`, title, items: [media] },
      },
      kind: kindOf(media),
      label,
      href: hrefFor(media, locale),
      icon,
      title,
    };
  }

  // Any URL.
  if (spec.href) {
    const media = mediaFromHref(spec.href, spec.as, spec.title);
    const label = spec.title ?? labelFor(media, locale);
    // A path on this site wears this site's icon, and an image wears itself.
    const icon =
      iconFromProp(spec.icon) ??
      (media.url.startsWith("/") && media.kind !== "image" ? SITE_ICON : null) ??
      (media.kind === "image" ? { type: "image" as const, src: media.url, fill: true } : null) ??
      siteIcon(spec) ?? { type: "glyph" as const };
    return {
      target: {
        type: "media",
        media,
        set: { id: `badge:${spec.href}`, title: label, items: [media] },
      },
      kind: kindOf(media),
      label,
      href: hrefFor(media, locale),
      icon,
      title: media.url.startsWith("/") ? label : getDomainLabel(media.url),
    };
  }

  return null;
}
