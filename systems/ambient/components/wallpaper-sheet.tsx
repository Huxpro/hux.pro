"use client";

import {
  Segmented,
  type SegmentedOption,
} from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { ARTWORK_CHIP } from "@/lib/glass";
import { t, useLocale, type TranslationKey } from "@/services";
import { AlbumTabs } from "@/systems/theater";
import { Check, Cloud, Moon, Palette, Repeat, Shuffle, Smartphone, Sparkles, Sun } from "lucide-react";
import { useState } from "react";
import {
  ADAPTIVE_PRESENTATION,
  AdaptiveSurface,
  SHEET_DETENTS,
  useOptionalSurfaceContext,
} from "@/systems/surface";
import { getWeatherStyleGradient } from "../lib/gradient";
import type { WallpaperPlacement } from "../lib/settings";
import {
  getWallpaperPairPreview,
  isPhoneWallpaper,
  isSingleImage,
  pickWallpaperSrc,
  readDisplaySize,
  WALLPAPER_CATEGORIES,
  wallpapersInAlbum,
  WEATHER_STYLE_LABEL,
  WEATHER_STYLE_META,
  WEATHER_STYLES,
  type Wallpaper,
  type WallpaperCategory,
  type WallpaperPlay,
  type WallpaperPlayAlbum,
  type WallpaperPlayEvery,
  type WeatherStyle,
} from "../lib/wallpaper";
import { useAmbientTime, useSolarTheme, useWallpaper, useWeather } from "../provider";
import { WeatherWallpaper } from "./wallpaper";

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
// "Name" · "macOS · 2020" underneath, with the file's resolution below that.
// A photograph is one picture, so its tile is that picture, unsplit.
//
// The catalog is split into categories (Weather, Apple, Nature) with the same
// capsule the Featured Talks widget uses to switch albums — one group at a time
// is the same choice in both places, so it looks the same.
//
// Weather is a category of its own, and the first: three tiles — Sky (the
// shader, previewed by a small live canvas), Gradient (the same scene as a
// live CSS wash, previewed with the very gradient the page would paint) and
// Classic (the original condition palettes). It used to be one tile leading
// every grid; with styles to choose between it is a group, and the way back
// to it is always the first tab.
//
// Apple and Nature each open with Shuffle and Loop, the same two modes iOS
// Photo Shuffle and macOS Change Picture use on a folder of stills. Shuffle
// is a fanned collage (iOS); Loop is the same stills in a tidy stack (macOS
// sequential). They sit as their own pair — not in the stills grid — and
// Frequency (iOS Shuffle Frequency, On Lock → On Visit) lands directly under
// them while either is on, so it is not stranded below nineteen pictures.
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
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
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Segmented tone="system" value={value} options={options} onChange={onChange} />
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
        ARTWORK_CHIP,
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

/**
 * Name on the left, platform + year on the right, resolution underneath.
 *
 * A phone glyph rides in front of the platform on the iOS pairs. Phone artwork
 * on a desktop viewport is a crop of itself, and that is worth knowing BEFORE
 * you pick it — the tile can't show it, because every tile is the same 16:10
 * card whatever shape the file is.
 */
function TileCaption({
  name,
  meta,
  phone,
  resolution,
}: {
  name: string;
  meta?: string;
  phone?: boolean;
  /**
   * The committed file's pixels. On its own line, in mono, because it is a
   * spec rather than a name — and the one thing about a picture you cannot
   * judge from a 200px tile.
   */
  resolution?: string;
}) {
  return (
    <div className="mt-2 px-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-foreground">
          {name}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
          {phone && (
            <Smartphone
              aria-hidden
              className="size-3 translate-y-[0.5px] opacity-70"
              strokeWidth={2}
            />
          )}
          {meta}
        </span>
      </div>
      {resolution && (
        <div className="mt-0.5 font-mono text-[10px] tabular-nums text-tertiary-foreground">
          {resolution}
        </div>
      )}
    </div>
  );
}

