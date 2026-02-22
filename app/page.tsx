"use client";

import {
  HStackWidget,
  VStackWidget,
} from "@/components/home/featured-stack-widget";
import { PromptWidget } from "@/components/home/prompt-widget";
import { Commit } from "@/components/log";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetStatus,
  WidgetTitle,
} from "@/components/ui/widget";
import logData from "@/content/log.json";
import { getLocalizedTitle, getPostHref } from "@/lib/content";
import { blogPosts } from "@/lib/data";
import type { Commit as CommitData, Group, LogData, RoleCommit } from "@/lib/log";
import {
  isCommitListed,
  isRoleCommit,
  localize,
  resolveGroupCommits,
} from "@/lib/log";
import { HeaderZone } from "@/components/ui/header-zone";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AmbientGreeting, WeatherWidget } from "@/systems/ambient";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

// =============================================================================
// Widget Components
// =============================================================================

function BlogStackWidget() {
  const { locale } = useLocale();
  const recentPosts = blogPosts.slice(0, 3);

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

const log = logData as unknown as LogData;

function getCurrentRoleCommit(commits: CommitData[]): RoleCommit | null {
  const roles = commits.filter(isRoleCommit).filter(isCommitListed);
  if (roles.length === 0) return null;

  const key = (c: RoleCommit) =>
    c.endDate === "present" ? "9999-12" : (c.endDate ?? c.date);

  return [...roles].sort((a, b) => key(b).localeCompare(key(a)))[0] ?? null;
}

function ProcessingWidget() {
  const { locale } = useLocale();
  const role = getCurrentRoleCommit(log.commits as CommitData[]);
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

  const commits = resolveGroupCommits(group, log.commits as CommitData[]);
  if (commits.length === 0) return null;

  const title = localize(group.title, locale);
  const href = group.href ?? "/works";
  const layout = group.layout ?? "h";

  if (layout === "v") {
    return (
      <VStackWidget title={`/ ${title}`} href={href}>
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
    <HStackWidget title={`/ ${title}`} href={href}>
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
  const groups = (log.groups ?? []).filter((group) => !group.hidden);
  const leftGroups = groups.filter((group) => group.column === "left");
  const rightGroups = groups.filter((group) => group.column !== "left");

  return (
    <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
      <div className="space-y-4">
        <BlogStackWidget />
        <PromptWidget />
        {leftGroups.map((group) => (
          <GroupWidget key={group.id} group={group} />
        ))}
      </div>
      <div className="space-y-4">
        <WeatherWidget />
        <ProcessingWidget />
        {rightGroups.map((group) => (
          <GroupWidget key={group.id} group={group} />
        ))}
      </div>
    </div>
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
  const [heroOpacity, setHeroOpacity] = useState(1);

  useEffect(() => {
    const getFadeDistance = () =>
      window.matchMedia("(min-width: 768px)").matches ? 360 : 180;

    const updateHeroOpacity = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop || 0;
      const progress = Math.min(scrollTop / getFadeDistance(), 1);
      setHeroOpacity(1 - progress);
    };

    updateHeroOpacity();
    window.addEventListener("scroll", updateHeroOpacity, { passive: true });
    window.addEventListener("resize", updateHeroOpacity);

    return () => {
      window.removeEventListener("scroll", updateHeroOpacity);
      window.removeEventListener("resize", updateHeroOpacity);
    };
  }, []);

  return (
    <main className="mx-auto max-w-[680px] px-6 pt-6 sm:pt-24 pb-32">
      <HeaderZone
        className="sticky top-6 sm:top-24 z-10"
        style={{ opacity: heroOpacity, transition: "opacity 120ms linear" }}
      >
        <div className="h-11 flex items-start justify-center">
          <ScrambleIdentifier />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <AmbientGreeting />
        </div>
      </HeaderZone>

      {/* Widget grid */}
      <WidgetGrid />
    </main>
  );
}
