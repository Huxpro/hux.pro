import type { LabTable } from "@/systems/lab";

// /lab/vitre/site — how this site uses vitre. Code names stay as written.

const en = {
  now: "Now, on this page",
  nowNote: "What vitre is drawing here, read from the package itself (useVitre). Live.",
  bezel: "bezel",
  on: "on",
  off: "off",
  reasonForced: "Forced for this visit, in the devtool.",
  reasonNotIos: "Off: the bezel is for iOS Safari, whose chrome samples the page. Elsewhere vitre only sets theme-color.",
  reasonOn: "On: an iPhone, under a picture wallpaper.",
  reasonWash: "Off: under a wash wallpaper, the page fades at its edges instead.",
  rule: "The rule",
  ruleNote:
    "This site draws the bezel on an iPhone when the wallpaper is a picture, which a frame suits; a wash fades out at the edges instead. The boot script applies the same rule before React runs.",
  family: "wallpaper",
  softEdge: "soft edge",
  yes: "yes",
  no: "—",
  current: "now",
  files: "Where it lives",
  filesNote: "The package, and the files of this site that configure and host it.",
  try: "Try it here",
  tryNote:
    "The devtool's Bezel section turns the bezel on for this visit — on any screen — and tunes its tint, band, radius and scroll live. Nothing on this page changes it for you.",
  openDevtool: "Open the devtool",
};

const zh: typeof en = {
  now: "此刻，这一页上",
  nowNote: "vitre 在这里画着什么，直接从包里读（useVitre）。实时。",
  bezel: "bezel",
  on: "开",
  off: "关",
  reasonForced: "在开发者工具里为这次访问强制设定。",
  reasonNotIos: "关：bezel 是给 iOS Safari 的，它的 chrome 从页面取色。其他地方 vitre 只设置 theme-color。",
  reasonOn: "开：一台 iPhone，壁纸是一张图。",
  reasonWash: "关：壁纸是一片色晕时，页面改为在边缘淡出。",
  rule: "规则",
  ruleNote: "本站在 iPhone 上、壁纸是图片时画 bezel——图片配得上一个画框；色晕壁纸则在边缘淡出。启动脚本在 React 运行之前就按同一条规则画好第一帧。",
  family: "壁纸",
  softEdge: "边缘淡出",
  yes: "是",
  no: "—",
  current: "当前",
  files: "代码在哪",
  filesNote: "包本身，以及本站里配置和承载它的文件。",
  try: "在这里试试",
  tryNote: "开发者工具的 Bezel 一节可以为这次访问打开 bezel——任何屏幕都行——并实时调整配色、band、圆角和滚动方式。这一页本身不会替你改动它。",
  openDevtool: "打开开发者工具",
};

export const SITE_STRINGS: LabTable<typeof en> = { en, zh };
