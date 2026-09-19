import type * as Contract from "../../../vitre";
import type { BezelBootState, BezelProps, BezelState, ChromeSyncOptions, ScrollPageOptions } from "vitre";
import type { Text } from "../i18n";

// =============================================================================
// The API reference, checked against the contract. Every value export of
// ../../../vitre.d.ts needs an entry here and nothing else may have one, and
// the same holds for the fields of each public interface: a new prop or export
// that is not documented fails the type check.
// =============================================================================

export type SectionId =
  | "intro"
  | "enabled"
  | "band"
  | "radius"
  | "color"
  | "theme"
  | "scroll"
  | "backdrop"
  | "chrome"
  | "boot"
  | "pageScroll"
  | "state"
  | "api"
  | "safari";

export interface ExportDoc {
  kind: "component" | "hook" | "function" | "constant";
  signature: string;
  summary: Text;
  section: SectionId;
}

export const EXPORTS: { [K in keyof typeof Contract]: ExportDoc } = {
  Bezel: {
    kind: "component",
    signature: "<Bezel enabled color band? radius? scroll? ground backdrop? className? style?>",
    summary: { en: "The bezel, the chrome colour and the page's scroll container, in one. Render it once, around the page.", zh: "bezel、浏览器 chrome 的颜色和页面的滚动容器，三合一。在页面外层渲染一次即可。" },
    section: "enabled",
  },
  useBezel: {
    kind: "hook",
    signature: "useBezel(): BezelState",
    summary: { en: "What the bezel is showing, resolved. A disabled default outside <Bezel>.", zh: "bezel 当前实际显示的状态。在 <Bezel> 之外返回一个关闭状态的默认值。" },
    section: "state",
  },
  bezelBootScript: {
    kind: "function",
    signature: "bezelBootScript(resolver: string): string",
    summary: { en: "An inline <head> script that paints the first frame from your settings before React runs.", zh: "放在 <head> 里的内联脚本，在 React 运行前按你的设置画出第一帧。" },
    section: "boot",
  },
  readBezelBoot: {
    kind: "function",
    signature: "readBezelBoot(): BezelBootState | null",
    summary: { en: "The state the boot script applied, or null if none ran.", zh: "启动脚本应用的状态；没有运行过则为 null。" },
    section: "boot",
  },
  syncChrome: {
    kind: "function",
    signature: "syncChrome(color: string, options?: ChromeSyncOptions): void",
    summary: { en: "Make Safari's chrome show a colour now, by morphing a fixed bezel to 8px and back.", zh: "让 Safari 的 chrome 立刻显示某个颜色：把一个 fixed 的 bezel 变形到 8px 再收回。" },
    section: "chrome",
  },
  usePageScroll: {
    kind: "hook",
    signature: "usePageScroll(listener: () => void): void",
    summary: { en: "Run a listener on page scroll, in whichever element it happens.", zh: "页面滚动时调用回调，无论滚动发生在哪个元素上。" },
    section: "pageScroll",
  },
  getScrollContainer: {
    kind: "function",
    signature: "getScrollContainer(): HTMLElement | null",
    summary: { en: "The element the page scrolls in, or null for the viewport when the window scrolls.", zh: "页面滚动所在的元素；window 滚动时为 null，表示视口。" },
    section: "pageScroll",
  },
  pageScrollTop: {
    kind: "function",
    signature: "pageScrollTop(): number",
    summary: { en: "How far the page is scrolled.", zh: "页面已经滚动的距离。" },
    section: "pageScroll",
  },
  pageScrollHeight: {
    kind: "function",
    signature: "pageScrollHeight(): number",
    summary: { en: "The page's full scrollable height.", zh: "页面可滚动的总高度。" },
    section: "pageScroll",
  },
  pageViewportHeight: {
    kind: "function",
    signature: "pageViewportHeight(): number",
    summary: { en: "The height of the visible part of the page.", zh: "页面可见部分的高度。" },
    section: "pageScroll",
  },
  pageOffsetOf: {
    kind: "function",
    signature: "pageOffsetOf(element: Element): number",
    summary: { en: "Where an element sits in the page's scrollable content.", zh: "某个元素在页面可滚动内容中的位置。" },
    section: "pageScroll",
  },
  scrollPageTo: {
    kind: "function",
    signature: "scrollPageTo(top: number, options?: ScrollPageOptions): void",
    summary: { en: "Scroll the page to an absolute position, jumping or animating.", zh: "把页面滚动到一个绝对位置，可以直接跳转或带动画。" },
    section: "pageScroll",
  },
  onPageScroll: {
    kind: "function",
    signature: "onPageScroll(listener: () => void): () => void",
    summary: { en: "Subscribe outside React. Survives a switch between scroll modes.", zh: "在 React 之外订阅滚动。切换滚动模式后依然有效。" },
    section: "pageScroll",
  },
  emitPageScroll: {
    kind: "function",
    signature: "emitPageScroll(): void",
    summary: { en: "Fire page scroll listeners without scrolling, to force a re-measure.", zh: "不滚动也触发一次滚动回调，用来强制重新测量。" },
    section: "pageScroll",
  },
  BEZEL_INSET: {
    kind: "constant",
    signature: "BEZEL_INSET: CSSProperties",
    summary: { en: "The box inside the bezel, as inline style, for layers that must stop where it begins.", zh: "bezel 内侧的区域，以内联样式给出，用于需要停在 bezel 边缘的图层。" },
    section: "backdrop",
  },
  BEZEL_LAYER_ATTRIBUTE: {
    kind: "constant",
    signature: 'BEZEL_LAYER_ATTRIBUTE: "data-bezel-layer"',
    summary: { en: "Marks a full-screen fixed layer that must become absolute in container scroll.", zh: "标记一个全屏 fixed 图层，让它在 container 滚动时变为 absolute。" },
    section: "backdrop",
  },
  CHROME_SAMPLE_PX: {
    kind: "constant",
    signature: "CHROME_SAMPLE_PX: 6",
    summary: { en: "Thinnest fixed content, px, that iOS 26 Safari's chrome follows.", zh: "iOS 26 Safari 的 chrome 会跟随的 fixed 内容最小厚度（px）。" },
    section: "chrome",
  },
  CHROME_MORPH_PX: {
    kind: "constant",
    signature: "CHROME_MORPH_PX: 8",
    summary: { en: "The band syncChrome morphs to.", zh: "syncChrome 变形时 band 增长到的厚度。" },
    section: "chrome",
  },
  DEFAULT_BEZEL_BAND: {
    kind: "constant",
    signature: "DEFAULT_BEZEL_BAND: 0",
    summary: { en: "The band when none is given.", zh: "未指定时的 band。" },
    section: "band",
  },
  DEFAULT_BEZEL_RADIUS: {
    kind: "constant",
    signature: "DEFAULT_BEZEL_RADIUS: 16",
    summary: { en: "The radius when none is given.", zh: "未指定时的圆角。" },
    section: "radius",
  },
  BEZEL_BAND_MIN: { kind: "constant", signature: "BEZEL_BAND_MIN: 0", summary: { en: "Smallest band.", zh: "band 最小值。" }, section: "band" },
  BEZEL_BAND_MAX: { kind: "constant", signature: "BEZEL_BAND_MAX: 64", summary: { en: "Largest band.", zh: "band 最大值。" }, section: "band" },
  BEZEL_RADIUS_MIN: { kind: "constant", signature: "BEZEL_RADIUS_MIN: 0", summary: { en: "Smallest radius.", zh: "圆角最小值。" }, section: "radius" },
  BEZEL_RADIUS_MAX: { kind: "constant", signature: "BEZEL_RADIUS_MAX: 64", summary: { en: "Largest radius.", zh: "圆角最大值。" }, section: "radius" },
  clampBezelBand: {
    kind: "function",
    signature: "clampBezelBand(px: number): number",
    summary: { en: "Round and clamp a band to the allowed range.", zh: "把 band 取整并限制在允许范围内。" },
    section: "band",
  },
  clampBezelRadius: {
    kind: "function",
    signature: "clampBezelRadius(px: number): number",
    summary: { en: "Round and clamp a radius to the allowed range.", zh: "把圆角取整并限制在允许范围内。" },
    section: "radius",
  },
};

