"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useWeather } from "@/systems/ambient";
import { ArrowLeft, Check } from "lucide-react";
import {
  getWallpaperPairsBySource,
  wallpaperPlatformLabel,
  type WallpaperPair,
} from "../lib";
import { useWallpaper } from "../provider";

// =============================================================================
// WallpaperPanel — secondary ⌘K window for picking a wallpaper.
//
// One grid of Settings pair cards. Weather is the first tile (same 16:10
// size as Tahoe). Image tiles split light / dark. Appearance always follows
// the site theme — no Auto / Light / Dark control.
// =============================================================================

function preload(src: string) {
  if (typeof window === "undefined") return;
  const img = new window.Image();
  img.src = src;
}

function TileChrome({
  selected,
  children,
}: {
  selected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[16/10] overflow-hidden rounded-[18px]",
        "ring-1 transition-[box-shadow,ring-color] duration-200",
        selected
          ? "ring-2 ring-white/80 dark:ring-white/70"
          : "ring-black/10 group-hover:ring-black/20 dark:ring-white/15 dark:group-hover:ring-white/30"
      )}
    >
      {children}
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-2.5 right-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-white text-black shadow-sm"
        >
          <Check className="size-3.5" strokeWidth={2.5} />
        </span>
      )}
    </div>
  );
}

function TileCaption({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="mt-2 flex items-baseline justify-between gap-2 px-0.5">
      <span className="truncate text-[13px] font-medium text-foreground">
        {name}
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function WeatherTile() {
  const { locale } = useLocale();
  const { gradient, setGradientMode } = useWeather();
  const { kind, selectWeather } = useWallpaper();
  const selected = kind === "weather";

  return (
    <div className="group min-w-0">
      <TileChrome selected={selected}>
        <button
          type="button"
          onClick={() => {
            selectWeather();
            setGradientMode("full");
          }}
          aria-pressed={selected}
          aria-label={t(locale, "wallpaperWeather")}
          className="absolute inset-0"
        >
          <span
            className="absolute inset-0"
            style={gradient ? { backgroundImage: gradient } : undefined}
          />
        </button>
      </TileChrome>
      <TileCaption
        name={t(locale, "wallpaperWeather")}
        meta={locale === "zh" ? "实时" : "Live"}
      />
    </div>
  );
}

function ImageTile({ pair }: { pair: WallpaperPair }) {
  const { locale } = useLocale();
  const { kind, imageId, selectImage } = useWallpaper();
  const selected = kind === "image" && imageId === pair.id;
  const name = locale === "zh" ? pair.nameZh : pair.name;
  const platform = wallpaperPlatformLabel(pair.source);

  return (
    <div
      className="group min-w-0"
      onMouseEnter={() => {
        preload(pair.light.src);
        preload(pair.dark.src);
      }}
    >
      <TileChrome selected={selected}>
        <button
          type="button"
          onClick={() => selectImage(pair.id)}
          aria-pressed={selected}
          aria-label={`${name} — ${platform} · ${pair.year}`}
          className="absolute inset-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pair.light.thumb}
            alt=""
            className="absolute inset-y-0 left-0 h-full w-1/2 object-cover"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pair.dark.thumb}
            alt=""
            className="absolute inset-y-0 right-0 h-full w-1/2 object-cover"
          />
        </button>
      </TileChrome>
      <TileCaption name={name} meta={`${platform} · ${pair.year}`} />
    </div>
  );
}

export function WallpaperPanel({ onBack }: { onBack: () => void }) {
  const { locale } = useLocale();
  const macos = getWallpaperPairsBySource("macos");
  const ios = getWallpaperPairsBySource("ios");

  return (
    <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
      <div className="mb-3 flex items-start gap-2">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            "text-muted-foreground transition-colors",
            "hover:bg-accent/40 hover:text-foreground"
          )}
          aria-label={t(locale, "backToSearch")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 pt-1">
          <div className="text-sm font-medium text-foreground">
            {t(locale, "wallpaperPickerTitle")}
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {t(locale, "wallpaperPickerHint")}
          </div>
        </div>
      </div>

      <div className="max-h-[min(62vh,560px)] overflow-y-auto pr-0.5">
        <div className="space-y-5 pb-6">
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {t(locale, "wallpaperMacOS")}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <WeatherTile />
              {macos.map((pair) => (
                <ImageTile key={pair.id} pair={pair} />
              ))}
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {t(locale, "wallpaperIOS")}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              {ios.map((pair) => (
                <ImageTile key={pair.id} pair={pair} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
