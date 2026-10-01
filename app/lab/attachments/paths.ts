/**
 * Every place a commit's media is drawn, and where a press sends it.
 *
 * The attachments lab prints this table next to live specimens so a new
 * kind or a new surface has a row to land in. Policy (where a tap goes)
 * is `systems/attachments/lib/policy.ts`; this is the *drawing* map.
 */

import type { Locale } from "@/lib/i18n";

/** Prose, in both languages; code tokens inside it stay as written. */
export type PathText = Record<Locale, string>;

export type RenderSurfaceId =
  | "strip"
  | "grid-desk"
  | "grid-phone"
  | "inline-playable"
  | "renderer"
  | "renderer-rail"
  | "renderer-pills"
  | "peek"
  | "peek-deck"
  | "page"
  | "rail-thumb"
  | "mdx"
  | "widget";

export interface RenderPath {
  id: RenderSurfaceId;
  /** The production component. */
  surface: string;
  /** Where it prints. */
  context: PathText;
  /** What a click does (or "—", when the surface is not a door). */
  click: PathText;
  /** File to open. */
  file: string;
}

export const RENDER_PATHS: readonly RenderPath[] = [
  {
    id: "strip",
    surface: "MediaStrip → AttachmentTile",
    context: {
      en: "/works covers: one row per commit, under the description",
      zh: "/works 封面：每条提交一行，位于描述下方",
    },
    click: {
      en: "open() → homeFor (sheet on a phone, native home elsewhere)",
      zh: "open() → homeFor（手机上是面板，其他情况去原生去处）",
    },
    file: "components/log/media/media-strip.tsx",
  },
  {
    id: "grid-desk",
    surface: "AttachmentGrid (desk)",
    context: {
      en: "/works feed, sm and up: pair / lone card / lone playable",
      zh: "/works 信息流，sm 及以上：成对／单张卡片／单个可播放项",
    },
    click: {
      en: "act() → nativeHomeFor (stage, window, route, tab)",
      zh: "act() → nativeHomeFor（舞台、窗口、路由、新标签页）",
    },
    file: "components/log/media/attachment-grid.tsx",
  },
  {
    id: "grid-phone",
    surface: "AttachmentGrid (phone)",
    context: {
      en: "/works feed, < sm: edge-to-edge stack",
      zh: "/works 信息流，< sm：通栏纵向堆叠",
    },
    click: {
      en: "act() on a card; a recording/deck plays in place",
      zh: "卡片上调用 act()；录像／幻灯片就地播放",
    },
    file: "components/log/media/attachment-grid.tsx",
  },
  {
    id: "inline-playable",
    surface: "InlinePlayable",
    context: {
      en: "Phone feed: 16:9 cover swaps for the player; PiP hands off",
      zh: "手机信息流：16:9 封面换成播放器；画中画时移交出去",
    },
    click: {
      en: "play in place · PiP → act() (theater / PiP)",
      zh: "就地播放 · 画中画 → act()（影院／画中画）",
    },
    file: "components/log/media/attachment-grid.tsx",
  },
  {
    id: "renderer",
    surface: "MediaRenderer",
    context: {
      en: "MDX <Media />, and whatever the grid has no cover for: a live social widget. Nothing else on /works reaches it any more.",
      zh: "MDX <Media />，以及网格没有封面可用的东西：实时的社交小组件。/works 上已没有别的路径会走到它。",
    },
    click: {
      en: "open() when a set is handed in; else inline / <a>",
      zh: "传入附件集时调用 open()；否则内联或 <a>",
    },
    file: "components/log/media/media-renderer.tsx",
  },
  {
    id: "renderer-rail",
    surface: "MediaRenderer · CardScrollRail",
    context: {
      en: "MDX / pinned: 2+ rich items side by side",
      zh: "MDX／置顶：两个以上富媒体条目并排",
    },
    click: { en: "same as MediaRenderer", zh: "同 MediaRenderer" },
    file: "components/log/media/media-renderer.tsx",
  },
  {
    id: "renderer-pills",
    surface: "MediaRenderer · Link pill",
    context: {
      en: "Folded rail icons · pill-only commits · MDX pills",
      zh: "折叠的侧栏图标 · 只有胶囊的提交 · MDX 胶囊",
    },
    click: {
      en: "plain <a>: pills are not in the attachment set",
      zh: "普通 <a>：胶囊不在附件集里",
    },
    file: "components/log/media/link.tsx",
  },
  {
    id: "peek",
    surface: "PeekCard / PeekThumb",
    context: {
      en: "Hover on a strip cover, or a single-item index-form peek",
      zh: "悬停在缩略条封面上，或 index 形态下的单项预览",
    },
    click: { en: "— (the cover underneath is the door)", zh: "—（底下的封面才是入口）" },
    file: "components/log/media/media-peek.tsx",
  },
  {
    id: "peek-deck",
    surface: "StackedPeek",
    context: {
      en: "/works index: 2+ peek items on a folded row",
      zh: "/works index：折叠行上有两个以上预览项",
    },
    click: { en: "— (the row opens)", zh: "—（整行展开）" },
    file: "components/log/commit-embed.tsx",
  },
  {
    id: "page",
    surface: "AttachmentPage",
    context: {
      en: "Attachment sheet / panel / window, one page per item",
      zh: "附件面板／侧板／窗口，每个条目一页",
    },
    click: {
      en: "native action (Watch / Slides / Visit / Read)",
      zh: "原生操作（观看／幻灯片／访问／阅读）",
    },
    file: "systems/attachments/components/attachment-page.tsx",
  },
  {
    id: "rail-thumb",
    surface: "TrackThumb",
    context: {
      en: "Theater playlist rail · the home Featured Talks card",
      zh: "影院播放列表侧栏 · 首页的精选演讲卡片",
    },
    click: { en: "select the track on the stage", zh: "在舞台上选中该曲目" },
    file: "systems/theater/components/track-thumb.tsx",
  },
  {
    id: "mdx",
    surface: "Media",
    context: {
      en: "MDX in /writing: URL in, kind detected",
      zh: "/writing 里的 MDX：传入 URL，自动识别类型",
    },
    click: {
      en: "inline player / card link; no attachment set",
      zh: "内联播放器／卡片链接；没有附件集",
    },
    file: "components/log/media/media.tsx",
  },
  {
    id: "widget",
    surface: "FeaturedTalksWidget → TrackThumb",
    context: {
      en: "Home: the same snap-pager the attachment sheet pages with",
      zh: "首页：与附件面板翻页所用的同一个吸附翻页器",
    },
    click: {
      en: "useTheater().open: the stage, never the attachment set",
      zh: "useTheater().open：去舞台，从不经过附件集",
    },
    file: "components/home/featured-talks-widget.tsx",
  },
];
