"use client";

import { cn } from "@/lib/utils";
import { t, useLocale, useTheme } from "@/services";
import { Check, Cloud, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { getWeatherGradient } from "../lib/gradient";
import type { WeatherGradientMode } from "../lib/settings";
import {
  getWallpaperAppearanceLabel,
  getWallpaperPairPreview,
  getWallpapersByPlatform,
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
// like the music playlist sheet, so the two secondary windows read as one
// idiom:
//   • Mobile  — action sheet climbing from the bottom, resting at ~80dvh.
//   • Desktop — floating panel sliding in from the right edge.
//
// Tiles are macOS Settings pair cards: a 16:10 split of the light and dark
// originals, sun / moon on each half to pin that variant, a check when
// selected, and "Name" · "macOS · 2020" underneath.
//
// The grid leads with a live Weather tile, because weather is not a different
// feature from wallpaper — it is the one wallpaper that changes on its own.
// Picking any tile switches the background kind to it, which is the whole of
// the mutual-exclusion rule expressed as a single tap.
// ---------------------------------------------------------------------------

/** Ring of padding between the floating panel and the screen edges. */
const EDGE_GAP = "0.75rem";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 pb-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
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
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "flex-1 px-2 py-1.5 text-[11px] font-mono uppercase tracking-wider transition-colors",
            value === o.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The sun / moon buttons in the corners of a pair card. Tapping one both
 * selects the pair and pins that half — one gesture, as macOS Settings does it.
 */
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
        "absolute bottom-2 z-10 flex size-6 items-center justify-center rounded-full transition-colors",
        variant === "light" ? "left-2" : "right-2",
        active
          ? "bg-white text-black shadow-sm"
          : "bg-black/40 text-white ring-1 ring-white/35 backdrop-blur-[2px] hover:bg-black/55"
      )}
    >
      <Icon className="size-3" strokeWidth={2.25} />
    </button>
  );
}

/** Shared card chrome, so the Weather tile and the pair cards read as one set. */
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
 * because the pair is what you are choosing; which half shows is the separate
 * Appearance control above, or the sun/moon chips here.
 */
function WallpaperTile({
  wallpaper,
  selected,
  appearance,
}: {
  wallpaper: Wallpaper;
  selected: boolean;
  appearance: WallpaperAppearance;
}) {
  const { locale } = useLocale();
  const { selectWallpaper, selectWallpaperVariant } = useWallpaper();
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

        <VariantChip
          variant="light"
          active={selected && appearance === "light"}
          label={`${wallpaper.name} — ${t(locale, "wallpaperUseLight")}`}
          onSelect={() => selectWallpaperVariant(wallpaper.id, "light")}
        />
        <VariantChip
          variant="dark"
          active={selected && appearance === "dark"}
          label={`${wallpaper.name} — ${t(locale, "wallpaperUseDark")}`}
          onSelect={() => selectWallpaperVariant(wallpaper.id, "dark")}
        />
      </TileFrame>
      <TileCaption name={wallpaper.name} meta={meta} />
    </div>
  );
}

function PairGrid({
  title,
  wallpapers,
  activeId,
  isImage,
  appearance,
}: {
  title: string;
  wallpapers: Wallpaper[];
  activeId: string;
  isImage: boolean;
  appearance: WallpaperAppearance;
}) {
  return (
    <div className="pt-5">
      <SectionLabel>{title}</SectionLabel>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {wallpapers.map((w) => (
          <WallpaperTile
            key={w.id}
            wallpaper={w}
            selected={isImage && activeId === w.id}
            appearance={appearance}
          />
        ))}
      </div>
    </div>
  );
}

export function WallpaperSheet() {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const {
    kind,
    setKind,
    wallpaper: activeWallpaper,
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
  // app theme rather than the appearance control, because that control picks a
  // half of a fixed pair — the weather gradient has no such pair.
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

  const appearances = WALLPAPER_APPEARANCES.map((value) => ({
    value,
    label: getWallpaperAppearanceLabel(value, locale),
  }));

  const isImage = kind === "image";

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
              ? "bottom-3 right-3 top-3 w-[min(94vw,420px)]"
              : "inset-x-3 h-[80dvh]"
          )}
        >
          {/* Grabber — mobile affordance for the drag-to-dismiss gesture */}
          {!isWide && (
            <div className="flex justify-center pt-2">
              <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
            </div>
          )}

          <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
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
            <div className="pb-4 pt-1">
              <SectionLabel>{t(locale, "wallpaperAppearance")}</SectionLabel>
              <Segmented
                value={appearance}
                options={appearances}
                onChange={setAppearance}
              />
              <p className="px-0.5 pt-1.5 text-[11px] leading-snug text-muted-foreground/80">
                {t(locale, "wallpaperAppearanceHint")}
              </p>
            </div>

            {/* Placement — where the active wallpaper paints, or nowhere. */}
            <div>
              <SectionLabel>{t(locale, "wallpaperPlacement")}</SectionLabel>
              <Segmented
                value={gradientMode}
                options={placements}
                onChange={setGradientMode}
              />
            </div>

            {/* Weather leads the grid at full width: it is a wallpaper too, but
                the only one that is live, so it earns its own row. */}
            <div className="pt-5">
              <SectionLabel>{t(locale, "wallpaperChoose")}</SectionLabel>
              <div className="group">
                <TileFrame selected={!isImage}>
                  <button
                    type="button"
                    onClick={() => setKind("weather")}
                    aria-pressed={!isImage}
                    aria-label={t(locale, "wallpaperWeather")}
                    className="absolute inset-0"
                  >
                    <span
                      className="absolute inset-0"
                      style={{ backgroundImage: weatherPreview }}
                    />
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
            </div>

            <PairGrid
              title="macOS"
              wallpapers={getWallpapersByPlatform("macOS")}
              activeId={activeWallpaper.id}
              isImage={isImage}
              appearance={appearance}
            />
            <PairGrid
              title="iOS"
              wallpapers={getWallpapersByPlatform("iOS")}
              activeId={activeWallpaper.id}
              isImage={isImage}
              appearance={appearance}
            />

            <p className="px-0.5 pt-5 text-[11px] leading-snug text-muted-foreground/70">
              {t(locale, "wallpaperFooterNote")}
            </p>
            {isImage && (
              <p className="px-0.5 pt-1.5 text-[10px] font-mono text-muted-foreground/50">
                {activeWallpaper.name} ·{" "}
                {resolveAppearance(appearance, theme)} · {t(locale, "wallpaperCredit")}
              </p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