/**
 * Warm the half that will actually be applied, once.
 *
 * Both halves used to be fetched, which is twice the bytes for a picture the
 * theme rules out: `getWallpaperBackground` always resolves `wallpaper[theme]`.
 * Sweeping the grid pulled the entire catalog to make one tile instant.
 */
const warmed = new Set<string>();
function preload(src: string) {
  if (typeof window === "undefined" || warmed.has(src)) return;
  warmed.add(src);
  const img = new window.Image();
  img.src = src;
}

/** Light left, dark right. */
function PairHalves({
  preview,
}: {
  preview: ReturnType<typeof getWallpaperPairPreview>;
}) {
  return (
    <>
      <span
        className="absolute inset-y-0 left-0 w-1/2 bg-cover bg-center"
        style={{ backgroundImage: preview.light.backgroundImage }}
      />
      <span
        className="absolute inset-y-0 right-0 w-1/2 bg-cover bg-center"
        style={{ backgroundImage: preview.dark.backgroundImage }}
      />
    </>
  );
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
  const { selectWallpaper, variant, blurred } = useWallpaper();
  const single = isSingleImage(wallpaper);
  const preview = getWallpaperPairPreview(wallpaper);
  const meta =
    wallpaper.caption ??
    (wallpaper.platform ? `${wallpaper.platform} · ${wallpaper.year}` : undefined);
  const { width, height } = wallpaper[variant];
  const resolution = `${width} × ${height}`;

  return (
    <div
      className="group min-w-0"
      // A blurred reading page paints the thumb, which the tile already loaded.
      onMouseEnter={
        blurred
          ? undefined
          : () => preload(pickWallpaperSrc(wallpaper[variant], readDisplaySize()))
      }
    >
      <TileFrame selected={selected}>
        <button
          type="button"
          onClick={() => selectWallpaper(wallpaper.id)}
          aria-pressed={selected}
          aria-label={`Use the ${wallpaper.name} wallpaper — ${
            meta ? `${meta}, ` : ""
          }${width} by ${height}${
            isPhoneWallpaper(wallpaper) ? ", a phone wallpaper" : ""
          }`}
          className="absolute inset-0"
        >
          {single ? (
            <span
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: preview.light.backgroundImage }}
            />
          ) : (
            <PairHalves preview={preview} />
          )}
        </button>
        {!single && <VariantMark variant="light" />}
        {!single && <VariantMark variant="dark" />}
      </TileFrame>
      <TileCaption
        name={wallpaper.name}
        meta={meta}
        phone={isPhoneWallpaper(wallpaper)}
        resolution={resolution}
      />
    </div>
  );
}

/**
 * The weather tiles. Same frame, same size as the pair cards. Each previews
 * what choosing it would paint right now: the Sky tile runs the shader itself
 * at a tile-sized pixel budget — the one wallpaper that moves should move in
 * its tile — the Gradient tile paints the very gradient the page would, and
 * the Classic tile the palette for this condition and hour. Where WebGL2 is
 * missing the Sky tile shows the Gradient with a note, which is also what
 * choosing it would paint. Every tile wears a chip saying how it moves: Live
 * on the two realtime styles, Preset on Classic.
 */
