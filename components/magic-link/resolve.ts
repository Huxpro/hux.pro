import { detectMediaKind, detectVideoPlatform } from "@/lib/media-kind";
import badgeIconsJson from "@/content/badge-icons.json";
import badgeConfigJson from "@/content/badges.json";
import ogSnapshotJson from "@/content/og-snapshot.json";
import type { AppIconSnapshot, AppIconSnapshotEntry, AppLink } from "@/lib/app-icon-core";
import { APPS_BY_ID, APP_ICONS } from "@/lib/apps";
import { badgeSiteUrl, siteKey, type BadgeConfig } from "@/lib/badge-site";
import type { Locale } from "@/lib/i18n";
import {
  computeCommitHash,
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
import type { AttachmentSet } from "@/systems/attachments/lib/types";
import { isInternalLink } from "@/systems/attachments/lib/policy";
import { isWritingLink } from "@/components/log/media/media-mark";
import { attachmentSetFor } from "@/systems/attachments/lib/set";

// =============================================================================
// Magic-link resolution — from what an author writes to what a link summons.
//
// A magic link names a *summonable*: a thing on this site that has a peek
// (what it shows under the pointer) and a drawer (what stands in for the peek
// on a phone), the same ones wherever it is summoned from. What it names:
//
//   commit="lynx-framework"   a commit, whole — a /works row: its peek, and
//                             the attachment drawer paging through all of
//                             its media; a press goes to its row on /works.
//   commit="…" item={1}       one of its media alone — a /works cover: its
//                             peek, a drawer of just it, and its home (the
//                             in-app browser, the stage, the router).
//   role="alitrip-engineer"   a role — a range under an identity in
//   identity="alibaba"        content/log.json — as a /works role row: the
//                             identity's profile as the peek, its card as
//                             the drawer, its row on /works as its home.
//   post="dreamer"            a post, as its /writing row: its peek, and the
//                             same in the drawer. Resolved on the server
//                             (server.tsx), which alone can read the post;
//                             it arrives here as `media`.
//   app="lynx-flappy-bird"    an app in content/apps.json; opens in a window,
//                             Lynx runtime or web, as the home screen does.
//   href="…"                  any URL; its kind is read off it the way
//                             <Media /> reads it (`as` forces one): a video,
//                             a deck, an image, a social post, a page, or one
//                             of this site's own paths (server.tsx gives the
//                             site's sections a card of their own).
//
// This module is data only: it resolves props to a target, a label, an icon
// and a real href (for ⌘-click, middle-click and no JavaScript). The
// component (magic-link.tsx) does the peeking and the opening.
// =============================================================================

type Snapshot = Record<string, MediaPreview & { siteName?: string }>;
const SNAPSHOT = ogSnapshotJson as unknown as Snapshot;

export type MagicLinkKind =
  | "identity"
  | "app"
  | "web"
  | "writing"
  | "route"
  | "video"
  | "slides"
  | "image"
  | "social";

export type MagicLinkTarget =
  | {
      type: "media";
      set: AttachmentSet;
      media: Media;
      /**
       * The whole commit, when the link names one (`commit=` without
       * `item`): it peeks as its /works row and its drawer pages through
       * every attachment. Absent for a single media item.
       */
      commit?: Commit;
    }
  | { type: "identity"; identityId: string; roleId?: string }
  | { type: "app"; app: AppLink };

export type BadgeIcon =
  | { type: "image"; src: string; fill: boolean }
  | { type: "monogram"; letter: string; color?: string }
  | { type: "glyph" };

export interface ResolvedMagicLink {
  target: MagicLinkTarget | null;
  kind: MagicLinkKind;
  label: string;
  /** The real address — what a modified click and a crawler follow. */
  href: string;
  icon: BadgeIcon;
  /** What the badge is, for its tooltip: the title, the domain. */
  title: string;
}

export interface MagicLinkSpec {
  commit?: string;
  item?: number;
  /** A role: a range id under `identities` in content/log.json. */
  role?: string;
  /** An identity id, for the identity as a whole (its latest role leads). */
  identity?: string;
  /** Resolved on the server (server.tsx): a post, a section of this site. */
  media?: Media;
  app?: string;
  href?: string;
  as?: MediaKind;
  icon?: string;
  title?: string;
}

/** An href as a media item, the way <Media /> reads a URL. */
export function mediaFromHref(
  url: string,
  as?: MediaKind,
  title?: string,
): Media {
  const platform = detectVideoPlatform(url);
  const kind: MediaKind = as ?? detectMediaKind(url);
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
      // The page's card, as the snapshot read it (`pnpm og:snapshot` crawls
      // the hrefs written in magic links too): its title, description and
      // image for the peek, and whether it lets itself be framed — a page
      // that refuses goes to a tab rather than a window of refusal.
      const snap = BADGE_CONFIG.previews?.[url] ?? SNAPSHOT[url];
      return {
        kind: "link",
        url,
        present: "card",
        ...(snap
          ? {
              preview: {
                title: snap.title,
                description: snap.description,
                image: snap.image,
                frame: snap.frame,
              },
            }
          : {}),
      };
    }
  }
}

