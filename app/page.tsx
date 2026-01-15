"use client";

import { AmbientGreeting, WeatherWidget } from "@/systems/ambient";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { HStackWidget, VStackWidget } from "@/components/home/featured-stack-widget";
import {
  WidgetShell,
  WidgetHeader,
  WidgetTitle,
  WidgetBody,
  WidgetLink,
  WidgetStatus,
} from "@/components/ui/widget";
import { CommitEmbed } from "@/components/log";
import { useLocale, t } from "@/services";
import { getLocalizedTitle } from "@/lib/content";
import { blogPosts } from "@/lib/data";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import logData from "@/content/log.json";
import {
  localize,
  resolveGroupCommits,
  isCommitListed,
  isRoleCommit,
} from "@/lib/log";
import type { Commit, Group, LogData, RoleCommit } from "@/lib/log";
import { RoleEmbedCompact } from "@/components/log/embeds";

// =============================================================================
// Widget Components
// =============================================================================

function BlogStackWidget() {
  const { locale } = useLocale();
  const recentPosts = blogPosts.slice(0, 3);

  return (
    <VStackWidget title={t(locale, "widgetBlog")} href="/prose">
      {recentPosts.map((post) => (
        <Link
          key={post.slug}
          href={`/prose/${post.slug}`}
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

function getCurrentRoleCommit(commits: Commit[]): RoleCommit | null {
  const roles = commits.filter(isRoleCommit).filter(isCommitListed);
  if (roles.length === 0) return null;

  const key = (c: RoleCommit) =>
    c.endDate === "present" ? "9999-12" : c.endDate ?? c.date;

  return [...roles].sort((a, b) => key(b).localeCompare(key(a)))[0] ?? null;
}

function ProcessingWidget() {
  const { locale } = useLocale();
  const role = getCurrentRoleCommit(log.commits as Commit[]);
  if (!role) return null;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-3">
        <div className="flex items-center gap-2">
          <WidgetStatus />
          <WidgetTitle>{t(locale, "widgetStatus")}</WidgetTitle>
        </div>
        <WidgetLink href="/log" label="View log" />
      </WidgetHeader>
      <WidgetBody>
        <RoleEmbedCompact commit={role} locale={locale} />
      </WidgetBody>
    </WidgetShell>
  );
}

function GroupWidget({ group }: { group: Group }) {
  const { locale } = useLocale();

  const commits = resolveGroupCommits(group, log.commits as Commit[]);
  if (commits.length === 0) return null;

  const title = localize(group.title, locale);
  const href = group.href ?? "/log";
  const layout = group.layout ?? "h";

  if (layout === "v") {
    return (
      <VStackWidget title={`/ ${title}`} href={href}>
        {commits.map((commit) => (
          <CommitEmbed
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
        <CommitEmbed
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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
      {/* Blog widget spans full width on mobile, 2 cols on larger */}
      <div className="sm:col-span-1">
        <BlogStackWidget />
      </div>
      <div className="space-y-4">
        <WeatherWidget />
        <ProcessingWidget />
        {(log.groups ?? []).map((group) => (
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
    <div className="text-center mb-12">
      <span
        className={cn(
          "font-mono text-xs tracking-wider relative inline-block cursor-default transition-colors duration-300",
          isHovered ? "text-foreground" : "text-muted-foreground"
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
  return (
    <main className="mx-auto max-w-[680px] px-6 pt-24 pb-32">
      {/* System identifier with scramble effect */}
      <ScrambleIdentifier />

      {/* Hux speaking to the user */}
      <AmbientGreeting />

      {/* Widget grid */}
      <WidgetGrid />
    </main>
  );
}
