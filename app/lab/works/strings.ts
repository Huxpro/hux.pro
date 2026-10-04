// =============================================================================
// Works Lab strings: both languages, keyed. See `systems/lab/i18n.ts`.
//
// What stays as written in both: the values log.json holds (commit types,
// media kinds, `en` / `zh` / `both`, `date` / `endDate`, platform names,
// identity handles), and the JSON field names a note refers to
// (`attachedTo`, `identityId`). Where a picker shows such a value, the
// Chinese adds a gloss after it rather than replacing it, so what you pick
// is still what you would search log.json for.
// =============================================================================

import type { LabTable } from "@/systems/lab";

const en = {
  // Toolbar
  formIndex: "index",
  formCovers: "covers",
  formFeed: "feed",
  inspect: "Inspect",
  done: "Done",
  addTag: "Tag",
  reset: "Reset",
  save: "Save",
  saving: "Saving...",

  // Toasts
  saved: "Saved to content/log.json",
  saveFailed: "Save failed",
  reloaded: "Reloaded from disk",
  resetFailed: "Reset failed",
  loadFailed: "Failed to load",

  // Frame meta line
  meta: (commits: number, tags: number, identities: number) =>
    `${commits} commits · ${tags} tags · ${identities} identities`,

  // Inspector: shared
  inspectMode: "Inspect mode",
  noSelection: "No selection",
  closeInspector: "Close inspector",

  // Commit editor: header, tabs, JSON
  tabForm: "Form",
  tabJson: "JSON",
  deleteCommit: "Delete commit",
  applyJson: "Apply JSON",
  jsonApplied: "JSON applied",
  jsonMissingFields: "Missing required fields: id, type, tagId",
  jsonInvalid: "Invalid JSON",

  // Commit fields
  id: "ID",
  type: "Type",
  tag: "Tag",
  date: "Date",
  datePlaceholder: "YYYY-MM or YYYY-MM-DD",
  endDate: "End Date",
  endDatePlaceholder: "YYYY-MM or empty",
  listed: "Listed",
  hideDate: "Hide Date",
  aside: "Aside",
  asideLine: "Aside line",
  language: "Language",
  listedIn: "Listed In",
  sortBy: "Sort By",
  icon: "Icon",
  optDefault: "default",
  /** Each commit type as the Type picker shows it. */
  typeNames: {
    project: "project",
    talk: "talk",
    post: "post",
    role: "role",
    press: "press",
    event: "event",
  },

  // Commit sections
  title: "Title",
  description: "Description",
  team: "Team",
  commentary: "Commentary",
  details: "Details",
  keywords: "Tags",
  keywordPlaceholder: "keyword",
  addKeyword: "Add tag",

  // Repeatable lists (keywords today)
  listAdd: (label: string) => `Add ${label.toLowerCase()}`,
  listEmpty: (label: string) => `No ${label.toLowerCase()}`,
  listRemove: (label: string) => `Remove ${label.toLowerCase()}`,

  // Type-specific sections
  project: "Project",
  stars: "Stars",
  users: "Users",
  downloads: "Downloads",
  talk: "Talk",
  conference: "Conference",
  city: "City",
  confUrl: "Conf URL",
  post: "Post",
  url: "URL",
  publication: "Publication",
  role: "Role",
  identity: "Identity",
  companyEn: "Company EN",
  companyZh: "Company ZH",
  overrideEn: "Override EN",
  overrideZh: "Override ZH",
  location: "Location",
  hideRow: "Hide Row",
  press: "Press",
  platform: "Platform",

  // Identity & rail
  identityRail: "Identity & Rail",
  resolved: "Resolved",
  anchor: "Anchor",
  anchorAuto: "Auto (tenure)",
  anchorDetach: "Detach (off rail)",
  pinToRole: "Pin to role (rail / beam)",
  pinToIdentity: "Pin to identity (byline)",
  noteEvent: "Events never join a rail.",
  noteDetached: "Force-detached (attachedTo: null).",
  noteNoRole: "No role covers this date, so there is nothing to attach to.",
  sourceRole: "role (anchors this cluster)",
  sourceExplicit: "explicit identityId",
  sourceAttached: (roleId: string) => `attached → ${roleId}`,
  sourceTenureOf: (roleId: string) => `tenure → ${roleId}`,
  sourceTenure: "tenure",
  // The rail-hole warning reads: before · handle · middle · field · after.
  railHoleBefore: "Detached, but sits inside the ",
  railHoleMiddle: " cluster. This breaks the continuous rail. Set ",
  railHoleAfter: " to Auto to reconnect it.",

  // Media
  media: "Media",
  addMedia: "Add media",
  noMedia: "No media attached",
  removeMedia: "Remove media",
  kind: "Kind",
  /** Each media kind as the Kind picker shows it. */
  kindNames: {
    link: "link",
    "social-embed": "social-embed",
    video: "video",
    slides: "slides",
    image: "image",
  },
  urlEn: "URL EN",
  urlZh: "URL ZH",
  localeVariant: "Locale variant (optional)",
  previewTitle: "Preview title",
  previewTitlePlaceholder: "Card title override",
  previewDesc: "Preview desc",
  previewDescPlaceholder: "Card description override",
  previewImage: "Preview image",
  previewImagePlaceholder: "Card image URL override",
  platformAuto: "auto",
  thumbnail: "Thumbnail",
  thumbnailPlaceholder: "Thumbnail URL (optional)",
  slidesTitlePlaceholder: "Deck title (modal)",
  coverPlaceholder: "Cover image URL (optional)",
  alt: "Alt",
  altPlaceholder: "Alt text",
  pinned: "Pinned",

  // Tag editor
  chapter: "chapter",
  tagTitleEn: "Title EN",
  tagTitleZh: "Title ZH",
  taglineEn: "Tagline EN",
  taglineZh: "Tagline ZH",
  start: "Start",
  end: "End",
  color: "Color",
  narrativeEn: "Narr. EN",
  narrativeZh: "Narr. ZH",
  keywordsEn: "Keywords EN",
  keywordsZh: "Keywords ZH",
  notRendered: "Not rendered yet",
};

