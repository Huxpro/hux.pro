"use client";

// =============================================================================
// Specimens: one of every surface the site draws text on, rendered from the
// same typography roles (`lib/typography.ts`) and glass tokens production
// renders from.
//
// Nothing here imports a production component, on purpose: a widget mounted
// in the lab would be a second rendering of the site to keep in step with the
// first. The contract is one level down: a role is a class string, and the
// writing widget's date and the specimen's date are the same string
// (`TYPE.rowMeta`), so they cannot disagree. What the lab tests is the spec;
// production is the spec composed into components.
//
// Where production still carries a variant the roles do not cover, the
// specimen reproduces the production string verbatim and the divergence is
// listed under "Decisions" in docs/system-legibility.md rather than quietly
// normalised here.
// =============================================================================

import { TITLE_POETIC } from "@/components/ui/header-zone";
import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { legibilityCssVars, type LegibilityVars } from "@/systems/ambient/lib/legibility";
import { GLASS_PILL, GLASS_TRACK } from "@/systems/theater/lib/chrome";
import { ArrowRight, ChevronDown, Cloud, Search } from "lucide-react";
import type { CSSProperties } from "react";
import { useLabStrings } from "@/systems/lab";
import { t } from "@/lib/i18n";
import { useLocale } from "@/services";
import { SPECIMEN_STRINGS } from "./specimen-strings";

/** The specimens' words and the reader's locale, for the site dictionary. */
function useSpecimenText() {
  const { locale } = useLocale();
  return { locale, S: useLabStrings(SPECIMEN_STRINGS) };
}

export function SpecimenLabel({ children }: { children: React.ReactNode }) {
  return <div className={cn("ink-bare mb-2", TYPE.label)}>{children}</div>;
}

