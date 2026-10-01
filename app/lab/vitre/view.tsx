"use client";

// =============================================================================
// Vitre Lab: /lab/vitre. A library, published from the lab.
//
// The labs study this site's systems; some of those systems are libraries
// that can leave it. Vitre is the first: its lab is its whole home, in the
// library template (systems/lab/components/library.tsx): this guide, the
// API reference (./api) and how this site uses it (./site). There is no
// other docs page: /vitre is only the demo (a phone, or the phone drawn here).
//
//   bar        the lab's name and switcher, the section tabs, the pages
//   phone      a drawn iPhone running the demo build (simulator.tsx), pinned
//              beside the article; the section in the middle of the screen
//              runs its scenario in it
//   article    the package's own documentation (packages/vitre/site/src/docs),
//              in the site's type (docs.css). api.ts there fails the type
//              check for an export or a prop that is not documented, so the
//              contract stays with the package
//
// On a phone there is no simulator, since the phone is the device. The
// article opens with the way into the real demo instead.
//
// Nothing here touches the site's own vitre (the bezel this page is framed
// by). The simulator is its own document, with its own <Vitre>.
// =============================================================================

import { LibraryShell, labButtonClass, useLabStrings } from "@/systems/lab";
import type { SectionId } from "@/packages/vitre/site/src/docs/api";
import { SECTIONS, SectionCovers } from "@/packages/vitre/site/src/docs/sections";
import { formatValue } from "@/packages/vitre/site/src/devtool/controls";
import { LangProvider, useT } from "@/packages/vitre/site/src/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale, useTheme } from "@/services";
import { ArrowUpRight } from "lucide-react";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { Code } from "@/packages/vitre/site/src/docs/Code";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  DEMO_URL,
  PHONE,
  Phone,
  usePhoneBridge,
  usePhoneReport,
  type PhoneBridge,
  type ReportStore,
} from "./simulator";
import { VITRE_STRINGS } from "./strings";
import "./docs.css";

/** From here the page has room for the phone beside the article (the demo's own phone breakpoint, 767px, is below it). */
const WIDE = "(min-width: 768px)";

export function VitreLabView() {
  const { locale } = useLocale();
  return (
    // The package's docs speak in its own `Text`; the site owns the language.
    <LangProvider lang={locale}>
      <VitreDocs />
    </LangProvider>
  );
}

function VitreDocs() {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const S = useLabStrings(VITRE_STRINGS);
  const wide = useMediaQuery(WIDE);
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id);
  const bridge = usePhoneBridge(active, locale, theme, wide);

  // The section in the middle of the viewport is the active one, except
  // while a picked section is being scrolled to, so the phone does not run
  // every scenario in between.
  const picking = useRef<number | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (picking.current !== null) return;
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id as SectionId);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    document.querySelectorAll("[data-doc-section]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const pick = useCallback((id: SectionId) => {
    setActive(id);
    history.replaceState(history.state, "", `#${id}`);
    if (picking.current !== null) window.clearTimeout(picking.current);
    picking.current = window.setTimeout(() => {
      picking.current = null;
    }, 900);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Arriving at a section (/vitre#chrome on a desk lands here with its
  // hash): scroll to it, and the observer makes it the active one.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === id)) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <LibraryShell lab="vitre" page="docs" tools={<SectionTabs active={active} onPick={pick} label={S.sections} />}>
      <div className="vitre-lab md:grid md:grid-cols-[minmax(320px,42%)_minmax(0,1fr)] md:gap-10 lg:gap-16">
        <aside className="sticky top-[var(--lab-under-bar)] hidden h-[calc(100svh-var(--lab-under-bar))] items-center justify-center pb-10 md:flex">
          {wide && <FittedPhone bridge={bridge} />}
        </aside>

        <article className="min-w-0 pb-[30vh] md:pb-[40vh]">
          <div className="mb-6 rounded-2xl border border-border/50 bg-glass p-5 backdrop-blur-xl md:hidden">
            <p className={TYPE.rowTitle}>{S.phoneTitle}</p>
            <p className={cn(TYPE.caption, "mt-1")}>{S.phoneBody}</p>
            <a href={DEMO_URL} className={cn(labButtonClass("primary"), "mt-4")}>
              {S.phoneOpen}
              <ArrowUpRight />
            </a>
          </div>
          {SECTIONS.map((section) => (
            <DocSection
              key={section.id}
              section={section}
              active={active === section.id}
              wide={wide}
              run={bridge.run}
              reports={bridge.reports}
            />
          ))}
          {/* Beside the simulator, the way to the real thing. */}
          <p className={cn(TYPE.caption, "hidden border-t border-border/50 pt-6 md:block")}>{S.onIphone}</p>
        </article>
      </div>
    </LibraryShell>
  );
}

