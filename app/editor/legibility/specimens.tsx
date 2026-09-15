"use client";

// =============================================================================
// Specimens — the site's surfaces, one of each, drawn with the production
// classes so the stylesheet under test is the one that ships.
//
// Every specimen is real markup with real tokens: `.ink-bare`, `bg-glass`,
// `bg-glass-popover`, `bg-muted/50`, `text-muted-foreground`. Nothing is
// mocked with a literal colour, because a literal colour would not move when
// a slider does.
// =============================================================================

import { TITLE_POETIC } from "@/components/ui/header-zone";
import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { GLASS_PILL, GLASS_TRACK } from "@/systems/theater/lib/chrome";
import { ArrowRight, ChevronDown, Cloud, Search } from "lucide-react";
import { AppFolder } from "@/components/apps";
import { FeaturedTalksWidget } from "@/components/home/featured-talks-widget";
import { PromptWidget } from "@/components/home/prompt-widget";
import { WritingWidget } from "@/components/home/writing-widget";
import { GroupWidget, homeLog } from "@/app/home-view";
import type { BlogPostSummary } from "@/lib/content";
import { WeatherWidget } from "@/systems/ambient";
import { ALBUM_GROUP_IDS } from "@/systems/theater/lib/albums";

export function SpecimenLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="ink-bare mb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