export interface FieldDoc {
  type: string;
  default?: string;
  summary: Text;
}

export const BEZEL_PROPS: { [K in keyof Required<BezelProps>]: FieldDoc } = {
  enabled: {
    type: "boolean | null",
    summary: { en: "Whether the bezel is drawn. Live. null holds what the boot script applied until the host knows.", zh: "是否绘制 bezel。实时生效。null 表示宿主还不确定，保持启动脚本应用的状态。" },
  },
  color: { type: "string", summary: { en: "The bezel colour. Any CSS colour. Live; the chrome follows.", zh: "bezel 的颜色，任意 CSS 颜色。实时生效，chrome 会跟随。" } },
  band: { type: "number", default: "0", summary: { en: "Band thickness on the top and bottom edges, px. Live.", zh: "上下边缘 band 的厚度（px）。实时生效。" } },
  radius: { type: "number", default: "16", summary: { en: "Inner corner radius, px. Live.", zh: "内侧圆角半径（px）。实时生效。" } },
  scroll: { type: '"window" | "container"', default: '"window"', summary: { en: "Where the page scrolls. Live.", zh: "页面在哪里滚动。实时生效。" } },
  ground: { type: "string", summary: { en: "The chrome colour while the bezel is off: the page's ground. Live.", zh: "bezel 关闭时 chrome 的颜色，也就是页面底色。实时生效。" } },
  chromeMorph: {
    type: "boolean",
    default: "true",
    summary: { en: "Morph each chrome colour change onto the screen, for a chrome that samples the page (iOS Safari). false sets theme-color only, for Android Chrome, macOS Safari and desktops.", zh: "每次 chrome 颜色变化时用变形让它显示出来，适用于从页面取色的 chrome（iOS Safari）。设为 false 时只设置 theme-color，适用于 Android Chrome、macOS Safari 和桌面端。" },
  },
  backdrop: { type: "ReactNode", summary: { en: "Layers behind the page and inside the bezel.", zh: "位于页面之后、bezel 之内的图层。" } },
  className: { type: "string", summary: { en: "Class for the scroll container, which wraps children.", zh: "滚动容器的 class，滚动容器包裹 children。" } },
  style: { type: "CSSProperties", summary: { en: "Style for the scroll container, merged over its inset.", zh: "滚动容器的样式，会合并在它的内缩样式之上。" } },
  children: { type: "ReactNode", summary: { en: "The page.", zh: "页面内容。" } },
};

