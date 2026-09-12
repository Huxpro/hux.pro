"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useWeather } from "@/systems/ambient";
import { ArrowLeft, Check, Moon, Sun } from "lucide-react";
import {
  getWallpaperPairsBySource,
  wallpaperPlatformLabel,
  type WallpaperAppearance,
  type WallpaperPair,
} from "../lib";
import { useWallpaper } from "../provider";

// =============================================================================
// WallpaperPanel — secondary ⌘K window for picking a wallpaper.
//
// Image tiles follow the macOS Settings pair card: a 16:10 split of the
// light and dark originals, sun / moon on each half, a check when selected,
// and "Name" · "macOS · 2020" underneath.
// =============================================================================

function preload(src: string) {
  if (typeof window === "undefined") return;
  const img = new window.Image();
  img.src = src;
}

function AppearanceSwitch({
  value,
  onChange,
}: {
  value: WallpaperAppearance;
  onChange: (value: WallpaperAppearance) => void;
}) {
  const { locale } = useLocale();
  const options: { value: WallpaperAppearance; label: string }[] = [
    { value: "auto", label: t(locale, "wallpaperAuto") },
    { value: "light", label: t(locale, "themeLight") },
    { value: "dark", label: t(locale, "themeDark") },
  ];

  return (
    <div className="flex w-full overflow-hidden rounded-lg border border-border/60 sm:w-auto">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors sm:flex-none",
            value === option.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function WeatherTile({ selected }: { selected: boolean }) {
  const { locale } = useLocale();
  const { gradient, gradientMode, setGradientMode } = useWeather();
  const { selectWeather } = useWallpaper();

  const modes = [
    { value: "full" as const, label: t(locale, "wallpaperGradientFull") },
    { value: "widget" as const, label: t(locale, "wallpaperGradientWidget") },
    { value: "off" as const, label: t(locale, "stateOff") },
  ];

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={selectWeather}
        className={cn(
          "group relative w-full overflow-hidden rounded-xl border text-left",
          "aspect-[16/7] sm:aspect-[16/6]",
          "transition-all duration-200",
          selected
            ? "border-foreground/60 ring-2 ring-foreground/40"
            : "border-border/50 hover:border-border"
        )}
        aria-pressed={selected}
      >
        <div
          className="absolute inset-0"
          style={gradient ? { backgroundImage: gradient } : undefined}
        />
        <div className="absolute inset-0 bg-background/20" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3">
          <div>
            <div className="text-sm font-medium text-foreground">
              {t(locale, "wallpaperWeather")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {t(locale, "wallpaperWeatherHint")}
            </div>
          </div>
        </div>
      </button>

      {selected && (
        <div className="flex flex-wrap gap-1.5">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setGradientMode(mode.value)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider",
                "transition-colors",
                gradientMode === mode.value
                  ? "border-foreground/50 bg-accent text-accent-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={gradientMode === mode.value}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantChip({
  variant,
  active,
  label,
  onSelect,
}: {
  variant: "light" | "dark";
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  const Icon = variant === "light" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "absolute z-10 flex size-6 items-center justify-center rounded-full",
        "transition-colors",
        variant === "light" ? "bottom-2 left-2" : "bottom-2 right-2",
        active
          ? "bg-white text-black shadow-sm"
          : "bg-black/40 text-white ring-1 ring-white/35 backdrop-blur-[2px] hover:bg-black/55"
      )}
    >
      <Icon className="size-3" strokeWidth={2.25} />
    </button>
  );
}

function ImageTile({ pair }: { pair: WallpaperPair }) {
  const { locale } = useLocale();
  const { kind, imageId, appearance, selectImage, setAppearance } =
    useWallpaper();
  const selected = kind === "image" && imageId === pair.id;
  const name = locale === "zh" ? pair.nameZh : pair.name;
  const platform = wallpaperPlatformLabel(pair.source);

  const choosePair = () => selectImage(pair.id);
  const chooseVariant = (variant: "light" | "dark") => {
    selectImage(pair.id);
    setAppearance(variant);
  };

  return (
    <div
      className="group min-w-0"
      onMouseEnter={() => {
        preload(pair.light.src);
        preload(pair.dark.src);
      }}
    >
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden rounded-[18px]",
          "ring-1 transition-[box-shadow,ring-color] duration-200",
          selected
            ? "ring-2 ring-white/80 dark:ring-white/70"
            : "ring-black/10 group-hover:ring-black/20 dark:ring-white/15 dark:group-hover:ring-white/30"
        )}
      >
        <button
          type="button"
          onClick={choosePair}
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

        <VariantChip
          variant="light"
          active={selected && appearance === "light"}
          label={t(locale, "wallpaperUseLight")}
          onSelect={() => chooseVariant("light")}
        />
        <VariantChip
          variant="dark"
          active={selected && appearance === "dark"}
          label={t(locale, "wallpaperUseDark")}
          onSelect={() => chooseVariant("dark")}
        />

        {selected && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-2.5 right-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-white text-black shadow-sm"
          >
            <Check className="size-3.5" strokeWidth={2.5} />
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2 px-0.5">
        <span className="truncate text-[13px] font-medium text-foreground">
          {name}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {platform} · {pair.year}
        </span>
      </div>
    </div>
  );
}

function PairGrid({
  title,
  pairs,
}: {
  title: string;
  pairs: WallpaperPair[];
}) {
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {pairs.map((pair) => (
          <ImageTile key={pair.id} pair={pair} />
        ))}
      </div>
    </div>
  );
}

export function WallpaperPanel({ onBack }: { onBack: () => void }) {
  const { locale } = useLocale();
  const { kind, appearance, setAppearance } = useWallpaper();
  const macos = getWallpaperPairsBySource("macos");
  const ios = getWallpaperPairsBySource("ios");

  return (
    <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
      <div className="mb-3 flex flex-wrap items-start gap-2">
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
        <div className="w-full sm:ml-auto sm:w-auto">
          <AppearanceSwitch value={appearance} onChange={setAppearance} />
        </div>
      </div>

      <div className="max-h-[min(62vh,560px)] overflow-y-auto pr-0.5">
        <div className="space-y-5 pb-6">
          <WeatherTile selected={kind === "weather"} />
          <PairGrid title={t(locale, "wallpaperMacOS")} pairs={macos} />
          <PairGrid title={t(locale, "wallpaperIOS")} pairs={ios} />
        </div>
      </div>
    </div>
  );
}