function kindOf(media: Media): MagicLinkKind {
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
      if (isWritingLink(media)) return "writing";
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
function siteIcon(spec: MagicLinkSpec): BadgeIcon | null {
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

/**
 * The mark a project wears on its row (components/log/project-mark.tsx):
 * the official icon of the site that stands for it — the same one its
 * `<Badge>` wears in the About, by the same rule (lib/badge-site.ts:
 * content/badges.json names the site, else the host of its first external
 * attachment) — or its monogram in its chapter's colour when the site has
 * none. Resolved against the commit itself rather than the site's log, so
 * the editor's unsaved copy and a widget's slice get the same answer.
 */
export function commitMark(commit: Commit, locale: Locale): BadgeIcon {
  const url = badgeSiteUrl({ commit: commit.id }, [commit], BADGE_CONFIG);
  const key = url && siteKey(url);
  return (
    (key ? fromEntry(BADGE_ICONS[key]) : null) ??
    monogram(localize(commit.title, locale), tagColor(commit))
  );
}

export function resolveMagicLink(spec: MagicLinkSpec, locale: Locale): ResolvedMagicLink | null {
  // Something the server resolved: a post, a section of this site.
  if (spec.media) {
    const media = spec.media;
    const preview =
      media.kind === "link" ? (media.previews?.[locale] ?? media.preview) : undefined;
    const label = spec.title ?? preview?.title ?? labelFor(media, locale);
    const title = preview?.title ?? label;
    return {
      target: {
        type: "media",
        media,
        set: { id: `magic:${media.url}`, title, items: [media] },
      },
      kind: kindOf(media),
      label,
      href: hrefFor(media, locale),
      icon: iconFromProp(spec.icon) ?? SITE_ICON,
      title,
    };
  }

  // A role, or an identity: the /works role row's peek and card.
  if (spec.role || spec.identity) {
    const role = spec.role
      ? LOG.commits.find((c) => c.id === spec.role && c.type === "role")
      : undefined;
    const identityId = role?.identityId ?? spec.identity;
    const identity = identityId ? LOG.identities?.[identityId] : undefined;
    if (!identityId || !identity) return null;
    const label = spec.title ?? localize(identity.company, locale);
    return {
      target: { type: "identity", identityId, roleId: role?.id },
      kind: "identity",
      label,
      // Its home is its row on /works; the identity as a whole, the page.
      href: role ? `/works#${computeCommitHash(role.id)}` : "/works",
      icon:
        iconFromProp(spec.icon) ??
        siteIcon(spec) ??
        monogram(label, identity.accentColor ?? (role && tagColor(role))),
      title: label,
    };
  }

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

  // A commit, by id: the whole commit — a project, a talk — or, with
  // `item`, one of its media alone.
  if (spec.commit) {
    const commit = LOG.commits.find((c) => c.id === spec.commit);
    if (!commit) return null;
    const title = localize(commit.title, locale);
    const label = spec.title ?? title;
    const icon =
      iconFromProp(spec.icon) ?? siteIcon(spec) ?? monogram(label, tagColor(commit));
    const whole = spec.item === undefined;
    const set = whole ? attachmentSetFor(commit, locale) : null;
    const media = commit.media?.[spec.item ?? 0];
    if (!media) {
      return {
        target: null,
        kind: "route",
        label,
        href: `/works#${computeCommitHash(commit.id)}`,
        icon,
        title,
      };
    }
    return {
      target: {
        type: "media",
        media,
        // The commit's own set, so the drawer pages through all of it, as
        // a /works cover's does; one item stands alone.
        set: set ?? { id: `magic:${commit.id}#${spec.item}`, title, items: [media] },
        ...(whole ? { commit } : {}),
      },
      kind: kindOf(media),
      label,
      href: whole ? `/works#${computeCommitHash(commit.id)}` : hrefFor(media, locale),
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
        set: { id: `magic:${spec.href}`, title: label, items: [media] },
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
