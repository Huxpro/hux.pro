import { getLogData } from "@/lib/log-server";
import {
  isImageMedia,
  isLinkPill,
  isLinkMedia,
  isSlidesMedia,
  isSocialEmbedMedia,
  isVideoMedia,
  type LinkMedia,
  type Media,
  type SocialEmbedMedia,
  type VideoMedia,
} from "@/lib/log";
import { isVideoLinkHost } from "@/lib/og-core";
import { enrichLogDataWithPreviews } from "@/lib/og-snapshot";
import { AttachmentsLabView, type LabSamples } from "./view";

export const metadata = {
  title: "Attachments Lab | Hux.Pro",
  description:
    "Where a commit's attachments open, and the chip each cover wears — with the real surfaces on the page.",
  robots: { index: false, follow: false },
};

/**
 * One attachment of each kind, taken from the log itself so the specimens are
 * the site's own — the first the log has of each, in authored order.
 */
function pickSamples(): LabSamples {
  const { commits } = enrichLogDataWithPreviews(getLogData());
  const first = <T extends Media>(test: (m: Media) => m is T): T | undefined => {
    for (const commit of commits) {
      const hit = (commit.media ?? []).find(test);
      if (hit) return hit;
    }
    return undefined;
  };
  const card = (m: Media): m is LinkMedia => isLinkMedia(m) && !isLinkPill(m);
  const videoOn = (platform: VideoMedia["platform"]) =>
    first((m): m is VideoMedia => isVideoMedia(m) && m.platform === platform);
  const socialOn = (platform: NonNullable<SocialEmbedMedia["platform"]>) =>
    first((m): m is SocialEmbedMedia => isSocialEmbedMedia(m) && m.platform === platform);
  return {
    video: first(isVideoMedia),
    youtube: videoOn("youtube"),
    bilibili: videoOn("bilibili"),
    vimeo: videoOn("vimeo"),
    slides: first(isSlidesMedia),
    talkPage: first(
      (m): m is LinkMedia => card(m) && isVideoLinkHost(m.url) && m.preview?.frame !== "deny",
    ),
    web: first(
      (m): m is LinkMedia =>
        card(m) &&
        !m.internal &&
        !m.url.startsWith("/") &&
        !isVideoLinkHost(m.url) &&
        m.preview?.frame !== "deny" &&
        !!m.preview?.image,
    ),
    denied: first((m): m is LinkMedia => card(m) && m.preview?.frame === "deny"),
    post: first((m): m is LinkMedia => card(m) && !!m.internal),
    pill: first(isLinkPill),
    image: first(isImageMedia),
    social: first(isSocialEmbedMedia),
    twitter: socialOn("twitter"),
    instagram: socialOn("instagram"),
    tiktok: socialOn("tiktok"),
  };
}

export default function AttachmentsLabPage() {
  return <AttachmentsLabView samples={pickSamples()} />;
}