function WeatherStyleTile({
  style,
  selected,
}: {
  style: WeatherStyle;
  selected: boolean;
}) {
  const { locale } = useLocale();
  const { selectWeather, shaderSupported, gyro } = useWallpaper();
  const { scene } = useWeather();
  const { phase } = useAmbientTime();

  const animated = style === "sky" && shaderSupported;
  // The Sky tile runs the shader; the other two paint what the page would.
  const gradient = animated ? undefined : getWeatherStyleGradient(style, scene, phase);
  const realtime = style !== "classic";
  const name = t(locale, WEATHER_STYLE_LABEL[style]);
  const meta = t(locale, WEATHER_STYLE_META[style]);
  const Glyph = style === "sky" ? Sparkles : style === "gradient" ? Cloud : Palette;

  return (
    <div className="group min-w-0">
      <TileFrame selected={selected}>
        <button
          type="button"
          onClick={() => selectWeather(style)}
          aria-pressed={selected}
          aria-label={`${t(locale, "wallpaperWeather")} — ${name}`}
          title={style === "sky" && !shaderSupported ? t(locale, "wallpaperNoWebGL") : undefined}
          className="absolute inset-0"
        >
          {animated ? (
            <WeatherWallpaper
              scene={scene}
              active
              // The tile tilts too, so the Tilt row below has its preview
              // right above it: lean the phone in the rain and watch it lean.
              gyro={gyro.active}
              quality={{ pixelBudget: 90_000, maxFps: 30 }}
              className="rounded-[18px]"
            />
          ) : (
            <span className="absolute inset-0" style={{ backgroundImage: gradient }} />
          )}
          <span
            className={cn(
              "absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5",
              "text-[10px] font-mono uppercase tracking-wider",
              ARTWORK_CHIP
            )}
          >
            <Glyph className="size-3" />
            {t(locale, realtime ? "wallpaperLive" : "wallpaperPreset")}
          </span>
        </button>
      </TileFrame>
      <TileCaption name={name} meta={meta} />
    </div>
  );
}

/**
 * Three thumbs from the album, the way iOS draws Photo Shuffle.
 *
 * Shuffle fans them (a handful of photos). Loop keeps them square and
 * slightly offset — catalog order, macOS Change Picture without Randomly.
 */
