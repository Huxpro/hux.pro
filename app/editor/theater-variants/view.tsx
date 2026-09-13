"use client";

import { cn } from "@/lib/utils";
import { buildTalkAlbums } from "@/systems/theater/lib/albums";
import type { Track } from "@/systems/theater/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minimize2,
  PictureInPicture2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

// =============================================================================
// Theater chrome variants — reference gallery
//
// Static mockups of the fullscreen theater margins. Production now ships the
// "Frosted system": A’s clustered toolbar material (same glass as AlbumTabs /
// Featured Talks) with D’s airier gutters. Other letters remain for comparison.
// =============================================================================

type VariantId = "shipped" | "current" | "toolbar" | "liquid" | "bar" | "airy";

const VARIANTS: {
  id: VariantId;
  name: string;
  inspo: string;
  pitch: string;
}[] = [
  {
    id: "shipped",
    name: "★ Shipped · Frosted system (A material + D air)",
    inspo: "AlbumTabs / Featured Talks glass",
    pitch:
      "Same frosted track + pill as the homepage widget. Window controls share one glass capsule; gutters match D’s air. This is production.",
  },
  {
    id: "current",
    name: "Old baseline",
    inspo: "Pre-redesign",
    pitch:
      "Four tight circular discs, 8–12px gutters, chrome hugs the stage — the dense “strong circles” feel.",
  },
  {
    id: "toolbar",
    name: "A · Frosted Toolbar",
    inspo: "iPadOS floating toolbar",
    pitch:
      "Window controls share one glass capsule. Material matches the widget; spacing moderate.",
  },
  {
    id: "liquid",
    name: "B · Liquid Glass",
    inspo: "visionOS / recent iOS glass",
    pitch:
      "More refractive fill + specular rim. Larger soft orbs, pushed farther into the gutter.",
  },
  {
    id: "bar",
    name: "C · Continuous Bar",
    inspo: "macOS / tvOS chrome bar",
    pitch:
      "Top frosted strip + bottom glass playlist shelf. Clearest hierarchy, different from widget tabs.",
  },
  {
    id: "airy",
    name: "D · Airy Minimal",
    inspo: "Apple TV + Photos immersive",
    pitch:
      "Maximum spacing, lightest material. Spacing inspiration for the shipped system.",
  },
];

