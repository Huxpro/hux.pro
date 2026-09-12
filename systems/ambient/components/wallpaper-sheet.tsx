"use client";

import { cn } from "@/lib/utils";
import { t, useLocale, useTheme } from "@/services";
import { Check, Cloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { getWeatherGradient } from "../lib/gradient";
import type { WeatherGradientMode } from "../lib/settings";
import {
  getWallpaperAppearanceLabel,
  getWallpaperPair,
  resolveAppearance,
  WALLPAPER_APPEARANCES,
  type Wallpaper,
  type WallpaperAppearance,
} from "../lib/wallpaper";
import { useWallpaper, useWeather } from "../provider";

// ---------------------------------------------------------------------------
// WallpaperSheet — the secondary window behind the Wallpaper command.
//
// Mounted once in the root layout; any trigger summons it via `openPicker()`
// (the command palette today, the devtool panel too). Built on vaul and shaped
// exactly like the music playlist sheet, so the two secondary windows read as
// one idiom:
//   • Mobile  — action sheet climbing from the bottom, resting at ~78dvh.
//   • Desktop — floating panel sliding in from the right edge.
//
// The grid leads with a live Weather tile, because weather is not a different
// feature from wallpaper — it is the one wallpaper that changes on its own.
// Picking any tile switches the background source to it, which is the whole of
// the mutual-exclusion rule expressed as a single tap.
// ---------------------------------------------------------------------------

/** Ring of padding between the floating panel and the screen edges. */
const EDGE_GAP = "0.75rem";

/** Tiles preview at phone proportions — the shape a wallpaper is judged in. */
const TILE_ASPECT = "9 / 14";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border/60">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "flex-1 px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-colors",
            value === o.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Shared tile chrome: preview surface + caption + selected state. */
function Tile({
  active,
  onClick,
  label,
  sublabel,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className="group text-left"
    >
      <span
        style={{ aspectRatio: TILE_ASPECT }}
        className={cn(
          "relative block w-full overflow-hidden rounded-xl border transition-all",
          active
            ? "border-foreground/40 ring-2 ring-foreground/20"
            : "border-border/50 group-hover:border-border group-active:scale-[0.98]"
        )}
      >
        {children}
        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground/85 text-background shadow">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="mt-1.5 block truncate text-xs text-foreground/90">
        {label}
      </span>
      <span className="block truncate text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {sublabel}
      </span>
    </button>
  );
}

/**
 * A picture tile. When appearance is "auto" the preview is split down the
 * middle — light on the left, dark on the right — so the pair is visible as a
 * pair. A pinned appearance previews only that half.
 */
function WallpaperTile({
  wallpaper,
  appearance,
  theme,
  active,
  onSelect,
}: {
  wallpaper: Wallpaper;
  appearance: WallpaperAppearance;
  theme: "light" | "dark";
  active: boolean;
  onSelect: () => void;
}) {
  const pair = getWallpaperPair(wallpaper);
  const half = resolveAppearance(appearance, theme);
  const isAuto = appearance === "auto";

  return (
    <Tile
      active={active}
      onClick={onSelect}
      label={wallpaper.name}
      sublabel={`${wallpaper.family} · ${wallpaper.year}`}
      ariaLabel={`Use the ${wallpaper.name} wallpaper`}
    >
      {isAuto ? (
        <>
          <span
            className="absolute inset-y-0 left-0 w-1/2"
            style={{
              backgroundImage: pair.light.backgroundImage,
              backgroundSize: pair.light.cover ? "cover, 100% 100%" : undefined,
              // Each half previews the full artwork, not half of it.
              backgroundPosition: "left center",
              backgroundRepeat: "no-repeat",
            }}
          />
          <span
            className="absolute inset-y-0 right-0 w-1/2"
            style={{
              backgroundImage: pair.dark.backgroundImage,
              backgroundSize: pair.dark.cover ? "cover, 100% 100%" : undefined,
              backgroundPosition: "right center",
              backgroundRepeat: "no-repeat",
            }}
          />
          <span className="absolute inset-y-0 left-1/2 w-px bg-background/40" />
        </>
      ) : (
        <span
          className="absolute inset-0"
          style={{
            backgroundImage: pair[half].backgroundImage,
            backgroundSize: pair[half].cover ? "cover, 100% 100%" : undefined,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
    </Tile>
  );
}

export function WallpaperSheet() {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const {
    source,
    setSource,
    wallpaper: activeWallpaper,
    wallpapers,
    selectWallpaper,
    appearance,
    setAppearance,
    isPickerOpen,
    openPicker,
    closePicker,
  } = useWallpaper();
  const { weather, gradientMode, setGradientMode } = useWeather();

  // Right-side panel on wide viewports, bottom sheet otherwise. Tracked via
  // matchMedia so a resize (or rotation) picks the right edge next open.
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // The Weather tile previews what is actually live right now. It follows the
  // app theme rather than the appearance control above, because that control
  // picks a half of a fixed pair — the weather gradient has no such pair.
  const weatherPreview = getWeatherGradient({
    condition: weather?.condition ?? "clear",
    isDay: weather?.isDay ?? true,
    theme,
  }).backgroundImage;

  const placements: { value: WeatherGradientMode; label: string }[] = [
    { value: "full", label: t(locale, "wallpaperPlacementFull") },
    { value: "widget", label: t(locale, "wallpaperPlacementWidget") },
    { value: "off", label: t(locale, "wallpaperPlacementOff") },
  ];

  const vectors = wallpapers.filter((w) => w.medium === "artwork");
  const photos = wallpapers.filter((w) => w.medium === "photo");

  const appearances = WALLPAPER_APPEARANCES.map((value) => ({
    value,
    label: getWallpaperAppearanceLabel(value, locale),
  }));

  return (
    <Drawer.Root
      open={isPickerOpen}
      onOpenChange={(open) => (open ? openPicker() : closePicker())}
      direction={isWide ? "right" : "bottom"}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/25 dark:bg-black/45" />
        <Drawer.Content
          aria-describedby={undefined}
          style={
            {
              "--initial-transform": `calc(100% + ${EDGE_GAP})`,
              ...(!isWide && {
                bottom: `max(env(safe-area-inset-bottom), ${EDGE_GAP})`,
              }),
            } as React.CSSProperties
          }
          className={cn(
            "fixed z-[61] flex flex-col overflow-hidden outline-none",
            "rounded-3xl bg-card/85 backdrop-blur-xl",
            "border border-border/50 shadow-overlay",
            isWide
              ? "top-3 bottom-3 right-3 w-[min(92vw,380px)]"
              : "inset-x-3 h-[78dvh]"
          )}
        >
          {/* Grabber — mobile affordance for the drag-to-dismiss gesture */}
          {!isWide && (
            <div className="flex justify-center pt-2">
              <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
            </div>
          )}

          <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2">
            <Drawer.Title className="truncate text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {t(locale, "wallpaperTitle")}
            </Drawer.Title>
            <button
              onClick={closePicker}
              aria-label={t(locale, "wallpaperClose")}
              className="-mr-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground active:scale-[0.92] active:bg-accent/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
            {/* Appearance — which half of a light/dark pair is shown. */}
            <div className="pt-1 pb-4">
              <SectionLabel>{t(locale, "wallpaperAppearance")}</SectionLabel>
              <Segmented
                value={appearance}
                options={appearances}
                onChange={setAppearance}
              />
              <p className="px-1 pt-1.5 text-[11px] leading-snug text-muted-foreground/80">
                {t(locale, "wallpaperAppearanceHint")}
              </p>
            </div>

            {/* Placement — where the active wallpaper paints, or nowhere. */}
            <div className="pb-4">
              <SectionLabel>{t(locale, "wallpaperPlacement")}</SectionLabel>
              <Segmented
                value={gradientMode}
                options={placements}
                onChange={setGradientMode}
              />
            </div>

            {/* One grid, one selection — weather is simply the first tile. */}
            <SectionLabel>{t(locale, "wallpaperChoose")}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Tile
                active={source === "weather"}
                onClick={() => setSource("weather")}
                label={t(locale, "wallpaperWeather")}
                sublabel={t(locale, "wallpaperLive")}
                ariaLabel={t(locale, "wallpaperWeather")}
              >
                <span
                  className="absolute inset-0"
                  style={{ backgroundImage: weatherPreview }}
                />
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 p-2 text-[10px] font-mono uppercase tracking-wider text-foreground/70">
                  <Cloud className="h-3 w-3" />
                  {t(locale, "wallpaperLive")}
                </span>
              </Tile>

              {vectors.map((w) => (
                <WallpaperTile
                  key={w.id}
                  wallpaper={w}
                  appearance={appearance}
                  theme={theme}
                  active={source === "picture" && activeWallpaper.id === w.id}
                  onSelect={() => selectWallpaper(w.id)}
                />
              ))}
            </div>

            {/* Photographs sit in their own group: a different medium, and the
                one that comes with provenance worth showing. */}
            {photos.length > 0 && (
              <>
                <div className="pt-5">
                  <SectionLabel>{t(locale, "wallpaperPhotographs")}</SectionLabel>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((w) => (
                    <WallpaperTile
                      key={w.id}
                      wallpaper={w}
                      appearance={appearance}
                      theme={theme}
                      active={source === "picture" && activeWallpaper.id === w.id}
                      onSelect={() => selectWallpaper(w.id)}
                    />
                  ))}
                </div>
                <p className="px-1 pt-2 text-[11px] leading-snug text-muted-foreground/70">
                  {t(locale, "wallpaperPhotographsNote")}
                </p>
              </>
            )}

            {/* Provenance for whatever is selected. Public domain asks for no
                credit; showing it anyway is the interesting part. */}
            {source === "picture" && activeWallpaper.credit && (
              <div className="mt-4 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {activeWallpaper.credit}
                </div>
                {activeWallpaper.caption && (
                  <p className="pt-1 text-[11px] leading-snug text-foreground/70">
                    {activeWallpaper.caption[locale]}
                  </p>
                )}
              </div>
            )}

            <p className="px-1 pt-4 text-[11px] leading-snug text-muted-foreground/70">
              {t(locale, "wallpaperFooterNote")}
            </p>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