/** Bare text: the home screen's identifier, greeting, and app labels. */
export function BareSpecimen() {
  const { locale, S } = useSpecimenText();
  return (
    <div className="ink-bare flex flex-col items-center gap-3 px-6 py-8 text-center">
      <span className={TYPE.identifier}>λhux</span>
      <h1 className={cn(TITLE_POETIC, "text-foreground")}>{t(locale, "greetingEvening")}</h1>
      <p className="text-sm sm:text-base leading-relaxed">
        <span className="text-muted-foreground">{t(locale, "greetingLastReading")} </span>
        <span className="font-serif italic text-foreground underline decoration-ink-line decoration-1 underline-offset-4">
          Building Design Systems
        </span>
        <span className="text-muted-foreground">.</span>
      </p>
      <div className="mt-2 flex flex-col items-center gap-1 text-sm">
        <span className="text-foreground">{S.ladder.primary}</span>
        <span className="text-muted-foreground">{S.ladder.secondary}</span>
        <span className="text-tertiary-foreground">{S.ladder.tertiary}</span>
        <span className="text-quaternary-foreground">{S.ladder.quaternary}</span>
      </div>
      {/* The app folder: a middle-band zone, deciding its flip for itself. */}
      <div className="ink-bare-mid mt-4 flex gap-5">
        {S.apps.map((label) => (
          <span key={label} className="flex w-16 flex-col items-center">
            <span className="size-11 rounded-[12px] border border-border/50 bg-glass backdrop-blur-xl" />
            <span className={cn("mt-1.5 block max-w-16 truncate text-center", TYPE.appLabel)}>
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** A home widget: the shell, its label, rows with a title and a date, a tab
 *  capsule and a kbd, composed from the roles the way
 *  writing-widget.tsx and featured-talks-widget.tsx compose them. */
export function WidgetSpecimen() {
  const { locale } = useSpecimenText();
  return (
    <WidgetShell className="w-full">
      <WidgetHeader className="pb-2">
        <WidgetTitle signal>{t(locale, "widgetBlog")}</WidgetTitle>
        <span className={TYPE.nav}>
          <ArrowRight className="h-3 w-3" />
        </span>
      </WidgetHeader>
      <WidgetBody className="space-y-0.5">
        {[
          ["Vibe coding a personal OS", "sep 2026"],
          ["Why every text colour is an alpha", "aug 2026"],
          ["Notes on Liquid Glass", "jul 2026"],
        ].map(([title, date], i) => (
          <div
            key={title}
            className={cn(
              "-mx-2 flex items-baseline gap-3 rounded-lg px-2 py-2 transition-colors",
              i === 1 ? "bg-muted/20" : "hover:bg-muted/20",
            )}
          >
            <span className={cn("min-w-0 flex-1 line-clamp-2", TYPE.rowTitle)}>{title}</span>
            <span className={cn("shrink-0", TYPE.rowMeta)}>{date}</span>
          </div>
        ))}
        <div className="mt-3 border-t border-border/30 pt-4 pb-1.5">
          <span className={cn("block", TYPE.aside)}>{t(locale, "writingFeatured")}</span>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <span className={cn("inline-flex rounded-full p-0.5", GLASS_TRACK)}>
            <span className={cn("rounded-full px-3 py-1 text-xs text-foreground", GLASS_PILL)}>
              React
            </span>
            <span className="rounded-full px-3 py-1 text-xs text-tertiary-foreground">Lynx</span>
            <span className="rounded-full px-3 py-1 text-xs text-tertiary-foreground">Personal</span>
          </span>
          <kbd className={TYPE.kbd}>⌘K</kbd>
        </div>
        <div className="pt-4">
          <div className={cn("truncate", TYPE.rowTitle)}>React for Two Threads</div>
          <div className={cn("mt-0.5 truncate", TYPE.label)}>React Universe Conf</div>
        </div>
      </WidgetBody>
    </WidgetShell>
  );
}

/** The dock's Live Activity: pill and expanded panel, with a media title. */
export function ActivitySpecimen() {
  const { S } = useSpecimenText();
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
          <span className={TYPE.label}>{S.nowPlaying}</span>
          <span className={TYPE.meta}>05:46</span>
        </div>
        <div className="px-5 pb-4">
          <div className={cn("truncate", TYPE.mediaTitle)}>Weightless (Ambient Mix)</div>
          <div className={cn("mt-0.5 truncate", TYPE.meta)}>Marconi Union</div>
          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 rounded-full bg-foreground/50" />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
            <span>2:41</span>
            <span>-5:22</span>
          </div>
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
  const { locale, S } = useSpecimenText();
  const keys = ["W", "/ W", "/ G", "T"];
  const rows = S.paletteRows.map((label, i) => [label, keys[i]]);
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/50 bg-glass-popover shadow-overlay backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 text-sm text-muted-foreground/60">{t(locale, "searchPlaceholder")}</span>
        <kbd className={cn("px-2 py-1", TYPE.kbd)}>esc</kbd>
      </div>
      <div className="p-2">
        <div className={cn("px-3 py-2", TYPE.label)}>{S.navigation}</div>
        {rows.map(([label, key], i) => (
          <div
            key={label}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground",
              i === 1 ? "bg-accent/40 text-accent-foreground" : "hover:bg-accent/25",
            )}
          >
            <span>{label}</span>
            <kbd className={cn("shrink-0", TYPE.kbd)}>{key}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A secondary surface: the sheet material with a section label and a capsule row. */
export function SheetSpecimen() {
  const { locale } = useSpecimenText();
  return (
    <div className="w-full rounded-2xl border border-border/50 bg-glass-sheet p-5 shadow-overlay backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-foreground">{t(locale, "wallpaperTitle")}</span>
        <span className={TYPE.meta}>33</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={TYPE.label}>{t(locale, "wallpaperPlacement").toLowerCase()}</span>
        <span className="flex overflow-hidden rounded-md border border-border/60">
          {(["wallpaperPlacementFull", "wallpaperPlacementWidget", "wallpaperPlacementOff"] as const).map((key) => t(locale, key)).map((o, i) => (
            <span
              key={o}
              className={cn(
                "px-2.5 py-1",
                TYPE.labelSm,
                i === 0 ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              {o}
            </span>
          ))}
        </span>
      </div>
      <p className={cn("mt-4", TYPE.captionQuiet)}>{t(locale, "wallpaperFooterNote")}</p>
    </div>
  );
}

/**
 * A reading page (/writing, /works, an article) as its own surface.
 *
 * The picture behind a reading route is defocused and veiled with the page
 * colour; this box does the same to the wallpaper behind it (a backdrop blur
 * at the policy's radius, a veil at the policy's alpha) and carries the
 * policy's *reading* resolution as an `.ink-scope`, so the sliders for veil,
 * blur, relief-on-reading and the ink boost act here exactly as they act on
 * the real route, while the rest of the lab stays the desktop.
 */
export function ReadingSpecimen({ vars }: { vars: LegibilityVars }) {
  const style = legibilityCssVars(vars) as CSSProperties;
  const { locale, S } = useSpecimenText();
  return (
    <div
      className={cn("ink-scope relative w-full overflow-hidden rounded-xl", vars.flip && "ink-flip")}
      style={style}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backdropFilter: `blur(${vars.blur}px)`,
          WebkitBackdropFilter: `blur(${vars.blur}px)`,
        }}
      />
      <div aria-hidden className="absolute inset-0 bg-background" style={{ opacity: vars.veil }} />
      <div className="relative px-6 py-6">
        <span className={TYPE.nav}>λhux</span>
        <h2 className={cn("mt-6 mb-6", TITLE_POETIC, "text-foreground")}>{t(locale, "writingTitle")}</h2>

        {/* /writing rows: PostList's title, language badge and date. */}
        <div className="mb-8">
          {[
            ["Beyond Being a Frontend Engineer", "jul 2020"],
            ["React Is Not Vue, Obviously", "apr 2020"],
            ["Avoiding Success at All Cost", "sep 2018"],
          ].map(([title, date]) => (
            <div
              key={String(title)}
              className="-mx-4 flex items-baseline justify-between gap-4 rounded-lg px-4 py-3 hover:bg-muted/50"
            >
              <h3 className={cn(TYPE.rowTitle, "sm:text-base font-normal")}>
                {String(title)}
                <span className={cn("ml-2 align-baseline", TYPE.rowMeta)}>EN</span>
              </h3>
              <span className={cn("shrink-0", TYPE.rowMeta)}>{String(date)}</span>
            </div>
          ))}
        </div>

        {/* /works rows: a commit's hash, title, meta line and date. */}
        <div className="mb-8 space-y-3">
          {[
            ["da4a261", "lynx-ui: Best Lynx in Components", "React Advanced London ↗", "Nov 2025"],
            ["a0ac582", "Lynx Framework", "Lynx @ ByteDance", "2023 – Present"],
          ].map(([hash, title, meta, date]) => (
            <div key={hash} className="grid grid-cols-[auto_1fr] gap-x-2">
              <span className={cn("leading-5", TYPE.hash)}>{hash}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("min-w-0 flex-1", TYPE.rowTitle)}>{title}</span>
                  <span className={cn("shrink-0 ml-auto", TYPE.rowMeta)}>{date}</span>
                </div>
                <div className={cn("mt-1", TYPE.rowMeta)}>{meta}</div>
              </div>
            </div>
          ))}
        </div>

        {/* An article: the header meta line and the prose recipe. */}
        <div className={cn("mb-4 flex items-center gap-2", TYPE.meta)}>
          <span>sep 2026</span>
          <span className="text-quaternary-foreground">·</span>
          <span>{S.minRead}</span>
        </div>
        <div className="prose-article" lang={locale}>
          <p>
            {S.articleLead}
            <a href="#" onClick={(e) => e.preventDefault()}>
              {S.articleLink}
            </a>
            {S.articleMid}
            <code>text-muted-foreground</code>
            {S.articleTail}
          </p>
          <blockquote>
            <p>{S.articleQuote}</p>
          </blockquote>
        </div>
        <div className={cn("mt-2", TYPE.labelSm)}>
          {S.articleLang} <span className="mx-1.5 text-quaternary-foreground">·</span> {S.minRead}
        </div>
      </div>
    </div>
  );
}
