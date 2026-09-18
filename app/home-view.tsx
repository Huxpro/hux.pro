"use client";

import { AppFolder, appFolderSizes } from "@/components/apps";
import {
  HStackWidget,
  STACK_WIDGET_SIZES,
  VStackWidget,
} from "@/components/home/featured-stack-widget";
import {
  FeaturedTalksWidget,
  TALKS_WIDGET_SIZES,
} from "@/components/home/featured-talks-widget";
import {
  PROCESSING_WIDGET_SIZES,
  ProcessingWidget,
  buildProcessingCommits,
} from "@/components/home/processing-widget";
import {
  PROMPT_WIDGET_SIZES,
  PromptWidget,
} from "@/components/home/prompt-widget";
import { ScrambleIdentifier } from "@/components/home/scramble-identifier";
import {
  WRITING_WIDGET_SIZES,
  WritingWidget,
} from "@/components/home/writing-widget";
import { Commit } from "@/components/log";
import { HeaderZone } from "@/components/ui/header-zone";
import { WidgetBoard, type BoardWidget } from "@/components/ui/widget-board";
import { FEATURED_APPS } from "@/lib/apps";
import {
  heroContentClassName,
  heroZoneClassName,
  heroZoneStyle,
  useHeroExit,
  type HeroExit,
} from "@/components/ui/hero-exit";
import { useHeroFade } from "@/components/ui/use-hero-fade";
import { useLockTextSelection } from "@/components/ui/use-lock-text-selection";
import type { BlogPostSummary } from "@/lib/content";
import logData from "@/content/log.json";
import type { Commit as CommitData, Group, RawLogData } from "@/lib/log";
import { localize, normalizeLogData, resolveGroupCommits } from "@/lib/log";
import { enrichLogDataWithPreviews, type OGSnapshot } from "@/lib/og-enrich";
import ogSnapshotJson from "@/content/og-snapshot.json";
import { useLocale } from "@/services";
import { AmbientGreeting, WEATHER_WIDGET_SIZES, WeatherWidget } from "@/systems/ambient";
import { MUSIC_WIDGET_SIZES, MusicWidget } from "@/systems/music";
import { ALBUM_GROUP_IDS } from "@/systems/theater/lib/albums";

// =============================================================================
// Widget Components
// =============================================================================

// Enrich with OG previews (same as /works and the editor preview do) so link
// cards resolve their cover image from the snapshot — otherwise widget covers
// that rely on OG images (e.g. GitNation talk cards) render empty.
const log = enrichLogDataWithPreviews(
  normalizeLogData(logData as unknown as RawLogData),
  ogSnapshotJson as OGSnapshot,
);

function GroupWidget({ group }: { group: Group }) {
  const { locale } = useLocale();

  const commits = resolveGroupCommits(
    group,
    log.commits as CommitData[],
    undefined,
    locale,
  );
  if (commits.length === 0) return null;

  const title = localize(group.title, locale);
  const href = group.href ?? "/works";
  const layout = group.layout ?? "h";

  if (layout === "v") {
    return (
      <VStackWidget title={title} href={href}>
        {commits.map((commit) => (
          <Commit
            key={commit.id}
            commit={commit}
            locale={locale}
            variant="bare"
          />
        ))}
      </VStackWidget>
    );
  }

  return (
    <HStackWidget title={title} href={href}>
      {commits.map((commit) => (
        <Commit
          key={commit.id}
          commit={commit}
          locale={locale}
          variant="bare"
        />
      ))}
    </HStackWidget>
  );
}

