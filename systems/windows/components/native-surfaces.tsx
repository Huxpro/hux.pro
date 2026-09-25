"use client";

import { LanguageFilter } from "@/components/post";
import { PromptView } from "@/app/prompt/view";
import {
  formatPostDate,
  getLocalizedTitle,
  getPostHref,
  shouldShowPost,
} from "@/lib/content";
import { WallpaperPickerBody } from "@/systems/ambient/components/wallpaper-sheet";
import { NowPlaying } from "@/systems/music/components/now-playing";
import { useMusic } from "@/systems/music";
import { TrackThumb, useTheater } from "@/systems/theater";
import { AlbumTabs } from "@/systems/theater/components/album-tabs";
import { PlaylistRail } from "@/systems/theater/components/playlist-rail";
import { VideoControls } from "@/systems/theater/components/video-controls";
import { t, useLocale } from "@/services";
import { cn } from "@/lib/utils";
import { Link } from "next-view-transitions";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useBuiltinCatalog } from "./builtin-catalog";

/** Survives a strict-mode remount of the Watch surface, unlike an instance ref. */
let watchLife = 0;

/**
 * Watch — the theater's stage, living in the window.
 *
 * The player element is one for the whole site. While this window is the
 * presentation, that element is reparented into the slot below so a drag of
 * the window carries the video with it. Immersive and picture-in-picture
 * borrow it back; this slot then offers the way home.
 */
export function WatchSurface() {
  const { locale } = useLocale();
  const theater = useTheater();
  const {
    track,
    presentation,
    registeredAlbums,
    setStageHost,
    toTheater,
    toWindow,
    open,
  } = theater;

  const slotRef = useCallback(
    (node: HTMLDivElement | null) => {
      setStageHost(node);
    },
    [setStageHost],
  );

  // Closing the window unmounts this surface and ends playback. A strict-mode
  // remount bumps `watchLife` before the timeout, so the cancelled mount does
  // not stop the player.
  useEffect(() => {
    const token = ++watchLife;
    return () => {
      window.setTimeout(() => {
        if (watchLife !== token) return;
        setStageHost(null);
        theater.close();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const docked = presentation === "window" && !!track;
  const away = !!track && presentation !== "window";

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950 text-white">
      <div ref={slotRef} className="relative min-h-0 flex-1 bg-black">
        {!track && (
          <WatchLibrary
            onOpen={(index) =>
              open({ albums: registeredAlbums, albumIndex: index, trackIndex: 0 })
            }
          />
        )}
        {away && (
          <button
            type="button"
            onClick={toWindow}
            className="absolute inset-0 flex items-center justify-center text-xs font-mono uppercase tracking-wider text-white/70 hover:text-white"
          >
            {presentation === "pip"
              ? locale === "zh"
                ? "正在画中画 · 收回窗口"
                : "Playing in picture-in-picture · return"
              : locale === "zh"
                ? "正在全屏 · 收回窗口"
                : "Playing fullscreen · return"}
          </button>
        )}
      </div>
      {docked && (
        <div className="shrink-0 space-y-2 border-t border-white/10 bg-background px-3 py-2.5 text-foreground">
          <div className="flex items-center gap-2">
            <div className="w-16 shrink-0">
              <TrackThumb track={track} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{track.title}</div>
              {track.subtitle && (
                <div className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {track.subtitle}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toTheater}
              className="shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            >
              {locale === "zh" ? "全屏" : "Fullscreen"}
            </button>
          </div>
          <AlbumTabs
            albums={theater.albums}
            activeIndex={theater.albumIndex}
            onSelect={theater.selectAlbum}
          />
          <PlaylistRail />
          <VideoControls variant="pip" />
        </div>
      )}
    </div>
  );
}

function WatchLibrary({ onOpen }: { onOpen: (albumIndex: number) => void }) {
  const { locale } = useLocale();
  const { registeredAlbums } = useTheater();
  if (registeredAlbums.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center font-mono text-xs text-white/50">
        {locale === "zh" ? "还没有可看的内容" : "Nothing to watch yet"}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-end gap-2 p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-white/45">
        {locale === "zh" ? "专辑" : "Albums"}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {registeredAlbums.map((album, index) => (
          <button
            key={album.id}
            type="button"
            onClick={() => onOpen(index)}
            className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/18"
          >
            {album.title}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MusicSurface() {
  const { locale } = useLocale();
  const { openPlaylist } = useMusic();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto px-4 py-5">
        <NowPlaying />
      </div>
      <div className="shrink-0 border-t border-border/60 px-4 py-3">
        <button
          type="button"
          onClick={openPlaylist}
          className="w-full rounded-xl py-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          {t(locale, "musicOpenControls")}
        </button>
      </div>
    </div>
  );
}

export function WallpaperSurface() {
  return (
    <div className="h-full min-h-0 overflow-auto px-4 py-4 select-text">
      <WallpaperPickerBody wide />
    </div>
  );
}

export function WritingSurface() {
  const { locale } = useLocale();
  const { posts } = useBuiltinCatalog();
  const [includeOther, setIncludeOther] = useState(false);
  const visible = posts.filter((post) => shouldShowPost(post, locale, includeOther));

  return (
    <div className="h-full min-h-0 overflow-auto px-5 py-4 select-text">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {t(locale, "writingTitle")}
        </div>
        <LanguageFilter includeOther={includeOther} setIncludeOther={setIncludeOther} />
      </div>
      <ul>
        {visible.map((post) => (
          <li key={post.slug}>
            <Link
              href={getPostHref(post, locale, "/writing")}
              className="flex items-baseline justify-between gap-3 rounded-lg px-1 py-2.5 hover:bg-muted/50"
            >
              <span className={cn("min-w-0 truncate text-sm")}>
                {getLocalizedTitle(post, locale)}
              </span>
              <time className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {formatPostDate(post.date)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PromptSurface() {
  const { promptsEn, promptsZh } = useBuiltinCatalog();
  if (!promptsEn || !promptsZh) return null;
  return (
    <div className="h-full min-h-0 overflow-auto select-text">
      <Suspense>
        <PromptView dataEn={promptsEn} dataZh={promptsZh} embedded />
      </Suspense>
    </div>
  );
}
