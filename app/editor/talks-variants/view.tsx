"use client";

import { ExternalImage } from "@/components/log/media/external-image";
import { PlayBadge } from "@/components/log/media/play-badge";
import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { buildTalkAlbums } from "@/systems/theater/lib/albums";
import type { Album, Track } from "@/systems/theater/lib/types";
import { Play } from "lucide-react";
import { useMemo, useState } from "react";

// =============================================================================
// Talks design variants — pick-one gallery
//
// Side-by-side chrome alternatives for the Featured Talks widget + playlist
// selection. Production components stay untouched until one variant is chosen.
// =============================================================================

type VariantId = "current" | "soft" | "cover" | "music" | "glass";

const VARIANTS: {
  id: VariantId;
  name: string;
  pitch: string;
  inspo: string;
}[] = [
  {
    id: "current",
    name: "Current",
    pitch: "Solid inverted album pill + centered black play disc on every cover.",
    inspo: "Baseline",
  },
  {
    id: "soft",
    name: "A · Soft Select",
    pitch:
      "Selected album is a quiet fill (not black). Play stays, but lighter. Selection still obvious without stealing the cover.",
    inspo: "iOS segmented control (muted) + App Store cards",
  },
  {
    id: "cover",
    name: "B · Cover First",
    pitch:
      "Underline tabs, no play disc at rest — hover reveals a small corner play. The video art is the hero; selection is typography + opacity.",
    inspo: "YouTube / Netflix shelf",
  },
  {
    id: "music",
    name: "C · Music Kin",
    pitch:
      "Matches the Music widget: mono label tabs, green active cue, no black circles. Play is a quiet glyph control, not a stamped disc.",
    inspo: "Homepage Music widget",
  },
  {
    id: "glass",
    name: "D · Glass Capsule",
    pitch:
      "Sliding glass pill for the album (selected without inversion). Translucent white play. Active track uses a hairline, not a heavy ring.",
    inspo: "Dock Live Activity + widget glass",
  },
];

