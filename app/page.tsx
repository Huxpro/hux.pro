"use client";

import { TextScramble } from "@/components/motion-primitives/text-scramble";
import {
  useCommandPalette,
  useLocale,
  useVisitor,
} from "@/components/providers";
import { getLocalizedTitle } from "@/lib/content";
import { blogPosts, talks } from "@/lib/data";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// =============================================================================
// Time-based greeting logic
// =============================================================================

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getGreetingKey(timeOfDay: TimeOfDay): string {
  const map: Record<TimeOfDay, string> = {
    morning: "greetingMorning",
    afternoon: "greetingAfternoon",
    evening: "greetingEvening",
    night: "greetingNight",
  };
  return map[timeOfDay];
}

// =============================================================================
// Ambient Greeting Component - Hux speaking to the user
// =============================================================================

function AmbientGreeting() {
  const { locale } = useLocale();
  const { lastVisited, isReturningVisitor, daysSinceLastVisit } = useVisitor();
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("evening");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeOfDay(getTimeOfDay());
    setMounted(true);
  }, []);

  if (!mounted) {
    // Prevent hydration mismatch
    return <div className="min-h-[120px]" />;
  }

  // Build the greeting message
  const greetingKey = getGreetingKey(timeOfDay);
  const timeGreeting = t(
    locale,
    greetingKey as keyof typeof import("@/lib/i18n").translations.en
  );

  // Determine contextual message
  let contextMessage: React.ReactNode = null;

  if (isReturningVisitor && lastVisited) {
    // Returning visitor who read something before
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 7) {
      // Long time no see
      contextMessage = (
        <span className="block mt-2 text-muted-foreground">
          {t(locale, "greetingLongTime")}
        </span>
      );
    } else {
      // Recent visitor - show what they were reading
      contextMessage = (
        <span className="block mt-2">
          <span className="text-muted-foreground">
            {t(locale, "greetingLastReading")}{" "}
          </span>
          <span className="font-serif italic text-foreground">
            {lastVisited.title}
          </span>
          <span className="text-muted-foreground">.</span>
        </span>
      );
    }
  } else if (isReturningVisitor) {
    // Returning but hasn't read anything specific
    contextMessage = (
      <span className="block mt-2 text-muted-foreground">
        {t(locale, "greetingWelcomeBack")}
      </span>
    );
  }

  return (
    <div className="text-center mb-16">
      {/* Time-based greeting - the main message */}
      <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
        {timeGreeting}
      </h1>
      {/* Contextual message */}
      {contextMessage && (
        <p className="mt-3 text-base sm:text-lg leading-relaxed">
          {contextMessage}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Widget Components
// =============================================================================

function BlogWidget() {
  const { locale } = useLocale();
  const recentPosts = blogPosts.slice(0, 3);

  return (
    <div
      className={cn(
        "group relative p-5 rounded-2xl",
        "bg-card/50 backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300",
        "hover:border-border hover:bg-card/70"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {t(locale, "widgetBlog")}
        </span>
        <Link
          href="/prose"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          {t(locale, "widgetViewAll")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Posts list */}
      <div className="space-y-3">
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
      </div>
    </div>
  );
}

function TalkWidget() {
  const { locale } = useLocale();
  const latestTalk = talks[0];

  if (!latestTalk) return null;

  return (
    <Link
      href="/productions"
      className={cn(
        "group relative p-5 rounded-2xl",
        "bg-card/50 backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300",
        "hover:border-border hover:bg-card/70",
        "block"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {t(locale, "widgetTalks")}
        </span>
        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </div>

      {/* Latest talk */}
      <div className="text-sm text-foreground truncate">
        {locale === "zh" && latestTalk.titleZh
          ? latestTalk.titleZh
          : latestTalk.title}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {latestTalk.event}
      </div>
    </Link>
  );
}

function StatusWidget() {
  const { locale } = useLocale();

  return (
    <Link
      href="/projects"
      className={cn(
        "group relative p-5 rounded-2xl",
        "bg-card/50 backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300",
        "hover:border-border hover:bg-card/70",
        "block"
      )}
    >
      {/* Header with status indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {t(locale, "widgetStatus")}
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </div>

      {/* Status text */}
      <div className="text-sm text-foreground leading-relaxed">
        {t(locale, "currentStatus")}
      </div>
    </Link>
  );
}

function WidgetGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
      {/* Blog widget spans full width on mobile, 2 cols on larger */}
      <div className="sm:col-span-1">
        <BlogWidget />
      </div>
      <div className="space-y-4">
        <StatusWidget />
        <TalkWidget />
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
          key={targetText}
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
// Conversational Prompt - morphs into command palette
// =============================================================================

function ConversationalPrompt() {
  const { locale } = useLocale();
  const { open } = useCommandPalette();

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={() => open()}
        className={cn(
          "w-full max-w-md",
          "flex items-center gap-3 px-5 py-4",
          "bg-card/50 backdrop-blur-xl",
          "border border-border/50 rounded-2xl",
          "text-left",
          "transition-all duration-300",
          "hover:border-border hover:bg-card/70",
          "focus:outline-none focus:ring-2 focus:ring-ring/20",
          "group"
        )}
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-muted-foreground text-sm">
          {t(locale, "promptPlaceholder")}
        </span>
        <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded">
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </button>
    </div>
  );
}

// =============================================================================
// Main Homepage
// =============================================================================

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[680px] px-6 pt-24 pb-24">
        {/* System identifier with scramble effect */}
        <ScrambleIdentifier />

        {/* Hux speaking to the user */}
        <AmbientGreeting />

        {/* Widget grid */}
        <WidgetGrid />

        {/* Conversational prompt */}
        <ConversationalPrompt />
      </main>
    </div>
  );
}
