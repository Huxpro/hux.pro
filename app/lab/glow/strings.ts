// =============================================================================
// Glow Lab strings — both languages, keyed (see systems/lab/i18n.ts).
//
// The motion pairs' prose is keyed by the pair's id in view.tsx's PAIRS, which
// keeps only the structure (beam, motion, period, radius, classes). Motion
// names (flow, rotate, pulse) and shape names (ring, line) are prop values,
// so they stay as written in every language; the words around them do not.
// =============================================================================

import type { LabTable } from "@/systems/lab";

const en = {
  // Toolbar
  on: "on",
  processing: "processing",
  level: "level",
  microphone: "microphone",
  listening: "listening",
  micBlocked: "mic blocked",

  // Motions
  motions: "Motions",
  motionsNote:
    "How the light lives while on. Rotate and pulse are Libraries.dev border-beam's two families, rebuilt as this light — each beside the original. Processing and the level drive ours.",
  period: "period",
  baseline: "baseline",
  eachOwn: "each motion's own",
  override: "override",
  reference: "border-beam (reference)",
  ours: "ours",
  pairs: {
    rotateCard: {
      name: "rotate · card",
      label: "",
      theirs: "md: a lit arc sweeping a fixed colour field, a white spark at its head.",
      ours: 'motion="rotate": the same, as layers in the shader.',
    },
    rotateButton: {
      name: "rotate · button",
      label: "Running",
      theirs: "sm: the button-sized preset.",
      ours: "At 3px of reach — the stroke carries it.",
    },
    pulseInner: {
      name: "pulse · inner",
      label: "",
      theirs: "pulse-inner: the whole edge breathing, contained.",
      ours: 'motion="pulse": four quarters on their own clocks, the colour turning.',
    },
    pulseOutside: {
      name: "pulse · outside",
      label: "",
      theirs: "pulse-outside: blooming out from behind an opaque host.",
      ours: "inside={false} with a bleed: only the halo.",
    },
  },
  flowName: "flow · ours",
  flowWhere: "The default: the beams travel round, two each way. The About. (border-beam has no flow.)",

  // Colours
  colours: "Colours",
  coloursNote:
    "The light's colours come from the wallpaper: its dominant colour sets a hue, and a colour-wheel rule picks three from it (systems/glow/lib/harmony.ts). Auto gives a colourful picture its analogous neighbours and a muted one a split complement; a grey picture keeps Siri's palette. The devtool's Glow · Colours sets the rule for the whole site.",
  autoPicks: (rule: string) => `→ ${rule}`,

  // In production
  inProduction: "In production",
  screenName: "Screen · ring",
  screenWhere: "The About, over every page. Fixed, bezel-aware.",
  screenText: "Hey, I'm Hux.",
  fieldName: "Field · line",
  fieldWhere: "The palette listening (⌘K, then the microphone, or / V).",
  fieldText: "go to the writing",
  windowName: "Window · loading",
  windowWhere: "The in-app browser while its page arrives: a line on the top edge, processing.",

  // Could be
  couldBe: "Could be",
  couldBeNote:
    "The same light where the OS has something alive to say. Each is a candidate, drawn so it can be judged by eye; none is wired in yet.",
  commandBarName: "Command bar · line",
  commandBarWhere: "The home bar, while ⌘K is listening — the voice seen from the page.",
  commandBarText: "Search or / for commands",
  appTileName: "App tile · rotate",
  appTileWhere: "An app whose window is open, on the home shelf: running.",
  activityName: "Live Activity · comet",
  activityWhere: "The dock pill while something is working — a comet around it.",
  buttonName: "Button · pulse outside",
  buttonWhere: "A primary action inviting a first press (the About's “Reveal”).",
  buttonText: "Reveal",
  cardName: "Card · pulse",
  cardWhere: "The HEAD commit on /works — what I am doing now.",
  cardDates: "2023 — present",
  avatarName: "Avatar · ring",
  avatarWhere: "The identity card's photo while its person is ‘speaking’ (a talk playing).",
};