function PlayCollage({
  wallpapers,
  variant,
  fanned,
}: {
  wallpapers: Wallpaper[];
  variant: "light" | "dark";
  fanned: boolean;
}) {
  const shots = wallpapers.slice(0, 3);
  const poses = fanned
    ? [
        { rotate: -11, x: -22, y: 8, z: 1 },
        { rotate: 12, x: 22, y: 10, z: 2 },
        { rotate: -2, x: 0, y: -4, z: 3 },
      ]
    : [
        { rotate: 0, x: -18, y: 6, z: 1 },
        { rotate: 0, x: 0, y: 0, z: 2 },
        { rotate: 0, x: 18, y: -6, z: 3 },
      ];

  return (
    <span
      className="absolute inset-0"
      style={{ backgroundColor: shots[0]?.[variant].base ?? "transparent" }}
    >
      {shots.map((wallpaper, i) => (
        <span
          key={wallpaper.id}
          className="absolute left-1/2 top-1/2 h-[64%] w-[56%] overflow-hidden rounded-[10px] bg-cover bg-center shadow-md ring-1 ring-white/50"
          style={{
            backgroundImage: `url("${wallpaper[variant].thumb}")`,
            transform: `translate(-50%, -50%) translate(${poses[i].x}%, ${poses[i].y}%) rotate(${poses[i].rotate}deg)`,
            zIndex: poses[i].z,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Shuffle or Loop for one album. Same frame as every other tile; the collage
 * is the affordance, the chip says which motion it is.
 */
function PlayTile({
  album,
  play,
  selected,
}: {
  album: WallpaperPlayAlbum;
  play: Exclude<WallpaperPlay, "off">;
  selected: boolean;
}) {
  const { locale } = useLocale();
  const { selectPlay, variant } = useWallpaper();
  const albumWallpapers = wallpapersInAlbum(album);
  const shuffle = play === "shuffle";
  const name = t(locale, shuffle ? "wallpaperShuffle" : "wallpaperLoop");
  const meta = t(locale, shuffle ? "wallpaperShuffleMeta" : "wallpaperLoopMeta");
  const Glyph = shuffle ? Shuffle : Repeat;

  return (
    <div className="group min-w-0">
      <TileFrame selected={selected}>
        <button
          type="button"
          onClick={() => selectPlay(album, play)}
          aria-pressed={selected}
          aria-label={`${name} — ${meta}`}
          className="absolute inset-0"
        >
          <PlayCollage wallpapers={albumWallpapers} variant={variant} fanned={shuffle} />
          <span
            className={cn(
              "absolute bottom-2 left-2 flex size-5 items-center justify-center rounded-full",
              ARTWORK_CHIP
            )}
          >
            <Glyph className="size-2.5" strokeWidth={2.25} />
          </span>
        </button>
      </TileFrame>
      <TileCaption name={name} meta={meta} />
    </div>
  );
}

/**
 * Tilt — the one control the weather tiles need under them.
 *
 * The Sky's rain and snow fall along gravity rather than down the page, which
 * is a thing the *device* can do, not a thing the wallpaper is. Where the
 * browser hands motion over freely it is already on and this row only says
 * so; on iOS it is the tap that grants it, which is why it is here in the
 * picker and not only in the devtool. It shows the effective state rather
 * than the saved wish — the switch answers "is the sky tilting", so turning
 * it on is what asks for permission — and it is only shown when the Sky is
 * what paints, because it is the only style with drops to lean.
 */
function WeatherTiltRow() {
  const { locale } = useLocale();
  const { gyro, setGyroEnabled } = useWallpaper();
  if (!gyro.supported) return null;

  let note: TranslationKey = "wallpaperTiltNote";
  if (gyro.denied) note = "wallpaperTiltDenied";
  else if (gyro.enabled && gyro.gated) note = "wallpaperTiltAsk";
  else if (gyro.active && gyro.readings === "silent") note = "wallpaperTiltSilent";

  return (
    <div className="space-y-1.5 pt-5">
      <CompactRow<"on" | "off">
        label={t(locale, "wallpaperTilt")}
        value={gyro.active ? "on" : "off"}
        options={[
          { value: "on", label: t(locale, "stateOn") },
          { value: "off", label: t(locale, "stateOff") },
        ]}
        onChange={(value) => void setGyroEnabled(value === "on")}
      />
      <p className="px-0.5 text-[11px] leading-snug text-tertiary-foreground">
        {t(locale, note)}
      </p>
    </div>
  );
}

export function WallpaperSheet() {
  const { locale } = useLocale();
  const { isPickerOpen, openPicker, closePicker } = useWallpaper();

  return (
    <AdaptiveSurface
      id="surface-wallpaper"
      open={isPickerOpen}
      onOpenChange={(open) => (open ? openPicker() : closePicker())}
      presentation={ADAPTIVE_PRESENTATION}
      title={t(locale, "wallpaperTitle")}
      closeLabel={t(locale, "wallpaperClose")}
      windowWidth="min(92vw, 620px)"
      // On a phone: the site's detents — level with whatever it is stacked
      // on, and a drag carries it to the top for the whole catalog at once.
      snapPoints={SHEET_DETENTS}
    >
      {/* Remount on open so the tab matches the live wallpaper; the sheet
          stays mounted while closed and would otherwise keep a stale album. */}
      <WallpaperPickerBody key={isPickerOpen ? "open" : "closed"} />
    </AdaptiveSurface>
  );
}

const CATEGORY_LABEL: Record<WallpaperCategory, TranslationKey> = {
  weather: "wallpaperCategoryWeather",
  apple: "wallpaperCategoryApple",
  nature: "wallpaperCategoryNature",
};

/**
 * The picker's content, unaware of which shape it landed in beyond the one
 * thing that genuinely differs: a desktop window is wide enough for three
 * columns of pair cards, a phone sheet is not.
 */
export function WallpaperPickerBody({ wide }: { wide?: boolean }) {
  const { locale } = useLocale();
  const {
    kind,
    weatherStyle,
    effectiveStyle,
    wallpapers,
    wallpaper: active,
    placement,
    setPlacement,
    play,
    playAlbum,
    playEvery,
    setPlayEvery,
  } = useWallpaper();
  const { followSun, setFollowSun } = useSolarTheme();
  const isImage = kind === "image";
  const surface = useOptionalSurfaceContext();
  const columns = wide || surface?.isWindow ? 3 : 2;

  // Opens on the category of what is in use, so the check mark is on screen.
  const [category, setCategory] = useState<WallpaperCategory>(
    isImage ? (playAlbum ?? active.category) : "weather"
  );
  const categories = WALLPAPER_CATEGORIES.map((id) => ({
    id,
    title: t(locale, CATEGORY_LABEL[id]),
  }));
  const shown = wallpapers.filter((w) => w.category === category);
  const playAlbumCategory = category === "apple" || category === "nature" ? category : null;
  const playSelected = isImage && play !== "off" && playAlbum === playAlbumCategory;

  const options: { value: WallpaperPlacement; label: string }[] = [
    { value: "full", label: t(locale, "wallpaperPlacementFull") },
    { value: "widget", label: t(locale, "wallpaperPlacementWidget") },
    { value: "off", label: t(locale, "wallpaperPlacementOff") },
  ];

  const frequencyOptions: { value: WallpaperPlayEvery; label: string }[] = [
    { value: "visit", label: t(locale, "wallpaperPlayEveryVisit") },
    { value: "hourly", label: t(locale, "wallpaperPlayEveryHourly") },
    { value: "daily", label: t(locale, "wallpaperPlayEveryDaily") },
  ];

  return (
    <>
      {/* Placement — where the active wallpaper paints, or nowhere. One compact
          row: it is a modifier, not the thing you came here for. */}
      <div className="pb-4 pt-1">
        <CompactRow
          label={t(locale, "wallpaperPlacement")}
          value={placement}
          options={options}
          onChange={setPlacement}
        />
      </div>

      {/* The label and the categories on one line, like Placement above. */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <SectionLabel>{t(locale, "wallpaperChoose")}</SectionLabel>
        <AlbumTabs
          albums={categories}
          activeIndex={WALLPAPER_CATEGORIES.indexOf(category)}
          onSelect={(i) => setCategory(WALLPAPER_CATEGORIES[i])}
          raised={false}
        />
      </div>
      {playAlbumCategory && (
        <div className="space-y-3 pb-4">
          <div
            className="grid gap-x-3"
            // Same cell size as the catalog: two columns of an N-col grid, so
            // Shuffle / Loop do not inflate to half-width on the desktop.
            style={{
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              ...(columns > 2
                ? {
                    maxWidth: `calc((100% - ${(columns - 1) * 0.75}rem) / ${columns} * 2 + 0.75rem)`,
                  }
                : null),
            }}
          >
            {(["shuffle", "loop"] as const).map((mode) => (
              <PlayTile
                key={mode}
                album={playAlbumCategory}
                play={mode}
                selected={playSelected && play === mode}
              />
            ))}
          </div>
          {playSelected && (
            <CompactRow<WallpaperPlayEvery>
              label={t(locale, "wallpaperPlayFrequency")}
              value={playEvery}
              options={frequencyOptions}
              onChange={setPlayEvery}
            />
          )}
        </div>
      )}
      <div
        className="grid gap-x-3 gap-y-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {category === "weather" &&
          WEATHER_STYLES.map((style) => (
            <WeatherStyleTile
              key={style}
              style={style}
              selected={!isImage && weatherStyle === style}
            />
          ))}
        {shown.map((w) => (
          <WallpaperTile
            key={w.id}
            wallpaper={w}
            selected={isImage && play === "off" && active.id === w.id}
          />
        ))}
      </div>

      {/* Sunrise and sunset move the theme, not the wallpaper — but they are
          the weather system's own events, so this is where they are turned
          off. One row, the same shape as Placement. */}
      {category === "weather" && (
        <div className="space-y-2 pt-5">
          <CompactRow<"on" | "off">
            label={t(locale, "settingsSolarTheme")}
            value={followSun ? "on" : "off"}
            options={[
              { value: "on", label: t(locale, "stateOn") },
              { value: "off", label: t(locale, "stateOff") },
            ]}
            onChange={(value) => setFollowSun(value === "on")}
          />
          <p className="px-0.5 text-[11px] leading-snug text-tertiary-foreground">
            {t(locale, "solarThemeHint")}
          </p>
        </div>
      )}
      {category === "weather" && effectiveStyle === "sky" && <WeatherTiltRow />}

      {category !== "weather" && (
        <p className="px-0.5 pt-5 text-[11px] leading-snug text-tertiary-foreground">
          {t(locale, "wallpaperFooterNote")}
        </p>
      )}
    </>
  );
}
