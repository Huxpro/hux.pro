import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { DemoAction, PhoneReport, PhoneScroll, ToPhone } from "../config";
import { LangSwitch, useLang, useT } from "../i18n";
import { Code } from "./Code";
import { formatValue } from "../devtool/controls";
import { SCENARIOS, type Scenario } from "../scenarios";
import type { SectionId } from "./api";
import { SECTIONS, SectionCovers } from "./sections";

// =============================================================================
// The documentation page, for anything wider than a phone. A simulated iPhone
// stays on screen while the article scrolls; whichever section is in the middle
// of the viewport runs its scenario in the phone.
// =============================================================================

const PHONE = { width: 402, height: 874, status: 62 };
/** Safari's bottom toolbar, expanded and collapsed, in points. */
const TOOLBAR = { expanded: 86, collapsed: 40 };
/** Scroll distance, px, before the simulated toolbar changes state. */
const TOOLBAR_THRESHOLD = 8;

function luminance(color: string | null): number {
  const m = color?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Safari's bottom toolbar, simulated as iOS 26 Safari behaves in window scroll:
 * the user scrolling down collapses it and scrolling up expands it; the page
 * scrolling itself leaves it as it is, except that reaching the top expands it.
 * In container scroll the document never scrolls, so it stays expanded.
 * Returns whether it is collapsed, and what to do with each scroll message.
 */
function useSimulatedToolbar(): [boolean, (scroll: PhoneScroll) => void] {
  const [collapsed, setCollapsed] = useState(false);
  // The last scroll top, kept across modes so a switch is not read as a scroll.
  // A ref, so a scroll that changes nothing re-renders nothing.
  const last = useRef<number | null>(null);
  const onScroll = useCallback((scroll: PhoneScroll) => {
    const prev = last.current;
    last.current = scroll.top;
    if (scroll.scroll !== "window" || scroll.top <= 0) setCollapsed(false);
    else if (!scroll.user || prev === null) return;
    else if (scroll.top - prev > TOOLBAR_THRESHOLD) setCollapsed(true);
    else if (prev - scroll.top > TOOLBAR_THRESHOLD) setCollapsed(false);
  }, []);
  return [collapsed, onScroll];
}

function Phone({
  frameRef,
  report,
  collapsed,
  src,
  taps,
  onStatusTap,
}: {
  frameRef: React.RefObject<HTMLIFrameElement | null>;
  report: PhoneReport | null;
  collapsed: boolean;
  src: string;
  /** Status-bar taps so far; each one flashes the bar. */
  taps: number;
  onStatusTap: () => void;
}) {
  const t = useT();
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 96) / PHONE.height));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const chrome = report?.themeColor ?? "#ffffff";
  const ink = luminance(chrome) > 0.6 ? "#000000" : "#ffffff";
  const toolbar = collapsed ? TOOLBAR.collapsed : TOOLBAR.expanded;
  const style = {
    "--chrome": chrome,
    "--chrome-ink": ink,
    width: PHONE.width,
    height: PHONE.height,
    transform: `scale(${scale})`,
  } as CSSProperties;

  return (
    <figure className="phone-wrap" style={{ height: PHONE.height * scale, width: PHONE.width * scale }}>
      <div className="phone" style={style}>
        <button
          type="button"
          className="phone-status"
          style={{ height: PHONE.status }}
          onClick={onStatusTap}
          title={t({ en: "Tap to scroll to the top", zh: "点击回到顶部" })}
        >
          {taps > 0 && <span key={taps} className="phone-status-flash" aria-hidden="true" />}
          <span className="phone-time">9:41</span>
          <span className="phone-island" />
          <span className="phone-icons">●●● ◐</span>
        </button>
        <iframe
          ref={frameRef}
          title="Vitre demo"
          src={src}
          style={{ height: PHONE.height - PHONE.status - toolbar }}
        />
        <div className="phone-toolbar" data-collapsed={collapsed || undefined} style={{ height: toolbar }}>
          <span className="phone-button" aria-hidden="true">‹</span>
          <span className="phone-url">vitre</span>
          <span className="phone-button" aria-hidden="true">•••</span>
        </div>
      </div>
      <figcaption>
        {t({
          en: "Safari's bars are simulated from the page's theme-color.",
          zh: "Safari 的状态栏和工具栏根据页面的 theme-color 模拟。",
        })}
      </figcaption>
    </figure>
  );
}

/**
 * The section switcher: the main site's segmented control, with a pill that
 * slides to the active section. It scrolls sideways with snap, and keeps the
 * active section centred as the article scrolls or a section is picked.
 */
