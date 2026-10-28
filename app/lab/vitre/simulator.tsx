"use client";

import type {
  DemoAction,
  PhoneReport,
  PhoneScroll,
  ToPhone,
} from "@/packages/vitre/site/src/config";
import { SCENARIOS, type Scenario } from "@/packages/vitre/site/src/scenarios";
import type { SectionId } from "@/packages/vitre/site/src/docs/api";
import type { Locale } from "@/lib/i18n";
import { libraryById } from "@/systems/lab/catalog";
import { useLabStrings } from "@/systems/lab/i18n";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type RefObject,
} from "react";
import { VITRE_STRINGS } from "./strings";

// =============================================================================
// The simulator: an iPhone, drawn, running the Vitre demo.
//
// The demo has to be a document of its own: <Vitre> takes over the page it
// is on (the root's attributes, where the page scrolls, Safari's chrome). So
// the phone is an iframe of the demo build (`/vitre/?frame`), driven over
// postMessage exactly as the package's own docs page drove it: the section on
// screen runs its scenario in the phone, and the phone reports back what the
// package resolved and every scroll. Safari's bars around it are drawn from
// the page's theme-color, and the bottom toolbar collapses and expands as
// iOS 26 Safari's does.
// =============================================================================

export const PHONE = { width: 402, height: 874, status: 62 };
/** Safari's bottom toolbar, expanded and collapsed, in points. */
const TOOLBAR = { expanded: 86, collapsed: 40 };
/** Scroll distance, px, before the simulated toolbar changes state. */
const TOOLBAR_THRESHOLD = 8;
/** The demo build's page (the catalog's `demo`), never redirected. /vitre sends anything but a phone to the lab. */
export const DEMO_URL = libraryById("vitre").library.demo;

