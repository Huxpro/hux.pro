"use client";

import type { MouseEvent, ReactNode } from "react";
import {
  ArrowUpRight,
  Globe,
  Image as ImageIcon,
  Play,
  Presentation,
  Quote,
} from "lucide-react";
import { APP_ICONS, APPS_BY_ID } from "@/lib/apps";
import { appTitle, resolveAppIconSrc } from "@/lib/app-icon-core";
import type { Media, MediaKind, VideoPlatform } from "@/lib/log";
import { detectSocialEmbedPlatform } from "@/lib/og-core";
import { isPlayableSlidesUrl } from "@/lib/slides";
import { detectVideoPlatform } from "@/components/log/media/video";
import { useOptionalAttachments, linkTarget } from "@/systems/attachments";
import { useOptionalWindows } from "@/systems/windows";
import { useLocale } from "@/services";
import { cn } from "@/lib/utils";
import styles from "./badge-link.module.css";

export interface BadgeLinkProps {
  /** Existing app catalog ID, including Lynx apps and their native runtime. */
  appId?: string;
  /** Pass an existing attachment to preserve its preview, locale URLs, etc. */
  media?: Media;
  /** Simple authoring form. Kind is inferred; `as` overrides detection. */
  href?: string;
  as?: MediaKind;
  platform?: VideoPlatform;
  title?: string;
  icon?: string;
  thumbnail?: string;
  children?: ReactNode;
  className?: string;
  /** Runs only for a primary activation handled inside the site. */
  onLaunch?: () => void;
}

function mediaFor(
  href: string,
  kind?: MediaKind,
  platform?: VideoPlatform,
  thumbnail?: string,
  title?: string,
): Media {
  const video = platform ?? detectVideoPlatform(href);
  const social = detectSocialEmbedPlatform(href) ?? undefined;
  const type =
    kind ??
    (video
      ? "video"
      : social
        ? "social-embed"
        : isPlayableSlidesUrl(href)
          ? "slides"
          : /\.(png|jpe?g|webp|avif|gif|svg)([?#]|$)/i.test(href)
            ? "image"
            : "link");
  switch (type) {
    case "video":
      return video
        ? { kind: "video", url: href, platform: video, thumbnail }
        : { kind: "link", url: href, present: "card" };
    case "slides":
      return { kind: "slides", url: href, title, thumbnail };
    case "social-embed":
      return { kind: "social-embed", url: href, platform: social };
    case "image":
      return { kind: "image", url: href, alt: title };
    default:
      return { kind: "link", url: href, present: "card" };
  }
}

const MARKS = {
  link: Globe,
  video: Play,
  slides: Presentation,
  image: ImageIcon,
  "social-embed": Quote,
};

export function BadgeLink({
  appId,
  media: suppliedMedia,
  href,
  as,
  platform,
  title,
  icon,
  thumbnail,
  children,
  className,
  onLaunch,
}: BadgeLinkProps) {
  const { locale } = useLocale();
  const attachments = useOptionalAttachments();
  const windows = useOptionalWindows();
  const app = appId ? APPS_BY_ID.get(appId) : undefined;
  const url = app?.url ?? suppliedMedia?.url ?? href;
  const label =
    title ??
    (app
      ? appTitle(app, locale)
      : typeof children === "string"
        ? children
        : (url ?? appId ?? "Link"));
  if (!url) return <span className={className}>{children ?? label}</span>;
  const media = suppliedMedia ?? mediaFor(url, as, platform, thumbnail, label);
  const target = linkTarget(media, locale);
  const image = icon ?? (app ? resolveAppIconSrc(app, APP_ICONS) : undefined);
  const Mark = MARKS[media.kind];

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Keep anchors' copy-address, new-tab and modified-click behaviors.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (!(app && windows) && !attachments) return;
    event.preventDefault();
    onLaunch?.();
    if (app && windows) windows.openApp(app);
    else
      attachments?.open({
        id: `badge:${target}`,
        title: label,
        items: [media],
      });
  };

  return (
    <a
      href={target}
      onClick={onClick}
      className={cn("not-prose pressable", styles.badge, className)}
    >
      <span className={styles.icon} aria-hidden="true">
        {image ? (
          <>
            <Mark size={15} />
            {/* eslint-disable-next-line @next/next/no-img-element -- catalog icons are tiny static assets */}
            <img
              src={image}
              alt=""
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </>
        ) : (
          <Mark size={15} />
        )}
      </span>
      <span className={styles.label}>{children ?? label}</span>
      <ArrowUpRight className={styles.arrow} size={11} aria-hidden="true" />
    </a>
  );
}
