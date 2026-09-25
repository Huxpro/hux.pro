import {
  Vitre,
  BEZEL_INSET,
  VITRE_LAYER_ATTRIBUTE,
  getScrollContainer,
  pageScrollHeight,
  pageScrollTop,
  pageViewportHeight,
  scrollPageTo,
  useVitre,
  usePageScroll,
} from "vitre";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DEFAULT_CONFIG,
  GROUND,
  isFramed,
  loadConfig,
  resolveColor,
  resolveScroll,
  saveConfig,
  type DemoAction,
  type DemoConfig,
  type PhoneReport,
  type PhoneScroll,
  type ToPhone,
} from "../config";
import { Devtool, readThemeColor } from "../devtool/Devtool";
import { LangSwitch, useLang, useT, type Text } from "../i18n";
import { SCENARIOS, type Scenario, type ScenarioName } from "../scenarios";

// =============================================================================
// The demo: a small mobile site inside <Vitre>, the way a host uses it.
//
// Standalone (a phone visiting the site) it saves its configuration and the
// boot script paints the first frame from it. Inside the docs page's phone it
// is driven by postMessage and reports back what the package resolved.
// =============================================================================

const BACKDROPS: Record<DemoConfig["backdrop"], (dark: boolean) => string> = {
  aurora: (dark) =>
    dark
      ? "radial-gradient(120% 80% at 20% 10%, #3b2a8f 0%, transparent 60%), radial-gradient(100% 70% at 90% 40%, #0f6a7a 0%, transparent 55%), linear-gradient(180deg, #0b1026, #1a1a1a)"
      : "radial-gradient(120% 80% at 20% 10%, #b9a8ff 0%, transparent 60%), radial-gradient(100% 70% at 90% 40%, #8fe3e8 0%, transparent 55%), linear-gradient(180deg, #eef2ff, #ffffff)",
  sunset: (dark) =>
    dark
      ? "linear-gradient(165deg, #2a1033 0%, #6b1f3a 45%, #b3542b 100%)"
      : "linear-gradient(165deg, #ffd6a5 0%, #ff9f80 45%, #c75b7a 100%)",
  none: () => "none",
};

function useSystemDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return dark;
}

/**
 * Whether a scroll is the user's: Safari moves its toolbar for those alone. A
 * scroll is the user's while a pointer or finger is down on the page, or just
 * after a wheel or a scrolling key; anything else is the page scrolling itself.
 */
const USER_SCROLL_MS = 400;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
const input = { at: -Infinity, held: false };

function isUserScroll(): boolean {
  return input.held || performance.now() - input.at < USER_SCROLL_MS;
}

function useUserInput() {
  useEffect(() => {
    const now = () => (input.at = performance.now());
    const hold = () => ((input.held = true), now());
    const release = () => ((input.held = false), now());
    const key = (event: Event) => SCROLL_KEYS.has((event as KeyboardEvent).key) && now();
    const listeners: [string, EventListener][] = [
      ["wheel", now],
      ["touchstart", hold],
      ["touchend", release],
      ["pointerdown", hold],
      ["pointerup", release],
      ["keydown", key],
    ];
    for (const [type, fn] of listeners) window.addEventListener(type, fn, { capture: true, passive: true });
    return () => {
      for (const [type, fn] of listeners) window.removeEventListener(type, fn, { capture: true });
    };
  }, []);
}

function runAction(action: DemoAction, reset: () => void) {
  const max = Math.max(0, pageScrollHeight() - pageViewportHeight());
  const smooth = { behavior: "smooth" } as const;
  if (action === "scroll-top") scrollPageTo(0, smooth);
  else if (action === "scroll-middle") scrollPageTo(Math.round(max / 2), smooth);
  else if (action === "scroll-bottom") scrollPageTo(max, smooth);
  else if (action === "reset") {
    reset();
    scrollPageTo(0);
  }
}