export function TalksVariantsView() {
  const albums = useMemo(() => buildTalkAlbums("en"), []);
  const [activeAlbum, setActiveAlbum] = useState(0);
  const [activeTrack, setActiveTrack] = useState(0);
  const album = albums[activeAlbum] ?? albums[0];

  if (!album) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-sm text-muted-foreground">
        No talk albums available.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Design exploration · /editor/talks-variants
          </p>
          <h1 className="text-2xl font-medium tracking-tight">
            Featured Talks chrome variants
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
            Goal: keep album + track selection readable for developers, but stop
            the solid black pill and heavy play discs from competing with the
            video. Pick a letter — production can adopt that one.
          </p>
          <p className="text-xs text-muted-foreground">
            Shared state: switching albums/tracks below updates every card so
            you can compare the same selection across styles.
          </p>
        </header>

        <div className="space-y-12">
          {VARIANTS.map((v) => (
            <section key={v.id} className="space-y-3" data-variant={v.id}>
              <div className="space-y-1">
                <h2 className="text-sm font-medium">{v.name}</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-mono uppercase tracking-wider text-foreground/50">
                    {v.inspo}
                  </span>
                  {" — "}
                  {v.pitch}
                </p>
              </div>
              <VariantCard
                variant={v.id}
                albums={albums}
                album={album}
                activeAlbum={activeAlbum}
                activeTrack={activeTrack}
                onSelectAlbum={setActiveAlbum}
                onSelectTrack={setActiveTrack}
              />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function VariantCard({
  variant,
  albums,
  album,
  activeAlbum,
  activeTrack,
  onSelectAlbum,
  onSelectTrack,
}: {
  variant: VariantId;
  albums: Album[];
  album: Album;
  activeAlbum: number;
  activeTrack: number;
  onSelectAlbum: (i: number) => void;
  onSelectTrack: (i: number) => void;
}) {
  return (
    <WidgetShell>
      <WidgetHeader className="pb-3">
        <WidgetTitle>Featured Talks</WidgetTitle>
        <WidgetLink href="/works" />
      </WidgetHeader>

      <div className="px-5 pb-3">
        <Tabs
          variant={variant}
          albums={albums}
          activeIndex={activeAlbum}
          onSelect={onSelectAlbum}
        />
      </div>

      <div className="pb-5">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pl-5 pr-5">
          {album.tracks.map((track, i) => {
            const active = i === activeTrack;
            return (
              <button
                key={`${variant}-${track.id}`}
                type="button"
                onClick={() => onSelectTrack(i)}
                className={cn(
                  "group/thumb w-[86%] max-w-[200px] shrink-0 text-left",
                  thumbButtonClass(variant, active),
                )}
              >
                <Thumb
                  variant={variant}
                  track={track}
                  active={active}
                />
                <div
                  className={cn(
                    "mt-2 truncate text-sm",
                    active ? "text-foreground" : "text-foreground/80",
                    variant === "cover" && active && "font-medium",
                    variant === "music" && active && "font-medium",
                  )}
                >
                  {track.title}
                </div>
                {track.subtitle && (
                  <div className="mt-0.5 truncate text-xs font-mono uppercase tracking-wide text-muted-foreground">
                    {track.subtitle}
                  </div>
                )}
              </button>
            );
          })}
          <div className="w-5 shrink-0" aria-hidden />
        </div>

        {album.tracks.length > 1 && (
          <Dots
            variant={variant}
            count={album.tracks.length}
            active={activeTrack}
          />
        )}
      </div>
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function Tabs({
  variant,
  albums,
  activeIndex,
  onSelect,
}: {
  variant: VariantId;
  albums: Album[];
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  if (variant === "current") {
    return (
      <div
        role="tablist"
        className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/60 p-1 backdrop-blur-xl"
      >
        {albums.map((album, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={album.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(i)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {album.title}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "soft") {
    return (
      <div
        role="tablist"
        className="inline-flex items-center gap-0.5 rounded-full border border-border/40 bg-muted/30 p-0.5"
      >
        {albums.map((album, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={album.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(i)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
                active
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {album.title}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "cover") {
    return (
      <div role="tablist" className="inline-flex items-end gap-4">
        {albums.map((album, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={album.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(i)}
              className={cn(
                "relative pb-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {album.title}
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 h-px transition-opacity",
                  active ? "bg-foreground/70 opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "music") {
    return (
      <div role="tablist" className="inline-flex items-center gap-3">
        {albums.map((album, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={album.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(i)}
              className={cn(
                "inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                </span>
              )}
              {album.title}
            </button>
          );
        })}
      </div>
    );
  }

  // glass
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-black/[0.03] p-1 dark:bg-white/[0.04]"
    >
      {albums.map((album, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={album.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-all",
              active
                ? "bg-card/90 text-foreground shadow-sm ring-1 ring-border/50 backdrop-blur-xl"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {album.title}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thumbnails
// ---------------------------------------------------------------------------

function thumbButtonClass(variant: VariantId, active: boolean): string {
  if (variant === "current" || variant === "soft" || variant === "glass") {
    return active ? "opacity-100" : "opacity-80 hover:opacity-100";
  }
  if (variant === "cover" || variant === "music") {
    return active ? "opacity-100" : "opacity-55 hover:opacity-90";
  }
  return "";
}

function Thumb({
  variant,
  track,
  active,
}: {
  variant: VariantId;
  track: Track;
  active: boolean;
}) {
  const frame = cn(
    "relative aspect-video w-full overflow-hidden rounded-lg bg-muted/20",
    frameClass(variant, active),
  );

  return (
    <div className={frame}>
      {track.thumbnail ? (
        <ExternalImage
          src={track.thumbnail}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {track.platform}
        </div>
      )}
      <PlayOverlay variant={variant} active={active} />
    </div>
  );
}

function frameClass(variant: VariantId, active: boolean): string {
  switch (variant) {
    case "current":
      return cn(
        "border transition-colors",
        active
          ? "border-foreground/70 ring-1 ring-foreground/40"
          : "border-border/50",
      );
    case "soft":
      return cn(
        "border transition-colors",
        active ? "border-foreground/35" : "border-border/40",
      );
    case "cover":
      return cn(
        "border border-transparent transition-[box-shadow,opacity]",
        active && "shadow-[0_0_0_1px_rgba(0,0,0,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.18)]",
      );
    case "music":
      return "border border-border/30";
    case "glass":
      return cn(
        "border transition-colors",
        active ? "border-white/50 dark:border-white/35" : "border-border/40",
      );
  }
}

function PlayOverlay({
  variant,
  active,
}: {
  variant: VariantId;
  active: boolean;
}) {
  if (variant === "current") {
    return (
      <div className="absolute inset-0 bg-black/10 transition-colors group-hover/thumb:bg-black/25">
        <PlayBadge size="compact" />
      </div>
    );
  }

  if (variant === "soft") {
    // Lighter centered play — still discoverable, less stamped.
    return (
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover/thumb:bg-black/15">
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              "bg-black/35 text-white backdrop-blur-sm",
              "opacity-80 transition-opacity group-hover/thumb:opacity-100",
              active && "opacity-0 group-hover/thumb:opacity-80",
            )}
          >
            <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
          </span>
        </span>
      </div>
    );
  }

  if (variant === "cover") {
    // No disc at rest — small corner play on hover only.
    return (
      <div className="absolute inset-0">
        <span
          className={cn(
            "pointer-events-none absolute bottom-2 right-2",
            "flex h-7 w-7 items-center justify-center rounded-md",
            "bg-black/50 text-white backdrop-blur-sm",
            "opacity-0 transition-opacity group-hover/thumb:opacity-100",
          )}
        >
          <Play className="h-3 w-3 translate-x-px" fill="currentColor" />
        </span>
        {active && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-sm bg-foreground/90 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-background">
            Playing
          </span>
        )}
      </div>
    );
  }

  if (variant === "music") {
    // Quiet affordance — like music transport, not a stamped disc.
    return (
      <div className="absolute inset-0">
        <span
          className={cn(
            "pointer-events-none absolute bottom-1.5 left-1.5",
            "flex h-6 w-6 items-center justify-center rounded-md",
            "bg-background/70 text-foreground/80 backdrop-blur-md",
            "opacity-70 transition-opacity group-hover/thumb:opacity-100",
            active && "opacity-100 text-green-600 dark:text-green-400",
          )}
        >
          <Play className="h-3 w-3 translate-x-px" fill="currentColor" />
        </span>
      </div>
    );
  }

  // glass — translucent white play, hide when selected so the cover wins
  return (
    <div className="absolute inset-0 bg-black/0 transition-colors group-hover/thumb:bg-black/10">
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            "bg-white/70 text-neutral-900 shadow-sm backdrop-blur-md",
            "ring-1 ring-black/5",
            "transition-opacity",
            active
              ? "opacity-0 group-hover/thumb:opacity-90"
              : "opacity-90 group-hover/thumb:opacity-100",
          )}
        >
          <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
        </span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page dots
// ---------------------------------------------------------------------------

function Dots({
  variant,
  count,
  active,
}: {
  variant: VariantId;
  count: number;
  active: number;
}) {
  if (variant === "music") {
    // Hairline progress instead of three strong dots
    return (
      <div className="flex justify-center px-5 pt-3">
        <div className="flex h-0.5 w-16 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-foreground/45 transition-all duration-200"
            style={{ width: `${((active + 1) / count) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === "cover") {
    return (
      <div className="flex items-center justify-center gap-1 pt-3">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-0.5 rounded-full transition-all duration-200",
              i === active ? "w-4 bg-foreground/50" : "w-2 bg-foreground/15",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-3">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-200",
            i === active ? "w-3 bg-foreground/60" : "w-1.5 bg-foreground/20",
            variant === "soft" && i === active && "bg-foreground/40",
            variant === "glass" && i === active && "bg-foreground/45",
          )}
        />
      ))}
    </div>
  );
}
