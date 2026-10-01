// =============================================================================
// Attachments Lab strings — both languages, keyed (see systems/lab/i18n.ts).
//
// Labels are translated; the identifiers they name — component, function and
// prop names, file and route paths, platform names — are not.
// =============================================================================

import type { LabTable } from "@/systems/lab";

const en = {
  /** The attachment set's title, and the track / window titles it lends. */
  setTitle: "Attachments Lab",

  // Sample kinds (platform names stay as they are)
  sample: {
    video: "video",
    youtube: "YouTube",
    bilibili: "bilibili",
    vimeo: "Vimeo",
    slides: "slides",
    talkPage: "recording on a page",
    web: "page",
    denied: "page · refuses framing",
    post: "post",
    image: "image",
    social: "social widget",
    twitter: "X",
    instagram: "Instagram",
    tiktok: "TikTok",
  },

  // Vocabulary tiles, keyed like VOCABULARY
  vocab: {
    video: { title: "recording", meaning: "the platform it is on; it plays on the stage" },
    talkPage: {
      title: "recording on a page",
      meaning:
        "the same play chip and the host's name, but it opens in the in-app browser, not on the stage. GitNation is the case.",
    },
    slides: { title: "deck", meaning: "Slides; it presents on the stage" },
    leaves: {
      title: "leaves",
      meaning: "a page that refuses framing: the press opens a tab, whatever the kind",
    },
    web: {
      title: "page",
      meaning: "Web in the peek; nothing on /works, where the card prints its domain and title",
    },
    post: { title: "post", meaning: "Writing in the peek; nothing on /works" },
    image: { title: "image", meaning: "Image in the peek; nothing on /works" },
    social: { title: "social widget", meaning: "its platform in the peek; nothing on /works" },
  },

  // Home chips
  home: {
    surface: "sheet",
    theater: "theater",
    lightbox: "lightbox",
    window: "window",
    route: "route",
    tab: "tab",
  },
  /** A surface off a phone: a panel or a window. */
  homeSurfaceWide: "surface",
  /** A window on a phone is a sheet too. */
  homeWindowCompact: "window · sheet",

  // Panel
  mark: "Mark",
  tier: "Tier",
  tierPeekHint: "every kind · raised",
  tierWorksHint: "recording · deck · leaves · at rest",
  hoverPeek: "hover peek",
  size: "Size",
  sizeCompact: "compact",
  sizeDefault: "default",
  onCovers: "On the log's covers",
  policyContext: "Policy context",
  viewport: "Viewport",
  live: "live",
  pinned: "pinned",
  phone: "phone",
  smAndUp: "sm and up",
  windowManager: "A window manager is mounted",
  backToLive: "back to live",
  contextNote:
    "The table reads the policy for this context; the buttons on the stage always use the live one.",

  // Meta readout
  metaLive: (compact: boolean, theater: boolean, windows: boolean) =>
    `${compact ? "phone" : "sm+"} · stage ${theater ? "theater" : "pip"} · windows ${windows ? "on" : "off"}`,
  policyPinned: "· policy pinned",

  // Vocabulary
  vocabularyLabel: "Vocabulary: what a cover says before it is pressed",
  stripLabel: "The contact strip: 56px covers, and the chip keeps its glyph",
  vocabularyNote:
    "One chip, drawn by one component, the same chip a wallpaper tile wears for Live / Preset. Who wears one is the surface’s call, in three tiers. On `/works`, the strip and the expanded body: a recording (its platform, so a talk says where it was recorded), a deck (`Slides`) and a page whose press leaves the site (`New tab`). A card is its own hint. In the hover peek: every kind, because a peek is a glance and the chip is its caption. There the chip is raised from the start, while a cover in the page wears it light until hovered. On the attachment sheet’s page, the home widgets’ covers and the theater’s rail: none, because each already says what the thing is beside the cover. The chip says what the thing is; the policy below says where it opens. That is how a GitNation recording wears a play chip and opens in the in-app browser.",

  // Render paths
  pathsLabel: "Render paths: every surface that draws a commit’s media",
  colSurface: "surface",
  colPrints: "prints",
  colClick: "click",
  colFile: "file",
  pathsNote:
    "One map, the lab’s. A new kind gets a row here and a specimen below; a new surface gets both. Policy (where the tap lands) is the table under Homes; this one only covers how it is drawn.",

  // Homes
  homesLabel: "Homes: where a tap lands, and where the sheet’s button sends it",
  colAttachment: "attachment",
  colMark: "mark",
  colTap: "tap",
  colButton: "button",
  homesNote:
    "Read live from `homeFor` and `nativeHomeFor`. On a phone every tap opens the attachment sheet and the button sends the item on: a recording or a deck to the stage (a PiP there), a page to the in-app browser (on a phone a window is a sheet, and it stacks on the attachment sheet). Only a page that refuses to be framed leaves for a tab, and its chip says so before the button is pressed.",

  // Surfaces
  surfStrip: "The contact strip: MediaStrip, the `covers` form",
  surfGridDesk: "The attachment object in the `feed`: AttachmentGrid (desk)",
  surfGridPhone: "The phone feed: AttachmentGrid compact + InlinePlayable",
  surfRenderer: "MediaRenderer: leftover widgets, pinned covers, MDX",
  surfPeeks: "Hover peeks: PeekCard / PeekThumb",
  surfCard: "The card: LinkCard",
  surfDeck: "The deck cover: Slides",
  surfPlayers: "Inline players: Video (MDX / leftover path)",
  surfRail: "The theater’s rail: TrackThumb",
  surfMdx: "MDX <Media />: URL in, kind detected",
  surfWidget: "Home Featured Talks: the same TrackThumb, in the widget’s snap-pager",
  surfPages: "The attachment sheet’s pages: AttachmentPage",
  featuredTalks: "Featured Talks",

  // Try it
  tryLabel: "Try it through the real providers",
  openSample: (label: string) => `open ${label}`,
  openUrl: "openUrl: the in-app browser",
  stackLabel: "Surface stack, bottom first",
  nothingOpen: "— nothing open —",
  nestedIn: (id: string) => `nested in ${id}`,
  windowsLabel: "Windows",
  none: "— none —",
  focused: " · focused",
};