function luminance(color: string | null): number {
  const m = color?.match(/^#([0-9a-f]{6})$/i);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Safari's bottom toolbar in window scroll: the user scrolling down collapses
 * it and scrolling up expands it; the page scrolling itself leaves it, except
 * that reaching the top expands it. In container scroll the document never
 * scrolls, so it stays expanded.
 */
function useSimulatedToolbar(): [boolean, (scroll: PhoneScroll) => void] {
  const [collapsed, setCollapsed] = useState(false);
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

/**
 * The phone's latest report, outside React state: it arrives several times a
 * second while the demo scrolls, and only the phone and the active section's
 * readout read it (usePhoneReport), not the whole article around them.
 */
export interface ReportStore {
  get: () => PhoneReport | null;
  subscribe: (onChange: () => void) => () => void;
}

function createReportStore(): ReportStore & { set: (report: PhoneReport) => void } {
  let report: PhoneReport | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => report,
    set: (next) => {
      report = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function usePhoneReport(reports: ReportStore): PhoneReport | null {
  return useSyncExternalStore(reports.subscribe, reports.get, () => null);
}

export interface PhoneBridge {
  frameRef: RefObject<HTMLIFrameElement | null>;
  src: string;
  reports: ReportStore;
  collapsed: boolean;
  taps: number;
  statusTap: () => void;
  run: (action: DemoAction | "reload") => void;
}

/**
 * The phone's side of the page: loads the demo, keeps its language and its
 * light or dark with the site's (the demo's "system" is the page around it),
 * runs the active section's scenario, and hands back its reports. `enabled`
 * is false where there is no phone on screen (a phone is the device there):
 * nothing loads and nothing is sent.
 */
export function usePhoneBridge(
  active: SectionId,
  locale: Locale,
  theme: "light" | "dark",
  enabled: boolean,
): PhoneBridge {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [reports] = useState(createReportStore);
  const [collapsed, onPhoneScroll] = useSimulatedToolbar();
  // The phone's first language and theme come from its URL, so its first
  // frame is right; later changes come by message.
  const [src] = useState(() => `${DEMO_URL}?frame=1&lang=${locale}&theme=${theme}`);

  const send = useCallback((message: ToPhone) => {
    frameRef.current?.contentWindow?.postMessage(message, location.origin);
  }, []);
  const sendAction = useCallback(
    (action: DemoAction) => send({ type: "vitre-demo:action", action }),
    [send],
  );
  // The status bar: a tap flashes it and takes the page to the top, as
  // Safari's gesture does.
  const [taps, setTaps] = useState(0);
  const statusTap = useCallback(() => {
    setTaps((n) => n + 1);
    sendAction("scroll-top");
  }, [sendAction]);

  useEffect(() => {
    if (!enabled) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      const type = event.data?.type;
      if (type === "vitre-demo:ready") setReady(true);
      else if (type === "vitre-demo:report") reports.set(event.data as PhoneReport);
      else if (type === "vitre-demo:scroll") onPhoneScroll(event.data as PhoneScroll);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, onPhoneScroll, reports]);

  useEffect(() => {
    if (ready) send({ type: "vitre-demo:lang", lang: locale });
  }, [ready, locale, send]);
  useEffect(() => {
    if (ready) send({ type: "vitre-demo:theme", theme });
  }, [ready, theme, send]);

  // The active section's scenario, in the phone.
  useEffect(() => {
    if (!ready || !enabled) return;
    const scenario: Scenario = SCENARIOS[active];
    send({ type: "vitre-demo:action", action: "reset" });
    send({ type: "vitre-demo:patch", patch: scenario.base ?? {} });
    return scenario.run?.({
      patch: (patch) => send({ type: "vitre-demo:patch", patch }),
      action: sendAction,
      statusTap,
    });
  }, [active, ready, enabled, send, sendAction, statusTap]);

  const run = useCallback(
    (action: DemoAction | "reload") => {
      if (action !== "reload") return sendAction(action);
      setReady(false);
      frameRef.current?.contentWindow?.location.reload();
    },
    [sendAction],
  );

  return { frameRef, src, reports, collapsed, taps, statusTap, run };
}

/**
 * The drawn iPhone, scaled to `scale`, with the demo inside.
 *
 * Scaled by `zoom`, not a transform. A transform resamples the demo's pixels,
 * so every edge in it (the iframe's sides, the bezel's bands and corners)
 * lands between device pixels and shows a hairline of whatever is behind.
 * Zoomed, the demo lays out at its 402pt and renders at a finer device pixel
 * ratio, so its edges snap like any page under browser zoom. A browser that
 * does not zoom an iframe's document (its width comes out short) gets the
 * transform instead.
 */
export function Phone({ bridge, scale }: { bridge: PhoneBridge; scale: number }) {
  const S = useLabStrings(VITRE_STRINGS);
  const { frameRef, reports, collapsed, src, taps, statusTap } = bridge;
  const report = usePhoneReport(reports);
  const chrome = report?.themeColor ?? "#ffffff";
  const ink = luminance(chrome) > 0.6 ? "#000000" : "#ffffff";
  const toolbar = collapsed ? TOOLBAR.collapsed : TOOLBAR.expanded;
  const [zoomed, setZoomed] = useState(true);
  const fit: CSSProperties = zoomed ? { zoom: scale } : { transform: `scale(${scale})`, transformOrigin: "top left" };
  const style = {
    "--chrome": chrome,
    "--chrome-ink": ink,
    width: PHONE.width,
    height: PHONE.height,
    ...fit,
  } as CSSProperties;

  return (
    <figure className="relative m-0" style={{ width: PHONE.width * scale, height: PHONE.height * scale }}>
      <div className="phone" style={style}>
        <div className="phone-screen">
          <button type="button" className="phone-status" style={{ height: PHONE.status }} onClick={statusTap} title={S.statusTitle}>
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
            onLoad={() => {
              const width = frameRef.current?.contentWindow?.innerWidth;
              if (width && Math.abs(width - PHONE.width) > 1) setZoomed(false);
            }}
          />
          <div className="phone-toolbar" data-collapsed={collapsed || undefined} style={{ height: toolbar }}>
            <span className="phone-button" aria-hidden="true">‹</span>
            <span className="phone-url">vitre</span>
            <span className="phone-button" aria-hidden="true">•••</span>
          </div>
        </div>
      </div>
      <figcaption className="absolute inset-x-0 -bottom-8 text-center text-xs text-tertiary-foreground">{S.caption}</figcaption>
    </figure>
  );
}
