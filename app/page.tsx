"use client";

import { AppFolder } from "@/components/apps";
import {
  HStackWidget,
  VStackWidget,
} from "@/components/home/featured-stack-widget";
import { FeaturedTalksWidget } from "@/components/home/featured-talks-widget";
import { PromptWidget } from "@/components/home/prompt-widget";
import { Commit } from "@/components/log";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { HeaderZone } from "@/components/ui/header-zone";
import {
  SortableMasonry,
  type SortableWidget,
} from "@/components/ui/sortable-masonry";
import { useHeroFade } from "@/components/ui/use-hero-fade";
import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetStatus,
  WidgetTitle,
} from "@/components/ui/widget";
import logData from "@/content/log.json";
import { getLocalizedTitle, getPostHref, shouldShowPost } from "@/lib/content";
import { blogPosts } from "@/lib/data";
import type {
  Commit as CommitData,
  Group,
  RawLogData,
  RoleCommit,
} from "@/lib/log";
import {
  isCommitListed,
  isCommitVisibleIn,
  isRoleCommit,
  localize,
  normalizeLogData,
  resolveGroupCommits,
} from "@/lib/log";
import { enrichLogDataWithPreviews, type OGSnapshot } from "@/lib/og-enrich";
import ogSnapshotJson from "@/content/og-snapshot.json";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AmbientGreeting, WeatherWidget } from "@/systems/ambient";
import { MusicWidget } from "@/systems/music";
import { ALBUM_GROUP_IDS } from "@/systems/theater/lib/albums";
import { Link } from "next-view-transitions";
import { useState } from "react";

// =============================================================================
// Widget Components
// =============================================================================

function BlogStackWidget() {
  const { locale } = useLocale();
  const recentPosts = blogPosts
    .filter((post) => shouldShowPost(post, locale, false))
    .slice(0, 3);

  return (
    <VStackWidget title={t(locale, "widgetBlog")} href="/writing">
      {recentPosts.map((post) => (
        <Link
          key={post.slug}
          href={getPostHref(post, locale, "/writing")}
          className="block group/item"
        >
          <div className="text-sm text-foreground group-hover/item:text-foreground/80 transition-colors truncate">
            {getLocalizedTitle(post, locale)}
          </div>
          <div className="text-xs font-mono text-muted-foreground mt-0.5">
            {post.date}
          </div>
        </Link>
      ))}
    </VStackWidget>
  );
}

// Enrich with OG previews (same as /works and the editor preview do) so link
// cards resolve their cover image from the snapshot — otherwise widget covers
// that rely on OG images (e.g. GitNation talk cards) render empty.
const log = enrichLogDataWithPreviews(
  normalizeLogData(logData as unknown as RawLogData),
  ogSnapshotJson as OGSnapshot,
);

function getCurrentRoleCommit(commits: CommitData[]): RoleCommit | null {
  const roles = commits.filter(isRoleCommit).filter(isCommitListed);
  if (roles.length === 0) return null;

  const key = (c: RoleCommit) =>
    c.endDate === "present" ? "9999-12" : (c.endDate ?? c.date);

  return [...roles].sort((a, b) => key(b).localeCompare(key(a)))[0] ?? null;
}

function ProcessingWidget() {
  const { locale } = useLocale();
  const visible = (log.commits as CommitData[]).filter((c) =>
    isCommitVisibleIn(c, locale),
  );
  const role = getCurrentRoleCommit(visible);
  if (!role) return null;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-3">
        <div className="flex items-center gap-2">
          <WidgetStatus />
          <WidgetTitle>{t(locale, "widgetStatus")}</WidgetTitle>
        </div>
        <WidgetLink href="/works" label="View works" />
      </WidgetHeader>
      <WidgetBody>
        <Commit commit={role} locale={locale} variant="bare" />
      </WidgetBody>
    </WidgetShell>
  );
}

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

function WidgetGrid() {
  const { locale } = useLocale();

  // Resolve presence up-front so conditionally-empty widgets never occupy an
  // empty, draggable slot in the masonry.
  const visibleCommits = (log.commits as CommitData[]).filter((c) =>
    isCommitVisibleIn(c, locale),
  );
  const role = getCurrentRoleCommit(visibleCommits);
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
    { id: "blog", node: <BlogStackWidget /> },
    { id: "music", node: <MusicWidget /> },
    ...(role ? [{ id: "status", node: <ProcessingWidget /> }] : []),
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
// Text Scramble System Identifier Component
// =============================================================================

function ScrambleIdentifier() {
  const [isHovered, setIsHovered] = useState(false);
  const targetText = isHovered ? "λHUX" : "λhux";

  return (
    <div className="flex justify-center">
      <span
        data-view-transition="site-identifier"
        className={cn(
          "font-mono text-xs tracking-wider relative inline-block cursor-default transition-colors duration-300",
          isHovered ? "text-foreground" : "text-muted-foreground",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TextScramble
          trigger={true}
          duration={0.6}
          speed={0.03}
          characterSet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
          as="span"
          className="inline-block"
        >
          {targetText}
        </TextScramble>
      </span>
    </div>
  );
}

// =============================================================================
// Main Homepage
// =============================================================================

export default function Home() {
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
        <WidgetGrid />
      </div>
    </main>
  );
}
