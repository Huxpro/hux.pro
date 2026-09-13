"use client";

import { cn } from "@/lib/utils";
import { t, useLocale, useTheme } from "@/services";
import { Check, Cloud, Moon, Sun } from "lucide-react";
import {
  ADAPTIVE_PRESENTATION,
  AdaptiveSurface,
  useSurfaceContext,
} from "@/systems/surface";
import { getWeatherGradient } from "../lib/gradient";
import type { WeatherGradientMode } from "../lib/settings";
import {
  BUILT_IN_WALLPAPERS,
  getWallpaperPairPreview,
  type Wallpaper,
} from "../lib/wallpaper";
import { useWallpaper, useWeather } from "../provider";

// ---------------------------------------------------------------------------
// WallpaperSheet — the secondary window behind the Wallpaper command.
//
// Mounted once in the root layout; any trigger summons it via `openPicker()`
// (the command palette today, the devtool panel too). Its shape is delegated to
// <AdaptiveSurface> (systems/surface): bottom sheet on a phone, side panel on a
// tablet, a draggable centred window on a desktop. This file only decides what
// goes inside it.
//
// Tiles are macOS Settings pair cards: a 16:10 split of the light and dark
// originals, a sun / moon marking each half, a check when selected, and
// "Name" · "macOS · 2020" underneath.
//
// Weather is the FIRST tile in the same grid at the same size, not a banner of
// its own — it is one of the wallpapers, just the only one that moves. A
// separate row said the opposite.
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 pb-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

/** Compact label + segmented control on one line, like the devtool's rows. */
function CompactRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex shrink-0 overflow-hidden rounded-md border border-border/60">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
              value === o.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Marks which half of the pair is which. An indicator, not a control: the half
 * that shows always follows the app theme, so there is nothing here to pick.
 */
function VariantMark({ variant }: { variant: "light" | "dark" }) {
  const Icon = variant === "light" ? Sun : Moon;
  return (
    <span
      aria-hidden
      className={cn(
        "absolute bottom-2 z-10 flex size-5 items-center justify-center rounded-full",
        "bg-black/35 text-white ring-1 ring-white/25 backdrop-blur-[2px]",
        variant === "light" ? "left-2" : "right-2"
      )}
    >
      <Icon className="size-2.5" strokeWidth={2.25} />
    </span>
  );
}

/** Shared card chrome, so Weather and the pair cards read as one set. */
function TileFrame({
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
          ? "ring-2 ring-foreground/70"
          : "ring-black/10 group-hover:ring-black/20 dark:ring-white/15 dark:group-hover:ring-white/30"
      )}
    >
      {children}
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-white text-black shadow-sm"
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

/** Warm the full-size pair on hover so applying it is instant. */
function preload(src: string) {
  if (typeof window === "undefined") return;
  const img = new window.Image();
  img.src = src;
}

/**
 * A pair card. Both halves are always visible — light left, dark right —
 * because the pair is what you are choosing; which half shows is the theme's
 * business, not yours.
 */
function WallpaperTile({
  wallpaper,
  selected,
}: {
  wallpaper: Wallpaper;
  selected: boolean;
}) {
  const { selectWallpaper } = useWallpaper();
  const preview = getWallpaperPairPreview(wallpaper);
  const meta = `${wallpaper.platform} · ${wallpaper.year}`;

  return (
    <div
      className="group min-w-0"
      onMouseEnter={() => {
        preload(wallpaper.light.src);
        preload(wallpaper.dark.src);
      }}
    >
      <TileFrame selected={selected}>
        <button
          type="button"
          onClick={() => selectWallpaper(wallpaper.id)}
          aria-pressed={selected}
          aria-label={`Use the ${wallpaper.name} wallpaper — ${meta}`}
          className="absolute inset-0"
        >
          <span
            className="absolute inset-y-0 left-0 w-1/2 bg-cover bg-center"
            style={{ backgroundImage: preview.light.backgroundImage }}
          />
          <span
            className="absolute inset-y-0 right-0 w-1/2 bg-cover bg-center"
            style={{ backgroundImage: preview.dark.backgroundImage }}
          />
        </button>
        <VariantMark variant="light" />
        <VariantMark variant="dark" />
      </TileFrame>
      <TileCaption name={wallpaper.name} meta={meta} />
    </div>
  );
}