function WidgetGrid({
  posts,
  heroExit,
}: {
  posts: BlogPostSummary[];
  heroExit: HeroExit;
}) {
  const { locale } = useLocale();

  // Resolve presence up-front so conditionally-empty widgets never occupy an
  // empty, draggable slot on the board.
  const processingCommits = buildProcessingCommits(log, locale);
  // The three featured talk groups (React / Lynx / Personal) are now unified
  // into the single album-switching FeaturedTalksWidget, so exclude them from
  // the generic group rendering.
  const albumGroupIds = new Set<string>(ALBUM_GROUP_IDS);
  const visibleGroups = (log.groups ?? []).filter(
    (group) =>
      !group.hidden &&
      !albumGroupIds.has(group.id) &&
      resolveGroupCommits(group, log.commits as CommitData[], undefined, locale)
        .length > 0,
  );

  // Each widget declares the sizes it has a design for and the one it takes
  // by default. The defaults are chosen so the default board is hole-free
  // on a desktop's six cells: apps (2) + weather (1) + music (1) + blog
  // (2×2) + projects (2×2) + talks (2×2) + prompt (2) = 18 = three full
  // rows; on a phone the two smalls pair up into one row.
  const items: BoardWidget[] = [
    {
      id: "apps",
      sizes: appFolderSizes(FEATURED_APPS.length),
      defaultSize: "medium",
      render: (size) => <AppFolder size={size} />,
    },
    {
      id: "weather",
      sizes: WEATHER_WIDGET_SIZES,
      defaultSize: "small",
      render: (size) => <WeatherWidget size={size} />,
    },
    {
      id: "music",
      sizes: MUSIC_WIDGET_SIZES,
      defaultSize: "small",
      render: (size) => <MusicWidget size={size} />,
    },
    {
      id: "blog",
      sizes: WRITING_WIDGET_SIZES,
      defaultSize: "large",
      render: (size) => <WritingWidget posts={posts} size={size} />,
    },
    // Keeps the legacy "status" id so visitors' persisted grid order survives
    // the widget's change of shape.
    ...(processingCommits.length > 0
      ? [
          {
            id: "status",
            sizes: PROCESSING_WIDGET_SIZES,
            defaultSize: "large",
            render: (size) => (
              <ProcessingWidget
                log={log}
                commits={processingCommits}
                size={size}
              />
            ),
          } satisfies BoardWidget,
        ]
      : []),
    {
      id: "featured-talks",
      sizes: TALKS_WIDGET_SIZES,
      defaultSize: "large",
      render: (size) => <FeaturedTalksWidget size={size} />,
    },
    {
      id: "prompt",
      sizes: PROMPT_WIDGET_SIZES,
      defaultSize: "medium",
      render: (size) => <PromptWidget size={size} />,
    },
    ...visibleGroups.map(
      (group): BoardWidget => ({
        id: `group-${group.id}`,
        sizes: STACK_WIDGET_SIZES,
        defaultSize: "large",
        render: () => <GroupWidget group={group} />,
      }),
    ),
  ];

  return (
    <WidgetBoard
      items={items}
      className={heroContentClassName(heroExit, "pt-2 sm:pt-4 mb-16")}
    />
  );
}

// =============================================================================
// Main Homepage
// =============================================================================

export function HomeView({ posts }: { posts: BlogPostSummary[] }) {
  const heroExit = useHeroExit();
  const heroFadeStyle = useHeroFade(heroExit === "fade");
  // iOS will otherwise expand a long-press into a full-page selection.
  useLockTextSelection();

  return (
    // The home screen is one composition (identifier → greeting → widget grid),
    // not a document that starts at the top. `min-h-svh` + auto margins on the
    // inner block let it sit optically centered in the viewport once there is
    // room to spare (tall desktops, iPad Pro portrait) while collapsing to the
    // old top-anchored layout the moment the content is taller than the screen
    // — phones, tablets and normal laptops lay out exactly as before.
    // Auto margins (rather than `justify-center`) are what make that safe: an
    // overflowing composition still starts at the top edge instead of being
    // clipped above it.
    <main className="system-surface select-none mx-auto flex min-h-svh w-full flex-col px-6 pt-16 sm:pt-24 pb-32 sm:pb-40">
      <div className="my-auto w-full">
        <div className="mx-auto max-w-[680px]">
          <HeaderZone
            // Identifier → greeting → grid is a fixed rhythm: the hero keeps
            // its default height at every size, so only the composition as a
            // whole moves when there is room to spare, never its internals.
            // `ink-bare`: nothing behind this text but the wallpaper, so it
            // is the zone read off the top band whose ink may flip; the app folder is
            // the other, read off the middle band (see docs/system-legibility.md).
            data-hero-exit={heroExit}
            className={heroZoneClassName(
              heroExit,
              !heroFadeStyle,
              "ink-bare select-none"
            )}
            style={heroZoneStyle(heroExit, heroFadeStyle)}
          >
            <div className="h-11 flex items-start justify-center">
              <ScrambleIdentifier />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center pb-6 sm:pb-4">
              <AmbientGreeting />
            </div>
          </HeaderZone>
        </div>

        {/* Widget board — owns its own responsive width so column count and
            cell size stay in step (see `.widget-board` in globals.css). */}
        <WidgetGrid posts={posts} heroExit={heroExit} />
      </div>
    </main>
  );
}