export function Demo() {
  const [config, setConfig] = useState<DemoConfig>(loadConfig);
  const [devtoolOpen, setDevtoolOpen] = useState(false);
  const [running, setRunning] = useState<ScenarioName | null>(null);
  const systemDark = useSystemDark();
  const theme: "light" | "dark" =
    config.theme === "system" ? (systemDark ? "dark" : "light") : config.theme;

  const patch = useCallback((p: Partial<DemoConfig>) => {
    setConfig((c) => {
      const next = { ...c, ...p };
      saveConfig(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => {
    setRunning(null);
    setConfig(DEFAULT_CONFIG);
    saveConfig(DEFAULT_CONFIG);
  }, []);
  const action = useCallback((a: DemoAction) => runAction(a, reset), [reset]);

  // A scenario from a card: its base now, then its script until stopped.
  const run = useCallback((name: ScenarioName | null) => {
    setRunning(name);
    if (name) setConfig({ ...DEFAULT_CONFIG, ...(SCENARIOS[name] as Scenario).base });
  }, []);
  useEffect(() => {
    if (!running) return;
    const scenario: Scenario = SCENARIOS[running];
    const script = !isFramed() && scenario.onPhone ? scenario.onPhone : scenario.run;
    // A phone has a real status bar; the tap is the user's own.
    return script?.({ patch, action, statusTap: () => action("scroll-top") });
  }, [running, patch, action]);

  // Driven by the docs page.
  const { setLang } = useLang();
  useEffect(() => {
    if (!isFramed()) return;
    const onMessage = (event: MessageEvent<ToPhone>) => {
      if (event.origin !== location.origin) return;
      const data = event.data;
      if (data?.type === "vitre-demo:patch") patch(data.patch);
      else if (data?.type === "vitre-demo:action") action(data.action);
      else if (data?.type === "vitre-demo:lang") setLang(data.lang);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "vitre-demo:ready" }, location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [patch, action, setLang]);

  // The page's own ground, painted by the host, as a real site does.
  useEffect(() => {
    document.body.style.background = GROUND[theme];
    document.body.style.color = theme === "dark" ? "#f4f4f5" : "#18181b";
    document.body.dataset.theme = theme;
  }, [theme]);

  const color = resolveColor(config, theme);
  const scroll = resolveScroll(config);

  return (
    <Vitre
      enabled={config.enabled}
      color={color}
      band={config.band}
      radius={config.radius}
      scroll={scroll}
      ground={GROUND[theme]}
      backdrop={
        config.backdrop !== "none" && (
          <div
            aria-hidden="true"
            {...{ [VITRE_LAYER_ATTRIBUTE]: "" }}
            style={{
              position: "fixed",
              zIndex: -1,
              background: BACKDROPS[config.backdrop](theme === "dark"),
              ...(config.enabled ? BEZEL_INSET : { inset: 0 }),
            }}
          />
        )
      }
      className="demo-scroll"
    >
      <Reporter theme={theme} />
      <DemoPage running={running} onRun={run} theme={theme} />
      {!devtoolOpen && (
        <button type="button" className="demo-fab" onClick={() => setDevtoolOpen(true)}>
          DEBUG
        </button>
      )}
      {devtoolOpen && (
        <Devtool
          config={config}
          theme={theme}
          onPatch={(p) => {
            setRunning(null);
            patch(p);
          }}
          onAction={action}
          onClose={() => setDevtoolOpen(false)}
        />
      )}
    </Vitre>
  );
}

/** Inside the docs page: tell the docs what the package resolved. */
function Reporter({ theme }: { theme: "light" | "dark" }) {
  const state = useVitre();
  const last = useRef("");
  useUserInput();
  // Every scroll, straight away: the docs move the simulated toolbar with it.
  usePageScroll(() => {
    if (!isFramed()) return;
    const message: PhoneScroll = {
      user: isUserScroll(),
      type: "vitre-demo:scroll",
      top: Math.round(pageScrollTop()),
      // From the page, not from state: a mode switch scrolls before React re-renders.
      scroll: getScrollContainer() ? "container" : "window",
    };
    window.parent.postMessage(message, location.origin);
  });
  useEffect(() => {
    if (!isFramed()) return;
    const send = () => {
      const report: PhoneReport = {
        type: "vitre-demo:report",
        theme,
        state: state as unknown as Record<string, unknown>,
        themeColor: readThemeColor(),
        scrollTop: Math.round(pageScrollTop()),
      };
      const json = JSON.stringify(report);
      if (json === last.current) return;
      last.current = json;
      window.parent.postMessage(report, location.origin);
    };
    send();
    const id = window.setInterval(send, 250);
    return () => window.clearInterval(id);
  }, [theme, state]);
  return null;
}

const CARDS: { name: ScenarioName; title: string; body: Text }[] = [
  { name: "enabled", title: "enabled", body: { en: "Turn the bezel on and off, live. The chrome follows.", zh: "实时开关 bezel，chrome 会跟着变。" } },
  { name: "band", title: "band", body: { en: "The top and bottom band, from 0px up. The page stops inside it.", zh: "上下两条 band，从 0px 起。页面停在 band 里面。" } },
  { name: "radius", title: "radius", body: { en: "The inner corners that round the page off.", zh: "内侧圆角，把页面四角修圆。" } },
  { name: "color", title: "color", body: { en: "Any CSS colour. Each change is shown to Safari's chrome.", zh: "任意 CSS 颜色，每次变色都会同步给 Safari 的 chrome。" } },
  { name: "theme", title: "theme & ground", body: { en: "A colour that follows light and dark, and the ground the chrome takes when the bezel is off.", zh: "跟随深浅色的颜色，以及 bezel 关闭时 chrome 显示的页面底色。" } },
  { name: "scroll", title: "scroll", body: { en: "The window, or a container while the window holds still, as ryOS does.", zh: "window 滚动，或者 window 不动、在容器里滚（ryOS 的做法）。" } },
  { name: "statusTap", title: "status-bar tap", body: { en: "Switches to container scroll and scrolls down. Tap the status bar to come back to the top.", zh: "切到 container 滚动并滚到下面。点一下状态栏，就会回到顶部。" } },
  { name: "backdrop", title: "backdrop", body: { en: "Layers painted behind the page and inside the bezel.", zh: "画在页面后面、bezel 里面的图层。" } },
  { name: "chrome", title: "syncChrome", body: { en: "The bezel morphs to 8px so Safari samples the new colour, then back.", zh: "bezel 变形到 8px 让 Safari 取到新颜色，再收回来。" } },
  { name: "pageScroll", title: "page scroll helpers", body: { en: "Read and drive scroll in either mode.", zh: "在两种滚动模式下读取和控制滚动。" } },
];

function DemoPage({
  running,
  onRun,
  theme,
}: {
  running: ScenarioName | null;
  onRun: (name: ScenarioName | null) => void;
  theme: "light" | "dark";
}) {
  const t = useT();
  const card: CSSProperties = {
    background: theme === "dark" ? "rgba(24,24,27,0.62)" : "rgba(255,255,255,0.66)",
  };
  return (
    <main className="demo-page">
      <header className="demo-hero">
        <div className="demo-hero-top">
          <p className="demo-kicker">{t({ en: "Vitre", zh: "窗玻璃" })}</p>
          {!isFramed() && <LangSwitch />}
        </div>
        <h1>{t({ en: "Safari's glass, in your colours", zh: "让 Safari 的玻璃，显示你的颜色" })}</h1>
        <p>
          {t({
            en: "Vitre tints Safari's toolbar and status bar live, draws a bezel around the page, and scrolls the page in a container so the edges hold still. Tap a card to see one feature, or open the devtool.",
            zh: "窗玻璃（Vitre）实时给 Safari 的工具栏和状态栏着色，给页面画一圈 bezel，再让页面在容器里滚动，边缘就稳住了。点一张卡片看一个功能，或者打开 devtool。",
          })}
        </p>
      </header>
      {running && (
        <button type="button" className="demo-stop" onClick={() => onRun(null)}>
          {t({ en: "Stop", zh: "停止" })} “{CARDS.find((c) => c.name === running)?.title}”
        </button>
      )}
      <div className="demo-cards">
        {CARDS.map((c) => (
          <button
            key={c.name}
            type="button"
            className="demo-card"
            style={card}
            data-running={running === c.name || undefined}
            onClick={() => onRun(running === c.name ? null : c.name)}
          >
            <span className="demo-card-title">{c.title}</span>
            <span className="demo-card-body">{t(c.body)}</span>
          </button>
        ))}
      </div>
      <section className="demo-rows" style={card}>
        {Array.from({ length: 24 }, (_, i) => (
          <p key={i}>
            {t({
              en: `Row ${i + 1}. Something to scroll past, so the container, the helpers and the toolbar have work to do.`,
              zh: `第 ${i + 1} 行。一些可以滚过去的内容，让滚动容器、工具函数和工具栏都有事可做。`,
            })}
          </p>
        ))}
      </section>
    </main>
  );
}
