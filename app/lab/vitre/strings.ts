import type { LabTable } from "@/app/lab/i18n";

const en = {
  // Bar
  docs: "Demo & docs",
  meta: (on: boolean, color: string, band: number, radius: number, scroll: string) =>
    `bezel ${on ? "on" : "off"} · ${color} · band ${band}px · radius ${radius}px · scroll ${scroll}`,

  // Now
  now: "Now",
  nowNote:
    "What vitre is drawing on this page, read from the package itself (useVitre). Turn the bezel on in the panel and it draws here, on any screen — on an iPhone it also tints Safari's bars.",
  stateBezel: "bezel",
  stateChrome: "chrome",
  stateBand: "band",
  stateRadius: "radius",
  stateScroll: "scroll",
  stateGround: "ground",
  statePlatform: "platform",
  stateScrollTop: "page scrolled",
  on: "on",
  off: "off",
  ios: "iOS",
  notIos: "not iOS — off unless forced",
  chromeNote: (color: string) => `Safari's bars show ${color}`,

  // Policy
  policy: "Policy",
  policyNote:
    "Whether the bezel is on is the wallpaper's to say (systems/ambient/lib/bezel.ts). A picture ends on a line inside a frame; a wash fades back into the page instead. On iOS only — elsewhere the browser's own window is the frame.",
  colFamily: "family",
  colLooks: "looks",
  colBezel: "bezel",
  colSoftEdge: "soft edge",
  families: { picture: "picture", wash: "wash" },
  looks: { sky: "Sky", image: "Image", gradient: "Gradient", classic: "Classic" },
  current: "now",
  forced: "forced for this visit",

  // Words
  words: "The package",
  wordsNote: "Vitre looks after three things. Each is one word in its API.",
  wordBezel: "The border around the page: a band on each edge, rounded inner corners, one colour.",
  wordChrome:
    "Safari's status bar and toolbar. They show the bezel colour while the bezel is on, and the page's ground while it is off — kept in step live.",
  wordScroll:
    "Where the page scrolls: the window, or a container with the window held still, so the edges do not move.",

  // Panel
  bezel: "Bezel",
  bezelOn: "Draw the bezel",
  auto: "back to the wallpaper's",
  tint: "Tint",
  tints: { black: "Black", dark: "Dark", theme: "Theme", custom: "Custom" },
  band: "Band",
  radius: "Radius",
  page: "Page",
  scroll: "Scroll",
  scrolls: { window: "Window", container: "Container" },
  heroExit: "Hero exit",
  heroExits: { fade: "Fade", scroll: "Scroll" },
  panelNote:
    "Tint, band and radius are saved settings, the same ones the devtool writes. The bezel switch, the scroll and the hero exit last this visit, and go back when you leave.",
};

const zh: typeof en = {
  docs: "演示与文档",
  meta: (on, color, band, radius, scroll) =>
    `边框${on ? "开" : "关"} · ${color} · 厚度 ${band}px · 圆角 ${radius}px · 滚动 ${scroll}`,

  now: "此刻",
  nowNote:
    "vitre 此刻在这一页上画着什么，直接读自这个包本身（useVitre）。在面板里打开边框，它就会在这里画出来，任何屏幕都行——在 iPhone 上还会给 Safari 的工具栏着色。",
  stateBezel: "边框",
  stateChrome: "浏览器栏",
  stateBand: "厚度",
  stateRadius: "圆角",
  stateScroll: "滚动",
  stateGround: "底色",
  statePlatform: "平台",
  stateScrollTop: "页面已滚动",
  on: "开",
  off: "关",
  ios: "iOS",
  notIos: "非 iOS——除非强制，否则关闭",
  chromeNote: (color) => `Safari 的栏显示为 ${color}`,

  policy: "策略",
  policyNote:
    "边框开不开，由壁纸决定（systems/ambient/lib/bezel.ts）。一幅画止于边框内的一条线；一层底色则淡回页面里。仅限 iOS——在别处，浏览器自己的窗口就是边框。",
  colFamily: "类别",
  colLooks: "外观",
  colBezel: "边框",
  colSoftEdge: "柔和边缘",
  families: { picture: "图画", wash: "底色" },
  looks: { sky: "天空", image: "图片", gradient: "渐变", classic: "经典" },
  current: "当前",
  forced: "本次访问已强制",

  words: "这个包",
  wordsNote: "Vitre 照看三件事，每一件在它的 API 里都是一个词。",
  wordBezel: "页面周围的边框：每条边一道带，圆角的内角，一种颜色。",
  wordChrome: "Safari 的状态栏与工具栏。边框开着时显示边框的颜色，关着时显示页面的底色——实时同步。",
  wordScroll: "页面在哪里滚动：窗口，或是一个容器、而窗口保持不动，好让边缘稳住。",

  bezel: "边框",
  bezelOn: "绘制边框",
  auto: "恢复为壁纸的决定",
  tint: "颜色",
  tints: { black: "黑", dark: "深", theme: "随主题", custom: "自定义" },
  band: "厚度",
  radius: "圆角",
  page: "页面",
  scroll: "滚动",
  scrolls: { window: "窗口", container: "容器" },
  heroExit: "标题离场",
  heroExits: { fade: "淡出", scroll: "滚走" },
  panelNote:
    "颜色、厚度与圆角是会保存的设置，与开发者工具写的是同一份。边框开关、滚动方式与标题离场只在本次访问有效，离开时复原。",
};

export const VITRE_STRINGS: LabTable<typeof en> = { en, zh };