/** The live one. Same frame, same size, first in the grid. */
function WeatherTile({ selected }: { selected: boolean }) {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const { setKind } = useWallpaper();
  const { weather } = useWeather();

  // Previews what is actually live right now, in the current theme.
  const preview = getWeatherGradient({
    condition: weather?.condition ?? "clear",
    isDay: weather?.isDay ?? true,
    theme,
  }).backgroundImage;

  return (
    <div className="group min-w-0">
      <TileFrame selected={selected}>
        <button
          type="button"
          onClick={() => setKind("weather")}
          aria-pressed={selected}
          aria-label={t(locale, "wallpaperWeather")}
          className="absolute inset-0"
        >
          <span className="absolute inset-0" style={{ backgroundImage: preview }} />
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-white ring-1 ring-white/25 backdrop-blur-[2px]">
            <Cloud className="size-3" />
            {t(locale, "wallpaperLive")}
          </span>
        </button>
      </TileFrame>
      <TileCaption
        name={t(locale, "wallpaperWeather")}
        meta={t(locale, "wallpaperWeatherMeta")}
      />
    </div>
  );
}

export function WallpaperSheet() {
  const { locale } = useLocale();
  const {
    kind,
    wallpaper: activeWallpaper,
    isPickerOpen,
    openPicker,
    closePicker,
  } = useWallpaper();

  return (
    <AdaptiveSurface
      id="surface-wallpaper"
      open={isPickerOpen}
      onOpenChange={(open) => (open ? openPicker() : closePicker())}
      presentation={ADAPTIVE_PRESENTATION}
      title={t(locale, "wallpaperTitle")}
      closeLabel={t(locale, "wallpaperClose")}
      windowWidth="min(92vw, 620px)"
    >
      <WallpaperPickerBody
        isImage={kind === "image"}
        activeId={activeWallpaper.id}
      />
    </AdaptiveSurface>
  );
}

/**
 * The picker's content, unaware of which shape it landed in beyond the one
 * thing that genuinely differs: a desktop window is wide enough for three
 * columns of pair cards, a phone sheet is not.
 */
function WallpaperPickerBody({
  isImage,
  activeId,
}: {
  isImage: boolean;
  activeId: string;
}) {
  const { locale } = useLocale();
  const { gradientMode, setGradientMode } = useWeather();
  const { isWindow } = useSurfaceContext();
  const columns = isWindow ? 3 : 2;

  const placements: { value: WeatherGradientMode; label: string }[] = [
    { value: "full", label: t(locale, "wallpaperPlacementFull") },
    { value: "widget", label: t(locale, "wallpaperPlacementWidget") },
    { value: "off", label: t(locale, "wallpaperPlacementOff") },
  ];

  return (
    <>
      {/* Placement — where the active wallpaper paints, or nowhere. One compact
          row: it is a modifier, not the thing you came here for. */}
      <div className="pb-4 pt-1">
        <CompactRow
          label={t(locale, "wallpaperPlacement")}
          value={gradientMode}
          options={placements}
          onChange={setGradientMode}
        />
      </div>

      <SectionLabel>{t(locale, "wallpaperChoose")}</SectionLabel>
      <div
        className="grid gap-x-3 gap-y-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        <WeatherTile selected={!isImage} />
        {BUILT_IN_WALLPAPERS.map((w) => (
          <WallpaperTile
            key={w.id}
            wallpaper={w}
            selected={isImage && activeId === w.id}
          />
        ))}
      </div>

      <p className="px-0.5 pt-5 text-[11px] leading-snug text-muted-foreground/70">
        {t(locale, "wallpaperFooterNote")}
      </p>
    </>
  );
}