const zh: typeof en = {
  // Toolbar
  formIndex: "索引",
  formCovers: "封面",
  formFeed: "信息流",
  inspect: "检查",
  done: "完成",
  addTag: "标签",
  reset: "重置",
  save: "保存",
  saving: "保存中…",

  // Toasts
  saved: "已保存到 content/log.json",
  saveFailed: "保存失败",
  reloaded: "已从磁盘重新载入",
  resetFailed: "重置失败",
  loadFailed: "载入失败",

  // Frame meta line
  meta: (commits: number, tags: number, identities: number) =>
    `${commits} 条提交 · ${tags} 个标签 · ${identities} 个身份`,

  // Inspector: shared
  inspectMode: "检查模式",
  noSelection: "未选中任何内容",
  closeInspector: "关闭检查器",

  // Commit editor: header, tabs, JSON
  tabForm: "表单",
  tabJson: "JSON",
  deleteCommit: "删除提交",
  applyJson: "应用 JSON",
  jsonApplied: "已应用 JSON",
  jsonMissingFields: "缺少必填字段：id、type、tagId",
  jsonInvalid: "JSON 无效",

  // Commit fields
  id: "ID",
  type: "类型",
  tag: "标签",
  date: "日期",
  datePlaceholder: "YYYY-MM 或 YYYY-MM-DD",
  endDate: "结束日期",
  endDatePlaceholder: "YYYY-MM 或留空",
  listed: "列出",
  hideDate: "隐藏日期",
  aside: "旁注",
  asideLine: "旁注行",
  language: "语言",
  listedIn: "列出于",
  sortBy: "排序依据",
  icon: "图标",
  optDefault: "默认",
  typeNames: {
    project: "project · 项目",
    talk: "talk · 演讲",
    post: "post · 文章",
    role: "role · 职位",
    press: "press · 报道",
    event: "event · 事件",
  },

  // Commit sections
  title: "标题",
  description: "描述",
  team: "团队",
  commentary: "评注",
  details: "详情",
  keywords: "关键词",
  keywordPlaceholder: "关键词",
  addKeyword: "添加关键词",

  // Repeatable lists
  listAdd: (label: string) => `添加${label}`,
  listEmpty: (label: string) => `暂无${label}`,
  listRemove: (label: string) => `移除${label}`,

  // Type-specific sections
  project: "项目",
  stars: "星标数",
  users: "用户数",
  downloads: "下载量",
  talk: "演讲",
  conference: "会议",
  city: "城市",
  confUrl: "会议链接",
  post: "文章",
  url: "URL",
  publication: "发表于",
  role: "职位",
  identity: "身份",
  companyEn: "公司 EN",
  companyZh: "公司 ZH",
  overrideEn: "覆盖 EN",
  overrideZh: "覆盖 ZH",
  location: "地点",
  hideRow: "隐藏行",
  press: "报道",
  platform: "平台",

  // Identity & rail
  identityRail: "身份与轨道",
  resolved: "解析为",
  anchor: "锚定",
  anchorAuto: "自动（按任期）",
  anchorDetach: "脱离（不上轨道）",
  pinToRole: "固定到职位（轨道 / 光束）",
  pinToIdentity: "固定到身份（署名）",
  noteEvent: "事件从不上轨道。",
  noteDetached: "已强制脱离（attachedTo: null）。",
  noteNoRole: "没有职位覆盖这个日期，无处可挂。",
  sourceRole: "role（本簇的锚点）",
  sourceExplicit: "显式 identityId",
  sourceAttached: (roleId: string) => `挂靠 → ${roleId}`,
  sourceTenureOf: (roleId: string) => `任期 → ${roleId}`,
  sourceTenure: "任期",
  railHoleBefore: "已脱离，但位于 ",
  railHoleMiddle: " 簇之内，这会打断连续的轨道。把 ",
  railHoleAfter: " 设为「自动」即可重新接上。",

  // Media
  media: "媒体",
  addMedia: "添加媒体",
  noMedia: "未附带媒体",
  removeMedia: "移除媒体",
  kind: "类型",
  kindNames: {
    link: "link · 链接",
    "social-embed": "social-embed · 社交嵌入",
    video: "video · 视频",
    slides: "slides · 幻灯片",
    image: "image · 图片",
  },
  urlEn: "URL EN",
  urlZh: "URL ZH",
  localeVariant: "语言版本（可选）",
  previewTitle: "预览标题",
  previewTitlePlaceholder: "覆盖卡片标题",
  previewDesc: "预览描述",
  previewDescPlaceholder: "覆盖卡片描述",
  previewImage: "预览图",
  previewImagePlaceholder: "覆盖卡片图片 URL",
  platformAuto: "自动",
  thumbnail: "缩略图",
  thumbnailPlaceholder: "缩略图 URL（可选）",
  slidesTitlePlaceholder: "幻灯片标题（弹窗中显示）",
  coverPlaceholder: "封面图 URL（可选）",
  alt: "替代文本",
  altPlaceholder: "替代文本",
  pinned: "置顶",

  // Tag editor
  chapter: "章节",
  tagTitleEn: "标题 EN",
  tagTitleZh: "标题 ZH",
  taglineEn: "标语 EN",
  taglineZh: "标语 ZH",
  start: "开始",
  end: "结束",
  color: "颜色",
  narrativeEn: "叙述 EN",
  narrativeZh: "叙述 ZH",
  keywordsEn: "关键词 EN",
  keywordsZh: "关键词 ZH",
  notRendered: "尚未渲染",
};

export const WORKS_STRINGS: LabTable<typeof en> = { en, zh };

export type WorksStrings = typeof en;
