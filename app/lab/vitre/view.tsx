"use client";

// =============================================================================
// Vitre Lab — /lab/vitre. A library, published from the lab.
//
// The labs study this site's systems; some of those systems are libraries
// that can leave it. Vitre is the first: its page here is its whole home —
// the documentation and the simulator, in the lab's frame. There is no other
// docs page: /vitre is only the demo now (a phone, or the phone drawn here).
//
//   bar        the lab's name and switcher, and the section tabs
//   phone      a drawn iPhone running the demo build (simulator.tsx), pinned
//              beside the article; the section in the middle of the screen
//              runs its scenario in it
//   article    the package's own documentation (packages/vitre/site/src/docs),
//              in the site's type (docs.css). api.ts there fails the type
//              check for an export or a prop that is not documented, so the
//              contract stays with the package
//
// On a phone there is no simulator — the phone is the device — and the
// article opens with the way into the real demo instead.
//
// Nothing here touches the site's own vitre (the bezel this page is framed
// by). The simulator is its own document, with its own <Vitre>.
// =============================================================================

import { useLabStrings } from "@/app/lab/i18n";
import { LabShell, labButtonClass } from "@/app/lab/shell";
import type { SectionId } from "@/packages/vitre/site/src/docs/api";
import { SECTIONS, SectionCovers } from "@/packages/vitre/site/src/docs/sections";
import { formatValue } from "@/packages/vitre/site/src/devtool/controls";
import { LangProvider, useT } from "@/packages/vitre/site/src/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale, useTheme } from "@/services";
import { ArrowUpRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEMO_URL, PHONE, Phone, usePhoneBridge, type PhoneBridge } from "./simulator";
import { VITRE_STRINGS } from "./strings";
import "./docs.css";

/** From here the page has room for the phone beside the article (the demo's own phone breakpoint, 767px, is below it). */
const WIDE = "(min-width: 768px)";

function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = matchMedia(WIDE);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => matchMedia(WIDE).matches,
    () => false,
  );
}

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
  const wide = useWide();
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id);
  const bridge = usePhoneBridge(active, locale, theme, wide);

  // The section in the middle of the viewport is the active one — except
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
    <LabShell
      lab="vitre"
      layout="canvas"
      tools={<SectionTabs active={active} onPick={pick} label={S.sections} />}
    >
      <div className="vitre-lab md:grid md:grid-cols-[minmax(320px,42%)_minmax(0,1fr)] md:gap-10 lg:gap-16">
        <aside className="sticky top-[var(--lab-under-bar)] hidden h-[calc(100svh-var(--lab-under-bar))] items-center justify-center pb-10 md:flex">
          {wide && <FittedPhone bridge={bridge} caption={S.caption} statusTitle={S.statusTitle} />}
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
              bridge={bridge}
              liveLabel={S.live}
            />
          ))}
          {/* Beside the simulator, the way to the real thing. */}
          <p className={cn(TYPE.caption, "hidden border-t border-border/50 pt-6 md:block")}>{S.onIphone}</p>
        </article>
      </div>
    </LabShell>
  );
}

/** The phone, as large as its column lets it be (never past its own size). */
function FittedPhone({ bridge, caption, statusTitle }: { bridge: PhoneBridge; caption: string; statusTitle: string }) {
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
      <Phone bridge={bridge} scale={scale} caption={caption} statusTitle={statusTitle} />
    </div>
  );
}

type Section = (typeof SECTIONS)[number];

function DocSection({
  section: s,
  active,
  wide,
  bridge,
  liveLabel,
}: {
  section: Section;
  active: boolean;
  wide: boolean;
  bridge: PhoneBridge;
  liveLabel: string;
}) {
  const t = useT();
  // What the phone reports, and the buttons that drive it, only mean
  // something where there is a phone.
  const live = wide && active ? s.live?.(bridge.report) : null;
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
      {s.code && <CodeBlock code={s.code} />}
      {wide && s.actions && (
        <div className="mt-4 flex flex-wrap gap-2">
          {s.actions.map((a) => (
            <button
              key={a.label.en}
              type="button"
              onClick={() => bridge.run(a.run)}
              className="rounded-full border border-border/60 bg-glass px-3.5 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-glass-hover"
            >
              {t(a.label)}
            </button>
          ))}
        </div>
      )}
      {live && (
        <div className="mt-4 rounded-xl border border-border/50 bg-glass px-4 py-2.5">
          <span className={TYPE.labelSm}>
            {liveLabel} · {t(live.label)}
          </span>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-foreground">{formatValue(live.value)}</pre>
        </div>
      )}
      <SectionCovers id={s.id} />
    </section>
  );
}

/** The package's highlighted code block (shiki, loaded after the page). */
function CodeBlock({ code }: { code: string }) {
  const [Code, setCode] = useState<null | ((p: { code: string }) => React.ReactNode)>(null);
  useEffect(() => {
    let live = true;
    import("@/packages/vitre/site/src/docs/Code").then((m) => live && setCode(() => m.Code));
    return () => {
      live = false;
    };
  }, []);
  if (!Code) {
    return (
      <pre className="docs-code">
        <code>{code}</code>
      </pre>
    );
  }
  return <Code code={code} />;
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
