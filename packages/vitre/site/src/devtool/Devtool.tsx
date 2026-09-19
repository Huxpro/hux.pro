import {
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  BEZEL_LAYER_ATTRIBUTE,
  BEZEL_RADIUS_MAX,
  BEZEL_RADIUS_MIN,
  CHROME_MORPH_PX,
  CHROME_SAMPLE_PX,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
  getScrollContainer,
  pageScrollHeight,
  pageScrollTop,
  pageViewportHeight,
  readBezelBoot,
  syncChrome,
  useBezel,
  usePageScroll,
} from "vitre";
import { useEffect, useState } from "react";
import {
  DEFAULT_CONFIG,
  resolveColor,
  type Backdrop,
  type ColorMode,
  type DemoAction,
  type DemoConfig,
  type ScrollMode,
  type ThemeMode,
} from "../config";
import { useT } from "../i18n";
import { ActionButton, Range, Readout, Row, Section, Segmented, Star, Toggle } from "./controls";

// =============================================================================
// The devtool: every configuration the package takes, the state it resolved,
// and what it wrote to the page — the main site's devtool Wallpaper module,
// grown to cover the whole API.
// =============================================================================

export function readHtml(): Record<string, string> {
  const html = document.documentElement;
  const out: Record<string, string> = {};
  for (const a of Array.from(html.attributes)) {
    if (a.name === "style") continue;
    out[a.name] = a.value;
  }
  for (const prop of ["--bezel-color", "--bezel-band"]) {
    const v = html.style.getPropertyValue(prop);
    if (v) out[prop] = v;
  }
  return out;
}

export function readThemeColor(): string | null {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content ?? null;
}