export function TheaterVariantsView() {
  const albums = useMemo(() => buildTalkAlbums("en"), []);
  const [albumIndex, setAlbumIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const album = albums[albumIndex] ?? albums[0];
  const track = album?.tracks[trackIndex] ?? album?.tracks[0];

  const selectAlbum = (index: number) => {
    setAlbumIndex(index);
    setTrackIndex(0);
  };

  if (!album || !track) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-muted-foreground">
        No talk albums available.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12 space-y-12">
        <header className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-wider text-white/40">
            Design exploration · /editor/theater-variants
          </p>
          <h1 className="text-2xl font-medium tracking-tight text-white">
            Theater chrome variants
          </h1>
          <p className="max-w-2xl text-sm text-white/55 leading-relaxed">
            Fullscreen theater margins — album tabs, window controls, prev/next,
            title, playlist. Production uses the frosted system at the top
            (same glass as the Featured Talks AlbumTabs, clustered controls,
            airier gutters). Other variants stay for comparison.
          </p>
        </header>

        {VARIANTS.map((v) => (
          <section key={v.id} className="space-y-3" data-variant={v.id}>
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-white">{v.name}</h2>
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="font-mono uppercase tracking-wider text-white/35">
                  {v.inspo}
                </span>
                {" — "}
                {v.pitch}
              </p>
            </div>
            <TheaterMock
              variant={v.id}
              albums={albums.map((a) => a.title)}
              albumIndex={albumIndex}
              onSelectAlbum={selectAlbum}
              tracks={album.tracks}
              trackIndex={trackIndex}
              onSelectTrack={setTrackIndex}
              track={track}
            />
          </section>
        ))}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Mock stage + chrome
// ---------------------------------------------------------------------------

function TheaterMock({
  variant,
  albums,
  albumIndex,
  onSelectAlbum,
  tracks,
  trackIndex,
  onSelectTrack,
  track,
}: {
  variant: VariantId;
  albums: string[];
  albumIndex: number;
  onSelectAlbum: (i: number) => void;
  tracks: Track[];
  trackIndex: number;
  onSelectTrack: (i: number) => void;
  track: Track;
}) {
  const spacing = SPACING[variant];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-black ring-1 ring-white/10",
      )}
    >
      {/* Backdrop wash */}
      <div
        className={cn(
          "absolute inset-0",
          variant === "liquid"
            ? "bg-neutral-900/90 backdrop-blur-2xl"
            : variant === "airy"
              ? "bg-black/70"
              : "bg-black/80",
        )}
      />

      <div
        className="relative mx-auto flex flex-col"
        style={{
          paddingTop: spacing.padY,
          paddingBottom: spacing.padY,
          paddingLeft: spacing.padX,
          paddingRight: spacing.padX,
          maxWidth: 880,
        }}
      >
        {/* Top chrome */}
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: spacing.topGap, minHeight: spacing.topH }}
        >
          <AlbumTabsMock
            variant={variant}
            albums={albums}
            active={albumIndex}
            onSelect={onSelectAlbum}
          />
          <WindowControls variant={variant} />
        </div>

        {/* Stage row with side arrows */}
        <div className="relative flex items-center">
          <SideArrow variant={variant} dir="prev" gap={spacing.sideGap} />
          <div
            className={cn(
              "relative aspect-video w-full overflow-hidden bg-neutral-900",
              variant === "bar" || variant === "airy"
                ? "rounded-xl"
                : "rounded-lg",
              variant === "liquid" && "shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
              variant === "airy" && "ring-1 ring-white/10",
            )}
          >
            {track.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.thumbnail}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-80"
              />
            ) : (
              <div className="absolute inset-0 bg-neutral-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/40 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-white/70 backdrop-blur-md">
                Stage
              </span>
            </div>
          </div>
          <SideArrow variant={variant} dir="next" gap={spacing.sideGap} />
        </div>

        {/* Bottom */}
        <div style={{ marginTop: spacing.bottomGap }}>
          {variant === "bar" || variant === "liquid" ? (
            <div
              className={cn(
                "rounded-2xl p-4",
                variant === "bar"
                  ? "bg-white/[0.06] ring-1 ring-white/10 backdrop-blur-2xl"
                  : "bg-white/[0.04] ring-1 ring-white/8 backdrop-blur-xl",
              )}
            >
              <TitleRow track={track} />
              <PlaylistMock
                variant={variant}
                tracks={tracks}
                active={trackIndex}
                onSelect={onSelectTrack}
              />
            </div>
          ) : (
            <>
              <TitleRow track={track} airy={variant === "airy" || variant === "shipped"} />
              <PlaylistMock
                variant={variant}
                tracks={tracks}
                active={trackIndex}
                onSelect={onSelectTrack}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const SPACING: Record<
  VariantId,
  { padX: number; padY: number; topGap: number; topH: number; sideGap: number; bottomGap: number }
> = {
  shipped: { padX: 64, padY: 40, topGap: 24, topH: 44, sideGap: 20, bottomGap: 28 },
  current: { padX: 48, padY: 28, topGap: 12, topH: 36, sideGap: 8, bottomGap: 16 },
  toolbar: { padX: 56, padY: 36, topGap: 20, topH: 44, sideGap: 16, bottomGap: 24 },
  liquid: { padX: 64, padY: 40, topGap: 24, topH: 48, sideGap: 20, bottomGap: 28 },
  bar: { padX: 40, padY: 32, topGap: 16, topH: 48, sideGap: 14, bottomGap: 20 },
  airy: { padX: 72, padY: 44, topGap: 28, topH: 44, sideGap: 24, bottomGap: 32 },
};

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function AlbumTabsMock({
  variant,
  albums,
  active,
  onSelect,
}: {
  variant: VariantId;
  albums: string[];
  active: number;
  onSelect: (i: number) => void;
}) {
  const inBar = variant === "bar";
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full p-0.5",
        inBar
          ? "bg-transparent"
          : variant === "liquid"
            ? "bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-2xl"
            : variant === "airy"
              ? "bg-white/[0.05] ring-1 ring-white/10 backdrop-blur-xl"
              : "bg-white/[0.07] ring-1 ring-white/12 backdrop-blur-xl",
      )}
    >
      {albums.map((title, i) => {
        const on = i === active;
        return (
          <button
            key={title}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
              on ? "text-white" : "text-white/45 hover:text-white/70",
            )}
          >
            {on && (
              <span
                className={cn(
                  "absolute inset-0 -z-10 rounded-full",
                  variant === "liquid"
                    ? "bg-white/20 shadow-sm ring-1 ring-white/25"
                    : "bg-white/15 ring-1 ring-white/20",
                )}
              />
            )}
            <span className="relative z-10">{title}</span>
          </button>
        );
      })}
    </div>
  );
}