/** Bare text: the home screen's identifier, greeting and app labels. */
export function BareSpecimen() {
  return (
    <div className="ink-bare flex flex-col items-center gap-3 px-6 py-8 text-center">
      <span className="text-sm font-mono tracking-wider text-muted-foreground">
        λhux
      </span>
      <h1 className={cn(TITLE_POETIC, "text-foreground")}>good evening.</h1>
      <p className="text-sm sm:text-base">
        <span className="text-muted-foreground">you were reading </span>
        <span className="font-serif italic text-foreground underline decoration-foreground/30 decoration-1 underline-offset-4">
          Building Design Systems
        </span>
        <span className="text-muted-foreground">.</span>
      </p>
      <div className="mt-2 flex flex-col items-center gap-1 text-sm">
        <span className="text-foreground">primary — the ink</span>
        <span className="text-muted-foreground">secondary — muted-foreground</span>
        <span className="text-tertiary-foreground">tertiary — captions, timestamps</span>
        <span className="text-quaternary-foreground">quaternary — watermarks</span>
      </div>
      <div className="mt-4 flex gap-5">
        {["Writing", "Works", "Prompt", "Docs"].map((label) => (
          <span key={label} className="flex w-14 flex-col items-center gap-1.5">
            <span className="size-11 rounded-[12px] border border-border/50 bg-glass backdrop-blur-xl" />
            <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** A home widget: header, rows with hover washes, a kbd, a tab capsule. */
export function WidgetSpecimen() {
  return (
    <WidgetShell className="w-full">
      <WidgetHeader>
        <WidgetTitle signal>writing</WidgetTitle>
        <span className="text-xs text-muted-foreground">
          <ArrowRight className="h-3 w-3" />
        </span>
      </WidgetHeader>
      <WidgetBody className="space-y-1">
        {[
          ["Vibe coding a personal OS", "sep 2026"],
          ["Why every text colour is an alpha", "aug 2026"],
          ["Notes on Liquid Glass", "jul 2026"],
        ].map(([title, date], i) => (
          <div
            key={title}
            className={cn(
              "-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 transition-colors",
              i === 1 ? "bg-muted/40" : "hover:bg-muted/40",
            )}
          >
            <span className="truncate text-sm text-foreground">{title}</span>
            <span className="shrink-0 text-xs font-mono text-muted-foreground">{date}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-3">
          <span className={cn("inline-flex rounded-full p-0.5", GLASS_TRACK)}>
            <span className={cn("rounded-full px-3 py-1 text-xs text-foreground", GLASS_PILL)}>
              React
            </span>
            <span className="rounded-full px-3 py-1 text-xs text-muted-foreground">Lynx</span>
            <span className="rounded-full px-3 py-1 text-xs text-muted-foreground">Personal</span>
          </span>
          <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-mono text-foreground">
            en
          </span>
          <kbd className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </WidgetBody>
    </WidgetShell>
  );
}

/** The dock's Live Activity: pill and expanded panel. */
export function ActivitySpecimen() {
  return (
    <div className="flex flex-col items-center gap-4">
      <span
        className={cn(
          "flex h-9 items-center gap-2 rounded-full pl-1.5 pr-2.5",
          "border border-border/50 bg-glass backdrop-blur-xl shadow-raised",
        )}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-muted">
          <Cloud className="h-3 w-3 text-foreground/70" />
        </span>
        <span className="text-xs font-medium text-foreground">🌅 05:46</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <div className="w-[min(100%,340px)] overflow-hidden rounded-2xl border border-border/50 bg-glass shadow-overlay backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            sunrise
          </span>
          <span className="text-xs text-muted-foreground">05:46</span>
        </div>
        <div className="px-5 pb-4">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-medium text-foreground">18°</span>
            <span className="text-sm text-muted-foreground">Clear · Berkeley</span>
          </div>
          <p className="mt-2 text-xs text-tertiary-foreground">
            the sun rises in 34 minutes
          </p>
        </div>
        <div className="flex justify-center pb-2">
          <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
        </div>
      </div>
    </div>
  );
}

/** The command palette: popover glass, input, a selected row, kbd hints. */
export function PaletteSpecimen() {
  const rows = [
    ["Writing", "W"],
    ["Wallpaper: Tahoe", "/ W"],
    ["Glass: Clear", "/ G"],
    ["Toggle theme", "T"],
  ];
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/50 bg-glass-popover shadow-overlay backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground/60">what brings you here?</span>
        <kbd className="rounded bg-muted/50 px-2 py-1 text-xs font-mono text-muted-foreground">
          esc
        </kbd>
      </div>
      <div className="p-2">
        <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          navigation
        </div>
        {rows.map(([label, key], i) => (
          <div
            key={label}
            className={cn(
              "flex items-center justify-between rounded-md px-3 py-2 text-sm text-foreground",
              i === 1 ? "bg-accent/40 text-accent-foreground" : "hover:bg-accent/25",
            )}
          >
            <span>{label}</span>
            <kbd className="rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
              {key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A secondary surface: the sheet material with a section and a capsule row. */
export function SheetSpecimen() {
  return (
    <div className="w-full rounded-2xl border border-border/50 bg-glass-sheet p-5 shadow-overlay backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">wallpaper</span>
        <span className="text-xs font-mono text-muted-foreground">33</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          placement
        </span>
        <span className="flex overflow-hidden rounded-md border border-border/60">
          {["Full", "Widget", "Off"].map((o, i) => (
            <span
              key={o}
              className={cn(
                "px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider",
                i === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              {o}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-4 text-xs text-tertiary-foreground">
        Wallpapers are Apple&apos;s; rights remain theirs.
      </p>
    </div>
  );
}

/**
 * A reading page: the list rows and prose of /writing and /works, in their
 * production classes. The veil and defocus are NOT simulated here — switch
 * the lab's Surface to Reading and the provider applies the real treatment
 * to the whole page, exactly as a reading route gets it.
 */
export function ReadingSpecimen() {
  return (
    <div className="w-full px-6 py-6">
      <div className="mb-4 text-xs font-mono tracking-wide text-muted-foreground">/writing</div>
      <h2 className="mb-6 font-serif text-3xl tracking-tight text-foreground">Writing</h2>
      <div className="mb-8 space-y-1">
        {[
          ["Beyond Being a Frontend Engineer", "jul 2020", true],
          ["React Is Not Vue, Obviously", "apr 2020", false],
          ["Avoiding Success at All Cost", "sep 2018", false],
        ].map(([title, date, featured]) => (
          <div key={String(title)} className="flex items-baseline justify-between gap-3 py-2">
            <span className="text-foreground">
              {String(title)}
              {featured && (
                <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  featured
                </span>
              )}
            </span>
            <span className="shrink-0 font-mono text-xs text-tertiary-foreground">{String(date)}</span>
          </div>
        ))}
      </div>
      <div className="prose-article">
        <p>
          A fixed grey was a pre-computed alpha for a page that was only ever white or
          near-black. Under a picture it stops being any alpha at all —{" "}
          <a href="#" onClick={(e) => e.preventDefault()}>
            the same word
          </a>{" "}
          reads differently on every wallpaper, and <code>text-muted-foreground</code> stops
          meaning &ldquo;secondary&rdquo;.
        </p>
        <blockquote>
          <p>Regardless of the material you choose, use vibrant colors on top of it.</p>
        </blockquote>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        sep 2026 · <span className="text-tertiary-foreground">4 min read</span>
      </div>
    </div>
  );
}

/**
 * The production widgets themselves — the app folder's labels, the writing
 * widget's dates, a projects group's subtitles, the weather, the prompt, the
 * talks — rendered by the same components the home screen mounts, so what the
 * lab shows is what the visitor gets, class for class.
 */
export function RealSurfacesSpecimen({ posts }: { posts: BlogPostSummary[] }) {
  const albumGroupIds = new Set<string>(ALBUM_GROUP_IDS);
  const group = (homeLog.groups ?? []).find((g) => !g.hidden && !albumGroupIds.has(g.id));
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <AppFolder />
      <WritingWidget posts={posts} />
      {group && <GroupWidget group={group} />}
      <WeatherWidget />
      <FeaturedTalksWidget />
      <PromptWidget />
    </div>
  );
}