function useTick(ms: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

export function Devtool({
  config,
  theme,
  onPatch,
  onAction,
  onClose,
}: {
  config: DemoConfig;
  theme: "light" | "dark";
  onPatch: (patch: Partial<DemoConfig>) => void;
  onAction: (action: DemoAction) => void;
  onClose: () => void;
}) {
  const state = useBezel();
  const t = useT();
  const [scrollTop, setScrollTop] = useState(0);
  usePageScroll(() => setScrollTop(Math.round(pageScrollTop())));
  // Attributes and theme-color change outside React (the package writes them).
  useTick(500);

  const reset = <K extends keyof DemoConfig>(key: K) => () => onPatch({ [key]: DEFAULT_CONFIG[key] });
  const star = <K extends keyof DemoConfig>(key: K) => (
    <Star show={config[key] !== DEFAULT_CONFIG[key]} onReset={reset(key)} />
  );
  const color = resolveColor(config, theme);

  return (
    <div className="dt-panel" role="dialog" aria-label="Bezel devtool">
      <div className="dt-head">
        <span className="dt-head-title">Devtool</span>
        <span className="dt-badge">vitre</span>
        <button type="button" className="dt-close" onClick={onClose} aria-label="Close devtool">
          ×
        </button>
      </div>
      <div className="dt-body">
        <Section title="Bezel" badge={state.enabled ? "on" : "off"}>
          <Row label="enabled" star={star("enabled")}>
            <Toggle on={config.enabled} onChange={(enabled) => onPatch({ enabled })} label="Bezel enabled" />
          </Row>
          <Row label="band" star={star("band")}>
            <Range
              value={config.band}
              min={BEZEL_BAND_MIN}
              max={BEZEL_BAND_MAX}
              onChange={(band) => onPatch({ band })}
              label="Band"
            />
          </Row>
          <Row label="radius" star={star("radius")}>
            <Range
              value={config.radius}
              min={BEZEL_RADIUS_MIN}
              max={BEZEL_RADIUS_MAX}
              step={2}
              onChange={(radius) => onPatch({ radius })}
              label="Radius"
            />
          </Row>
        </Section>

        <Section title={t({ en: 'Colour & theme', zh: '颜色与主题' })} badge={color}>
          <Row label="color" star={star("colorMode")}>
            <Segmented<ColorMode>
              value={config.colorMode}
              options={[
                { value: "black", label: "Black" },
                { value: "dark", label: "Dark" },
                { value: "theme", label: "Theme" },
                { value: "custom", label: "Custom" },
              ]}
              onChange={(colorMode) => onPatch({ colorMode })}
            />
          </Row>
          {config.colorMode === "custom" && (
            <Row label={config.customColor} star={star("customColor")}>
              <input
                type="color"
                className="dt-color"
                value={config.customColor}
                aria-label="Custom colour"
                onChange={(e) => onPatch({ customColor: e.target.value })}
              />
            </Row>
          )}
          <Row label="theme" star={star("theme")}>
            <Segmented<ThemeMode>
              value={config.theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(t) => onPatch({ theme: t })}
            />
          </Row>
          <Row label="ground">
            <span className="dt-mono">{state.ground}</span>
          </Row>
        </Section>

        <Section title={t({ en: 'Scroll', zh: '滚动' })} badge={state.scroll}>
          <Row label="scroll" star={star("scroll")}>
            <Segmented<ScrollMode>
              value={config.scroll}
              options={[
                { value: "auto", label: "Auto" },
                { value: "window", label: "Window" },
                { value: "container", label: "Container" },
              ]}
              onChange={(scroll) => onPatch({ scroll })}
            />
          </Row>
          <Row label="pageScrollTop()">
            <span className="dt-mono">{scrollTop}px</span>
          </Row>
          <Row label="pageScrollHeight()">
            <span className="dt-mono">{Math.round(pageScrollHeight())}px</span>
          </Row>
          <Row label="pageViewportHeight()">
            <span className="dt-mono">{Math.round(pageViewportHeight())}px</span>
          </Row>
          <Row label="getScrollContainer()">
            <span className="dt-mono">{getScrollContainer() ? "#bezel-scroll" : "null (window)"}</span>
          </Row>
          <div className="dt-actions">
            <ActionButton onClick={() => onAction("scroll-top")}>scrollPageTo(0)</ActionButton>
            <ActionButton onClick={() => onAction("scroll-middle")}>{t({ en: "middle", zh: "中间" })}</ActionButton>
            <ActionButton onClick={() => onAction("scroll-bottom")}>{t({ en: "bottom", zh: "底部" })}</ActionButton>
          </div>
        </Section>

        <Section title={t({ en: 'Backdrop', zh: '背景层' })} badge={config.backdrop}>
          <Row label="backdrop" star={star("backdrop")}>
            <Segmented<Backdrop>
              value={config.backdrop}
              options={[
                { value: "aurora", label: "Aurora" },
                { value: "sunset", label: "Sunset" },
                { value: "none", label: "None" },
              ]}
              onChange={(backdrop) => onPatch({ backdrop })}
            />
          </Row>
          <Row label={BEZEL_LAYER_ATTRIBUTE}>
            <span className="dt-mono">{t({ en: "on the backdrop", zh: "已加在背景层上" })}</span>
          </Row>
        </Section>

        <Section title={t({ en: 'Chrome', zh: 'Chrome' })} badge={readThemeColor() ?? "—"}>
          <Row label="theme-color">
            <span className="dt-mono">{readThemeColor() ?? "none"}</span>
          </Row>
          <div className="dt-actions">
            <ActionButton onClick={() => syncChrome(color, { band: config.band, radius: config.radius })}>
              syncChrome(color)
            </ActionButton>
            <ActionButton onClick={() => syncChrome("#c1440e", { band: config.band, radius: config.radius })}>
              syncChrome(&quot;#c1440e&quot;)
            </ActionButton>
          </div>
        </Section>

        <Section title={t({ en: 'Boot & <html>', zh: '启动与 <html>' })} defaultOpen={false}>
          <Row label="readBezelBoot()" />
          <Readout value={readBezelBoot()} />
          <Row label={t({ en: "<html> now", zh: "当前 <html>" })} />
          <Readout value={readHtml()} />
          <div className="dt-actions">
            <ActionButton onClick={() => location.reload()}>{t({ en: "Reload", zh: "刷新" })}</ActionButton>
          </div>
        </Section>

        <Section title="useBezel()" defaultOpen={false}>
          <Readout value={state} />
        </Section>

        <Section title={t({ en: 'Constants', zh: '常量' })} defaultOpen={false}>
          <Readout
            value={{
              CHROME_SAMPLE_PX,
              CHROME_MORPH_PX,
              DEFAULT_BEZEL_BAND,
              DEFAULT_BEZEL_RADIUS,
              BEZEL_BAND_MIN,
              BEZEL_BAND_MAX,
              BEZEL_RADIUS_MIN,
              BEZEL_RADIUS_MAX,
            }}
          />
        </Section>

        <div className="dt-actions dt-footer">
          <ActionButton onClick={() => onAction("reset")}>{t({ en: "Reset everything", zh: "全部重置" })}</ActionButton>
        </div>
      </div>
    </div>
  );
}