const zh: typeof en = {
  on: "开启",
  processing: "处理中",
  level: "音量",
  microphone: "麦克风",
  listening: "聆听中",
  micBlocked: "麦克风被拒",

  motions: "动效",
  motionsNote:
    "光亮着时的样子。rotate 与 pulse 是 Libraries.dev border-beam 的两类效果，用这束光重做了一遍——各自与原版并排。处理中状态和音量驱动的是本站这一侧。",
  period: "周期",
  baseline: "基线",
  eachOwn: "各用默认",
  override: "覆盖",
  reference: "border-beam（参考）",
  ours: "本站",
  pairs: {
    rotateCard: {
      name: "rotate · 卡片",
      label: "",
      theirs: "md：一段亮弧扫过固定的色场，弧头一点白色火花。",
      ours: 'motion="rotate"：同样的效果，作为着色器里的图层。',
    },
    rotateButton: {
      name: "rotate · 按钮",
      label: "运行中",
      theirs: "sm：按钮尺寸的预设。",
      ours: "光晕只有 3px——主要靠描边撑起来。",
    },
    pulseInner: {
      name: "pulse · 内侧",
      label: "",
      theirs: "pulse-inner：整条边缘在呼吸，收在内侧。",
      ours: 'motion="pulse"：四个象限各走各的节拍，颜色随之流转。',
    },
    pulseOutside: {
      name: "pulse · 外侧",
      label: "",
      theirs: "pulse-outside：从不透明的宿主背后向外晕开。",
      ours: "inside={false} 加 bleed：只剩外圈光晕。",
    },
  },
  flowName: "flow · 本站",
  flowWhere: "默认动效：光束绕边游走，两道顺时针、两道逆时针。用在关于页。（border-beam 没有 flow。）",

  colours: "颜色",
  coloursNote:
    "光的颜色取自壁纸：主色定下色相，再由一条色环规则从中取出三色（systems/glow/lib/harmony.ts）。auto 给鲜艳的画面取邻近色，给低饱和的画面取分裂互补色；灰色的画面保留 Siri 的配色。开发者工具里的 Glow · Colours 为全站设定规则。",
  autoPicks: (rule: string) => `→ ${rule}`,

  inProduction: "已上线",
  screenName: "屏幕 · ring",
  screenWhere: "关于页，覆盖在每个页面之上。固定定位，贴合 bezel。",
  screenText: "嘿，我是 Hux。",
  fieldName: "输入框 · line",
  fieldWhere: "命令面板聆听时（⌘K 后点麦克风，或输入 / V）。",
  fieldText: "去看文章",
  windowName: "窗口 · 加载中",
  windowWhere: "应用内浏览器等待页面加载时：顶边一条线，处理中状态。",

  couldBe: "还可以用在",
  couldBeNote: "同一束光，用在系统有「活」的东西要表达的地方。每个都只是候选，画出来好让人一眼判断；目前都还没接入。",
  commandBarName: "命令栏 · line",
  commandBarWhere: "主屏底栏，在 ⌘K 聆听时——从页面上看见声音。",
  commandBarText: "搜索或使用 / 呼出命令",
  appTileName: "应用图标 · rotate",
  appTileWhere: "窗口已打开的应用，在主屏的架子上：运行中。",
  activityName: "实时活动 · 彗星",
  activityWhere: "有任务在进行时的 Dock 胶囊——一颗彗星绕着它转。",
  buttonName: "按钮 · pulse 外侧",
  buttonWhere: "邀请用户第一次按下的主操作（关于页的「进入」）。",
  buttonText: "进入",
  cardName: "卡片 · pulse",
  cardWhere: "/works 上的 HEAD 提交——我现在在做的事。",
  cardDates: "2023 — 至今",
  avatarName: "头像 · ring",
  avatarWhere: "身份卡片上的照片，在本人「说话」时（正在播放一场演讲）。",
};

export const GLOW_STRINGS: LabTable<typeof en> = { en, zh };

export type GlowStrings = typeof en;
export type GlowPairId = keyof GlowStrings["pairs"];