const zh: typeof en = {
  setTitle: "附件实验室",

  sample: {
    video: "视频",
    youtube: "YouTube",
    bilibili: "bilibili",
    vimeo: "Vimeo",
    slides: "幻灯片",
    talkPage: "网页上的录像",
    web: "网页",
    denied: "网页 · 拒绝嵌入",
    post: "文章",
    image: "图片",
    social: "社交小组件",
    twitter: "X",
    instagram: "Instagram",
    tiktok: "TikTok",
  },

  vocab: {
    video: { title: "录像", meaning: "所在的平台；在舞台上播放" },
    talkPage: {
      title: "网页上的录像",
      meaning: "同样的播放标签、同样写着托管方，但它在应用内浏览器里打开，而不是舞台。GitNation 就是这种情况。",
    },
    slides: { title: "幻灯片", meaning: "Slides；在舞台上放映" },
    leaves: {
      title: "离站",
      meaning: "拒绝被嵌入的网页：不论类型，按下都会开新标签页",
    },
    web: {
      title: "网页",
      meaning: "预览里写 Web；/works 上不挂标签，卡片自己印着域名和标题",
    },
    post: { title: "文章", meaning: "预览里写 Writing；/works 上不挂标签" },
    image: { title: "图片", meaning: "预览里写 Image；/works 上不挂标签" },
    social: { title: "社交小组件", meaning: "预览里写它的平台；/works 上不挂标签" },
  },

  home: {
    surface: "面板",
    theater: "影院",
    lightbox: "灯箱",
    window: "窗口",
    route: "路由",
    tab: "新标签页",
  },
  homeSurfaceWide: "浮层",
  homeWindowCompact: "窗口 · 面板",

  mark: "标签",
  tier: "层级",
  tierPeekHint: "每种类型 · 加重",
  tierWorksHint: "录像 · 幻灯片 · 离站 · 静置",
  hoverPeek: "悬停预览",
  size: "尺寸",
  sizeCompact: "紧凑",
  sizeDefault: "默认",
  onCovers: "叠在日志自己的封面上",
  policyContext: "策略上下文",
  viewport: "视口",
  live: "实时",
  pinned: "已固定",
  phone: "手机",
  smAndUp: "sm 及以上",
  windowManager: "已挂载窗口管理器",
  backToLive: "恢复实时",
  contextNote: "表格按这里设定的上下文读取策略；舞台上的按钮始终使用实时上下文。",

  metaLive: (compact: boolean, theater: boolean, windows: boolean) =>
    `${compact ? "手机" : "sm+"} · 舞台：${theater ? "影院" : "画中画"} · 窗口：${windows ? "开" : "关"}`,
  policyPinned: "· 策略已固定",

  vocabularyLabel: "词汇：封面在被按下之前说了什么",
  stripLabel: "缩略条：56px 的封面，标签保留图形",
  vocabularyNote:
    "一枚标签，由同一个组件绘制，和壁纸块上标注 Live / Preset 的是同一枚。谁挂标签由界面决定，分三个层级。在 `/works` 的缩略条和展开正文里：录像（写平台，演讲一眼可知在哪录的）、幻灯片（`Slides`），以及按下会离开本站的网页（`New tab`）。卡片本身就是提示。在悬停预览里：每种类型都挂，因为预览只是一瞥，标签就是它的说明；而且从一开始就是加重的，页面里的封面则在悬停前保持轻淡。在附件面板的页、首页小组件的封面和影院侧栏上：一个都不挂，因为它们在封面旁已经说明了这是什么。标签说明它是什么；下面的策略决定它在哪打开。所以 GitNation 的录像挂着播放标签，却在应用内浏览器里打开。",

  pathsLabel: "渲染路径：每个绘制提交媒体的界面",
  colSurface: "组件",
  colPrints: "出现在",
  colClick: "点击",
  colFile: "文件",
  pathsNote:
    "一张图，实验室自己的。新类型在这里加一行、在下面加一个样本；新界面两者都要。策略（轻点落在哪）是「去处」下的那张表；这张只管怎么画。",

  homesLabel: "去处：轻点落在哪里，面板上的按钮又把它送到哪里",
  colAttachment: "附件",
  colMark: "标签",
  colTap: "轻点",
  colButton: "按钮",
  homesNote:
    "实时读取 `homeFor` 与 `nativeHomeFor`。在手机上，每次轻点都会打开附件面板，再由按钮把条目送走：录像或幻灯片送上舞台（在那里是画中画），网页送进应用内浏览器（手机上窗口就是面板，叠在附件面板之上）。只有拒绝被嵌入的网页才会跳到新标签页，这一点在按下按钮之前，它的标签就已经说了。",

  surfStrip: "缩略条：MediaStrip，`covers` 形态",
  surfGridDesk: "`feed` 里的附件对象：AttachmentGrid（桌面）",
  surfGridPhone: "手机信息流：AttachmentGrid compact + InlinePlayable",
  surfRenderer: "MediaRenderer：剩下的小组件、置顶封面、MDX",
  surfPeeks: "悬停预览：PeekCard / PeekThumb",
  surfCard: "卡片：LinkCard",
  surfDeck: "幻灯片封面：Slides",
  surfPlayers: "内联播放器：Video（MDX／剩余路径）",
  surfRail: "影院侧栏：TrackThumb",
  surfMdx: "MDX <Media />：传入 URL，自动识别类型",
  surfWidget: "首页「精选演讲」：同一个 TrackThumb，放在小组件的吸附翻页器里",
  surfPages: "附件面板的各页：AttachmentPage",
  featuredTalks: "精选演讲",

  tryLabel: "走真实的 provider 试一试",
  openSample: (label: string) => `打开${label}`,
  openUrl: "openUrl：应用内浏览器",
  stackLabel: "浮层栈（自底向上）",
  nothingOpen: "——没有打开任何东西——",
  nestedIn: (id: string) => `嵌套于 ${id}`,
  windowsLabel: "窗口",
  none: "——无——",
  focused: " · 已聚焦",
};

export const ATTACHMENTS_STRINGS: LabTable<typeof en> = { en, zh };