function WindowControls({ variant }: { variant: VariantId }) {
  const icons = [
    { Icon: ExternalLink, label: "Source" },
    { Icon: PictureInPicture2, label: "PiP" },
    { Icon: Minimize2, label: "Minimize" },
    { Icon: X, label: "Close" },
  ] as const;

  if (variant === "current") {
    return (
      <div className="flex items-center gap-2">
        {icons.map(({ Icon, label }, i) => (
          <span
            key={label}
            title={label}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-full",
              "bg-white/10 text-white/80 ring-1 ring-white/15",
              i === 0 && "mr-1",
            )}
          >
            <Icon className={label === "Close" ? "h-5 w-5" : "h-4 w-4"} />
          </span>
        ))}
      </div>
    );
  }

  if (variant === "shipped" || variant === "toolbar" || variant === "airy") {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-full p-1 backdrop-blur-xl",
          variant === "airy"
            ? "gap-0.5 bg-white/[0.06] ring-1 ring-white/12"
            : variant === "shipped"
              ? "gap-0.5 bg-white/[0.08] ring-1 ring-white/15"
              : "gap-1 bg-white/[0.10] ring-1 ring-white/18",
        )}
      >
        {icons.map(({ Icon, label }) => (
          <span
            key={label}
            title={label}
            className={cn(
              "inline-flex items-center justify-center rounded-full text-white/85 transition-colors",
              variant === "airy" ? "h-9 w-9" : "h-10 w-10",
            )}
          >
            <Icon className={label === "Close" ? "h-5 w-5" : "h-4 w-4"} />
          </span>
        ))}
      </div>
    );
  }

  if (variant === "liquid") {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.12] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/20 backdrop-blur-2xl">
        {icons.map(({ Icon, label }, i) => (
          <span
            key={label}
            title={label}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-full text-white/90",
              i === 0 && "mr-1",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ))}
      </div>
    );
  }

  // bar — flat in the continuous strip, with a trailing close
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] p-1 ring-1 ring-white/12 backdrop-blur-xl">
      {icons.map(({ Icon, label }) => (
        <span
          key={label}
          title={label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/80"
        >
          <Icon className="h-4 w-4" />
        </span>
      ))}
    </div>
  );
}

function SideArrow({
  variant,
  dir,
  gap,
}: {
  variant: VariantId;
  dir: "prev" | "next";
  gap: number;
}) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const style =
    dir === "prev" ? { marginRight: gap } : { marginLeft: gap };

  if (variant === "current") {
    return (
      <span
        style={style}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15"
      >
        <Icon className="h-6 w-6" />
      </span>
    );
  }

  if (variant === "liquid") {
    return (
      <span
        style={style}
        className={cn(
          "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          "bg-white/[0.12] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
          "ring-1 ring-white/20 backdrop-blur-2xl",
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
    );
  }

  if (variant === "airy") {
    return (
      <span
        style={style}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70 ring-1 ring-white/10 backdrop-blur-xl"
      >
        <Icon className="h-5 w-5" />
      </span>
    );
  }

  // toolbar / bar — slightly larger glass disc with more air
  return (
    <span
      style={style}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.10] text-white/85 ring-1 ring-white/18 backdrop-blur-xl"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function TitleRow({ track, airy }: { track: Track; airy?: boolean }) {
  return (
    <div className={cn("mb-3 min-w-0", airy && "mb-4")}>
      <div className={cn("truncate font-medium text-white", airy ? "text-base" : "text-sm")}>
        {track.title}
      </div>
      {track.subtitle && (
        <div className="truncate text-xs font-mono uppercase tracking-wide text-white/45">
          {track.subtitle}
        </div>
      )}
    </div>
  );
}

function PlaylistMock({
  variant,
  tracks,
  active,
  onSelect,
}: {
  variant: VariantId;
  tracks: Track[];
  active: number;
  onSelect: (i: number) => void;
}) {
  const gap =
    variant === "airy" || variant === "shipped"
      ? "gap-4"
      : variant === "liquid" || variant === "toolbar"
        ? "gap-4"
        : "gap-3";
  const width =
    variant === "airy" || variant === "shipped"
      ? "w-44"
      : variant === "liquid"
        ? "w-[10.5rem]"
        : "w-40";

  return (
    <div className={cn("flex overflow-x-auto no-scrollbar", gap)}>
      {tracks.map((t, i) => {
        const on = i === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "shrink-0 text-left transition-opacity",
              width,
              on ? "opacity-100" : "opacity-55 hover:opacity-90",
            )}
          >
            <div
              className={cn(
                "relative aspect-video overflow-hidden rounded-lg bg-neutral-800",
                on
                  ? variant === "liquid"
                    ? "ring-1 ring-white/45"
                    : "ring-1 ring-white/40"
                  : "ring-1 ring-white/10",
              )}
            >
              {t.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="mt-1.5 truncate text-xs text-white/90">{t.title}</div>
            {t.subtitle && (
              <div className="truncate text-[10px] font-mono uppercase tracking-wide text-white/40">
                {t.subtitle}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