function SectionTabs({ active, onPick }: { active: SectionId; onPick: (id: SectionId) => void }) {
  const t = useT();
  const { lang } = useLang();
  const track = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const place = useCallback(
    (smooth: boolean) => {
      const el = buttons.current.get(active);
      const scroller = track.current;
      if (!el || !scroller) return;
      setPill({ left: el.offsetLeft, width: el.offsetWidth });
      const left = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
      scroller.scrollTo({ left: Math.max(0, left), behavior: smooth ? "smooth" : "auto" });
    },
    [active]
  );

  useLayoutEffect(() => place(true), [place, lang]);
  useEffect(() => {
    const onResize = () => place(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [place]);

  return (
    <div className="tabs" ref={track} role="tablist" aria-label={t({ en: "Sections", zh: "章节" })}>
      <div className="tabs-row">
        {pill && <span className="tabs-pill" style={{ transform: `translateX(${pill.left}px)`, width: pill.width }} />}
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
            data-active={active === s.id || undefined}
            onClick={() => onPick(s.id)}
          >
            {t(s.nav)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Docs() {
  const t = useT();
  const { lang } = useLang();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id);
  const [report, setReport] = useState<PhoneReport | null>(null);
  const [collapsed, onPhoneScroll] = useSimulatedToolbar();
  // The phone's first language comes from its URL; later changes go by message.
  const [frameSrc] = useState(() => `${import.meta.env.BASE_URL}index.html?frame=1&lang=${lang}`);

  const send = useCallback((message: ToPhone) => {
    frameRef.current?.contentWindow?.postMessage(message, location.origin);
  }, []);
  const sendAction = useCallback((action: DemoAction) => send({ type: "vitre-demo:action", action }), [send]);
  // The phone's status bar: a tap flashes it, and takes the page to the top as
  // Safari's gesture does.
  const [taps, setTaps] = useState(0);
  const statusTap = useCallback(() => {
    setTaps((n) => n + 1);
    sendAction("scroll-top");
  }, [sendAction]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const type = event.data?.type;
      if (type === "vitre-demo:ready") setReady(true);
      else if (type === "vitre-demo:report") setReport(event.data as PhoneReport);
      else if (type === "vitre-demo:scroll") onPhoneScroll(event.data as PhoneScroll);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onPhoneScroll]);

  useEffect(() => {
    if (ready) send({ type: "vitre-demo:lang", lang });
  }, [ready, lang, send]);

  // The section in the middle of the viewport is the active one — except while
  // a picked section is being scrolled to, so the phone does not run every
  // scenario in between.
  const picking = useRef<number | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (picking.current !== null) return;
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id as SectionId);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    document.querySelectorAll("[data-doc-section]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const pick = useCallback((id: SectionId) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    if (picking.current !== null) window.clearTimeout(picking.current);
    picking.current = window.setTimeout(() => {
      picking.current = null;
    }, 900);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Run the active section's scenario in the phone.
  useEffect(() => {
    if (!ready) return;
    const scenario: Scenario = SCENARIOS[active];
    send({ type: "vitre-demo:action", action: "reset" });
    send({ type: "vitre-demo:patch", patch: scenario.base ?? {} });
    return scenario.run?.({
      patch: (patch) => send({ type: "vitre-demo:patch", patch }),
      action: sendAction,
      statusTap,
    });
  }, [active, ready, send, sendAction, statusTap]);

  const runAction = (run: DemoAction | "reload") => {
    if (run !== "reload") return sendAction(run);
    setReady(false);
    frameRef.current?.contentWindow?.location.reload();
  };

  return (
    <div className="docs">
      <aside className="docs-phone">
        <Phone
          frameRef={frameRef}
          report={report}
          collapsed={collapsed}
          src={frameSrc}
          taps={taps}
          onStatusTap={statusTap}
        />
      </aside>
      <article className="docs-article">
        <div className="docs-nav">
          <SectionTabs active={active} onPick={pick} />
          <LangSwitch />
        </div>
        {SECTIONS.map((s) => {
          const live = active === s.id ? s.live?.(report) : null;
          return (
            <section
              key={s.id}
              id={s.id}
              data-doc-section
              className="docs-section"
              data-active={active === s.id || undefined}
            >
              <p className="docs-eyebrow">{s.eyebrow}</p>
              <h2>{t(s.title)}</h2>
              <p className="docs-lede">{t(s.lede)}</p>
              {s.body && t(s.body)}
              {s.code && <Code code={s.code} />}
              {s.actions && (
                <div className="docs-actions">
                  {s.actions.map((a) => (
                    <button key={a.label.en} type="button" onClick={() => runAction(a.run)}>
                      {t(a.label)}
                    </button>
                  ))}
                </div>
              )}
              {live && (
                <div className="docs-live">
                  <span>{t(live.label)}</span>
                  <pre>{formatValue(live.value)}</pre>
                </div>
              )}
              <SectionCovers id={s.id} />
            </section>
          );
        })}
        <footer className="docs-footer">
          {t({
            en: "Open this page on an iPhone to use the demo with Safari's real chrome.",
            zh: "用 iPhone 打开这个页面，就能在真实的 Safari chrome 下使用这个 demo。",
          })}
        </footer>
      </article>
    </div>
  );
}