export const BEZEL_STATE: { [K in keyof BezelState]: FieldDoc } = {
  enabled: { type: "boolean", summary: { en: "Whether the bezel is drawn.", zh: "是否绘制 bezel。" } },
  color: { type: "string", summary: { en: "The bezel colour.", zh: "bezel 的颜色。" } },
  band: { type: "number", summary: { en: "Band thickness, px.", zh: "band 厚度（px）。" } },
  radius: { type: "number", summary: { en: "Inner corner radius, px.", zh: "内侧圆角半径（px）。" } },
  scroll: { type: '"window" | "container"', summary: { en: "Where the page scrolls.", zh: "页面在哪里滚动。" } },
  ground: { type: "string", summary: { en: "The chrome colour while the bezel is off.", zh: "bezel 关闭时 chrome 的颜色。" } },
};

export const BOOT_STATE: { [K in keyof BezelBootState]: FieldDoc } = {
  enabled: { type: "boolean", summary: { en: "Draw the bezel on the first frame.", zh: "第一帧是否绘制 bezel。" } },
  color: { type: "string", summary: { en: "Its colour.", zh: "它的颜色。" } },
  band: { type: "number", summary: { en: "Its band, px.", zh: "它的 band（px）。" } },
  scroll: { type: '"window" | "container"', summary: { en: "Where the page scrolls from the first frame.", zh: "从第一帧起页面在哪里滚动。" } },
  ground: { type: "string", summary: { en: "The chrome colour while the bezel is off.", zh: "bezel 关闭时 chrome 的颜色。" } },
};

export const CHROME_SYNC_OPTIONS: { [K in keyof Required<ChromeSyncOptions>]: FieldDoc } = {
  band: { type: "number", default: "0", summary: { en: "The band showing now; the morph starts and ends here.", zh: "当前显示的 band，变形从这里开始、在这里结束。" } },
  radius: { type: "number", default: "0", summary: { en: "The corner radius showing now.", zh: "当前显示的圆角半径。" } },
  morph: { type: "boolean", default: "true", summary: { en: "Morph the bezel so a chrome that samples the page sees the colour. false sets theme-color and draws nothing.", zh: "让 bezel 变形，使从页面取色的 chrome 能取到颜色。设为 false 时只设置 theme-color，不绘制任何东西。" } },
};

export const SCROLL_PAGE_OPTIONS: { [K in keyof Required<ScrollPageOptions>]: FieldDoc } = {
  behavior: { type: '"auto" | "instant" | "smooth"', default: '"auto"', summary: { en: '"smooth" animates, "instant" jumps, "auto" follows CSS scroll-behavior.', zh: '"smooth" 带动画，"instant" 直接跳转，"auto" 跟随 CSS scroll-behavior。' } },
};
