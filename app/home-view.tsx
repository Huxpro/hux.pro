"use client";

import { AppFolder } from "@/components/apps";
import {
  HStackWidget,
  VStackWidget,
} from "@/components/home/featured-stack-widget";
import { FeaturedTalksWidget } from "@/components/home/featured-talks-widget";
import {
  ProcessingWidget,
  buildProcessingCommits,
} from "@/components/home/processing-widget";
import { PromptWidget } from "@/components/home/prompt-widget";
import { ScrambleIdentifier } from "@/components/home/scramble-identifier";
import { WritingWidget } from "@/components/home/writing-widget";
import { Commit } from "@/components/log";
import { HeaderZone } from "@/components/ui/header-zone";
import {
  SortableMasonry,
  type SortableWidget,
} from "@/components/ui/sortable-masonry";
import { useHeroFade } from "@/components/ui/use-hero-fade";
import type { BlogPostSummary } from "@/lib/content";
import logData from "@/content/log.json";
import type { Commit as CommitData, Group, RawLogData } from "@/lib/log";
import { localize, normalizeLogData, resolveGroupCommits } from "@/lib/log";
import { enrichLogDataWithPreviews, type OGSnapshot } from "@/lib/og-enrich";
import ogSnapshotJson from "@/content/og-snapshot.json";
import { useLocale } from "@/services";
import { AmbientGreeting, WeatherWidget } from "@/systems/ambient";
import { MusicWidget } from "@/systems/music";
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

function WidgetGrid({ posts }: { posts: BlogPostSummary[] }) {
  const { locale } = useLocale();

  // Resolve presence up-front so conditionally-empty widgets never occupy an
  // empty, draggable slot in the masonry.
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

  const items: SortableWidget[] = [
    { id: "apps", node: <AppFolder /> },
    { id: "weather", node: <WeatherWidget /> },
    { id: "blog", node: <WritingWidget posts={posts} /> },
    { id: "music", node: <MusicWidget /> },
    // Keeps the legacy "status" id so visitors' persisted grid order survives
    // the widget's change of shape.
    ...(processingCommits.length > 0
      ? [
          {
            id: "status",
            node: (
              <ProcessingWidget log={log} commits={processingCommits} />
            ),
          },
        ]
      : []),
    { id: "featured-talks", node: <FeaturedTalksWidget /> },
    { id: "prompt", node: <PromptWidget /> },
    ...visibleGroups.map((group) => ({
      id: `group-${group.id}`,
      node: <GroupWidget group={group} />,
    })),
  ];

  return (
    <SortableMasonry items={items} className="relative z-20 pt-2 sm:pt-4 mb-16" />
  );
}

// =============================================================================
// Main Homepage
// =============================================================================

export function HomeView({ posts }: { posts: BlogPostSummary[] }) {
  const heroFadeStyle = useHeroFade();

  return (
    <main className="mx-auto w-full px-6 pt-16 sm:pt-24 pb-32 sm:pb-40">
      <div className="mx-auto max-w-[680px]">
        <HeaderZone
          className="hero-zone-fade sticky top-16 sm:top-24 z-10 mb-4 sm:mb-6"
          style={heroFadeStyle}
        >
          <div className="h-11 flex items-start justify-center">
            <ScrambleIdentifier />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center pb-6 sm:pb-4">
            <AmbientGreeting />
          </div>
        </HeaderZone>
      </div>

      {/* Widget grid — widens to three columns on large screens */}
      <div className="mx-auto max-w-[680px] lg:max-w-5xl">
        <WidgetGrid posts={posts} />
      </div>
    </main>
  );
}
