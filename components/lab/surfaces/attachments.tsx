"use client";

import logData from "@/content/log.json";
import ogSnapshotJson from "@/content/og-snapshot.json";
import { ExternalImage } from "@/components/log/media/external-image";
import { markFor, MediaMark } from "@/components/log/media/media-mark";
import {
  getMediaThumbnail,
  isLinkMedia,
  isSlidesMedia,
  isVideoMedia,
  normalizeLogData,
  type Media,
  type RawLogData,
} from "@/lib/log";
import { enrichLogDataWithPreviews, type OGSnapshot } from "@/lib/og-enrich";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useMemo } from "react";
import { SurfaceFrame } from "./frame";

/** A recording, a deck, a page — the three chips a cover says most. */
const KINDS: { name: string; test: (m: Media) => boolean }[] = [
  { name: "recording", test: isVideoMedia },
  { name: "deck", test: isSlidesMedia },
  { name: "page", test: (m) => isLinkMedia(m) && !m.internal && !!m.preview?.image },
];

/**
 * The Attachments Lab at a glance: its vocabulary — the chip each kind of
 * cover wears before it is pressed — on the log's own covers.
 */
export function AttachmentsSurface() {
  const { locale } = useLocale();
  const samples = useMemo(() => {
    const { commits } = enrichLogDataWithPreviews(
      normalizeLogData(logData as unknown as RawLogData),
      ogSnapshotJson as OGSnapshot,
    );
    return KINDS.map(({ name, test }) => {
      for (const commit of commits) {
        const hit = (commit.media ?? []).find((m) => test(m) && !!getMediaThumbnail(m));
        if (hit) return { name, media: hit };
      }
      return null;
    }).filter((s): s is { name: string; media: Media } => !!s);
  }, []);

  return (
    <SurfaceFrame className="flex items-center px-3">
      <div className="grid w-full grid-cols-3 gap-2">
        {samples.map(({ name, media }) => (
          <figure key={name} className="min-w-0 space-y-1.5">
            <div className="relative aspect-video overflow-hidden rounded-md border border-border/50 bg-muted/30">
              <ExternalImage
                src={getMediaThumbnail(media)!}
                alt=""
                className="block h-full w-full object-cover"
              />
              <MediaMark mark={markFor(media, locale, { all: true })} size="mini" />
            </div>
            <figcaption className={cn(TYPE.labelSm, "truncate text-center")}>{name}</figcaption>
          </figure>
        ))}
      </div>
    </SurfaceFrame>
  );
}