/** The phone, as large as its column lets it be (never past its own size). */
function FittedPhone({ bridge }: { bridge: PhoneBridge }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = box.current?.parentElement;
    if (!el) return;
    const fit = () => {
      // Room for the caption under it and the frame's 12px of bezel around it.
      const h = (el.clientHeight - 72) / PHONE.height;
      const w = (el.clientWidth - 32) / PHONE.width;
      setScale(Math.max(0.3, Math.min(1, h, w)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box}>
      <Phone bridge={bridge} scale={scale} />
    </div>
  );
}

type Section = (typeof SECTIONS)[number];

/**
 * One section of the guide. Memoised, with only stable props from the bridge:
 * the phone's reports and toolbar re-render the phone and the active
 * section's readout, not the article.
 */
const DocSection = memo(function DocSection({
  section: s,
  active,
  wide,
  run,
  reports,
}: {
  section: Section;
  active: boolean;
  wide: boolean;
  run: PhoneBridge["run"];
  reports: ReportStore;
}) {
  const t = useT();
  return (
    <section
      id={s.id}
      data-doc-section
      className={cn(
        "scroll-mt-[calc(var(--lab-under-bar)+1rem)] border-t border-border/50 py-10 first-of-type:border-t-0 first-of-type:pt-2",
        // Beside the phone, one section at a time: the one it is running.
        "md:min-h-[72vh] md:py-[10vh] md:first-of-type:pt-[4vh] md:transition-opacity md:duration-300",
        !active && "md:opacity-50",
      )}
    >
      <p className={cn(TYPE.meta, "text-tertiary-foreground")}>{s.eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl tracking-tight text-foreground sm:text-[2rem]">{t(s.title)}</h2>
      <p className="mt-3 text-base leading-relaxed text-foreground/85 sm:text-lg">{t(s.lede)}</p>
      {s.body && <div className="vitre-prose mt-4">{t(s.body)}</div>}
      {s.code && <Code code={s.code} />}
      {wide && s.actions && (
        <div className="mt-4 flex flex-wrap gap-2">
          {s.actions.map((a) => (
            <button
              key={a.label.en}
              type="button"
              onClick={() => run(a.run)}
              className="rounded-full border border-border/60 bg-glass px-3.5 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-glass-hover"
            >
              {t(a.label)}
            </button>
          ))}
        </div>
      )}
      {/* What the phone reports only means something where there is a phone. */}
      {wide && active && s.live && <LiveReadout live={s.live} reports={reports} />}
      <SectionCovers id={s.id} />
    </section>
  );
});

/** The active section's readout of the phone, live. */
function LiveReadout({ live, reports }: { live: NonNullable<Section["live"]>; reports: ReportStore }) {
  const t = useT();
  const S = useLabStrings(VITRE_STRINGS);
  const reading = live(usePhoneReport(reports));
  if (!reading) return null;
  return (
    <div className="mt-4 rounded-xl border border-border/50 bg-glass px-4 py-2.5">
      <span className={TYPE.labelSm}>
        {S.live} · {t(reading.label)}
      </span>
      <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-foreground">{formatValue(reading.value)}</pre>
    </div>
  );
}

/**
 * The sections, as the bar's tools: one chip each, the active one lit, and
 * kept in view as the article scrolls (the bar's tools row scrolls sideways).
 */
function SectionTabs({
  active,
  onPick,
  label,
}: {
  active: SectionId;
  onPick: (id: SectionId) => void;
  label: string;
}) {
  const t = useT();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    const el = buttons.current.get(active);
    const row = el?.closest<HTMLElement>("[data-lab-tools]");
    if (!el || !row) return;
    const left = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);
  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-0.5">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          ref={(el) => {
            if (el) buttons.current.set(s.id, el);
            else buttons.current.delete(s.id);
          }}
          type="button"
          role="tab"
          aria-selected={active === s.id}
          onClick={() => onPick(s.id)}
          className={cn(
            "whitespace-nowrap rounded-full px-2.5 py-1 font-mono text-xs transition-colors",
            active === s.id
              ? "bg-foreground/[0.08] text-foreground"
              : "text-tertiary-foreground hover:text-foreground",
          )}
        >
          {t(s.nav)}
        </button>
      ))}
    </div>
  );
}
