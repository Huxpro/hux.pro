"use client";

// =============================================================================
// Lab strings — both languages, keyed, local to the lab.
//
// The lab is a devtool, so its copy lives beside it rather than in the site
// dictionary (`lib/i18n.ts`), which holds the strings visitors see. Knob
// labels and hints are keyed by the knob's own key or variable name, so the
// tables in lab-state.ts stay the single source of the knobs themselves.
// =============================================================================

import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/services";
import { getWeatherConditionLabel, type WeatherCondition } from "@/systems/ambient/lib/weather";

const STRINGS = {
  en: {
    title: "legibility lab",
    flipped: "flipped",
    liveChanges: (n: number) => `${n} live change${n > 1 ? "s" : ""}`,

    // Specimen captions
    bare: "bare — text with nothing behind it but the wallpaper",
    widget: "widget — bg-glass",
    activity: "live activity — bg-glass, pill and panel",
    palette: "command palette — bg-glass-popover",
    sheet: "secondary surface — bg-glass-sheet",
    reading: (veil: string, blur: number, relief: string, boost: number) =>
      `reading page — its own surface: veil ${veil} over a ${blur}px defocus, relief ${relief}, +${boost}% ink — the numbers /writing and /works get on this wallpaper`,
    gallery: "gallery — every wallpaper under its own resolved policy (weather tiles: the style's CSS gradient at that hour)",
    galleryWeather: "Weather",
    galleryApple: "Apple",
    galleryNature: "Nature",

    // Panel
    scene: "Scene",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    material: "Material",
    tinted: "Tinted",
    clear: "Clear",
    tint: "Tint",
    neutral: "Neutral",
    wallpaperTint: "Wallpaper",
    wallpaper: "Wallpaper",
    weatherStyle: "Weather style",
    fellBack: "Sky fell back to Gradient (no WebGL2)",
    live: "Live",
    profile: "Profile — measured once, or read off the live sky",
    lum: "lum",
    contrast: "contrast",
    zones: "top / mid / bot",
    edges: "edges",
    busyConflict: "busy / conflict",
    chroma: "chroma",
    tintRow: "tint",
    grey: "grey",
    contrastTitle: "Contrast — estimate from the profile",
    contrastBare: "bare · top band",
    contrastGlass: "glass · bg-glass",
    contrastSheet: "sheet · bg-glass-sheet",
    contrastReading: "reading · veil",
    contrastNote:
      "Primary, then secondary ink, against the mean colour composited under each surface. WCAG ratios; AA·L is large text.",
    policy: "Policy — profile → variables",
    backTo: (v: string | number) => `Back to ${v}`,
    backToPolicy: "Back to the policy",
    backToPolicyValue: (v: string | number) => `Back to the policy (${v})`,
    toneRange: "Tone safe → worst",
    toneRangeHint: (theme: string) =>
      `picture lightness where the card-colour conflict is nil → total (${theme})`,
    veilBase: "Veil base",
    veilBaseHint: "reading veil alpha on a calm picture, per theme",
    tintL: "Tint L range",
    tintC: "Tint C range",
    resolved: "Resolved — the variables on <html>",
    flipBare: "Flip bare ink",
    on: "on",
    off: "off",
    On: "On",
    Off: "Off",
    pinsNote:
      "Pinning a value overrides the policy for this scene only; veil and blur act on the reading specimen. The gallery always shows the policy.",
    sheetSection: (group: string) => `Sheet — ${group}`,
    export: "Export",
    copyJson: "Copy JSON",
    copyCss: "Copy CSS overrides",
    resetAll: "Reset all",
    exportNote:
      "Policy values go in DEFAULT_LEGIBILITY_POLICY (legibility.ts); sheet values in the :root inputs of globals.css. Nothing here persists.",
    day: "day",
    night: "night",
    sunrise: "sunrise",
    sunset: "sunset",
  },
  zh: {
    title: "可读性实验室",
    flipped: "反色",
    liveChanges: (n: number) => `${n} 项实时改动`,

    bare: "裸文字 — 底下只有壁纸",
    widget: "小组件 — bg-glass",
    activity: "实时活动 — bg-glass，胶囊与面板",
    palette: "命令面板 — bg-glass-popover",
    sheet: "二级面板 — bg-glass-sheet",
    reading: (veil: string, blur: number, relief: string, boost: number) =>
      `阅读页 — 独立的表面：压暗 ${veil}，虚化 ${blur}px，浮雕 ${relief}，墨色 +${boost}% — 这张壁纸下 /writing 与 /works 实际拿到的数值`,
    gallery: "总览 — 每张壁纸各按自己的策略解析（天气块：该风格在那个时刻的 CSS 渐变）",
    galleryWeather: "天气",
    galleryApple: "Apple",
    galleryNature: "自然",

    scene: "场景",
    theme: "主题",
    light: "浅色",
    dark: "深色",
    material: "材质",
    tinted: "色调",
    clear: "透明",
    tint: "着色",
    neutral: "中性",
    wallpaperTint: "壁纸",
    wallpaper: "壁纸",
    weatherStyle: "天气风格",
    fellBack: "Sky 已回退到 Gradient（无 WebGL2）",
    live: "实时",
    profile: "画像 — 静态测量，或直接从实时天空读出",
    lum: "亮度",
    contrast: "对比",
    zones: "上 / 中 / 下",
    edges: "细节",
    busyConflict: "繁忙 / 冲突",
    chroma: "彩度",
    tintRow: "主色",
    grey: "灰",
    contrastTitle: "对比度 — 由画像估算",
    contrastBare: "裸文字 · 顶部",
    contrastGlass: "玻璃 · bg-glass",
    contrastSheet: "面板 · bg-glass-sheet",
    contrastReading: "阅读 · 压暗层",
    contrastNote: "先主墨、后次墨，对每个表面下合成后的平均色。WCAG 比值；AA·L 为大字号。",
    policy: "策略 — 画像 → 变量",
    backTo: (v: string | number) => `恢复为 ${v}`,
    backToPolicy: "恢复为策略值",
    backToPolicyValue: (v: string | number) => `恢复为策略值（${v}）`,
    toneRange: "色调安全 → 最差",
    toneRangeHint: (theme: string) => `与卡片色冲突为零 → 为满时的壁纸亮度（${theme}）`,
    veilBase: "压暗基值",
    veilBaseHint: "平静壁纸上的阅读压暗透明度，按主题",
    tintL: "主色亮度范围",
    tintC: "主色彩度范围",
    resolved: "解析结果 — <html> 上的变量",
    flipBare: "裸文字反色",
    on: "开",
    off: "关",
    On: "开",
    Off: "关",
    pinsNote: "钉住某个值只覆盖当前场景；压暗与虚化作用于阅读页样张。总览始终显示策略值。",
    sheetSection: (group: string) => `样式表 — ${group}`,
    export: "导出",
    copyJson: "复制 JSON",
    copyCss: "复制 CSS 覆盖",
    resetAll: "全部重置",
    exportNote:
      "策略值写入 DEFAULT_LEGIBILITY_POLICY（legibility.ts）；样式表值写入 globals.css 的 :root 输入。这里的改动不会持久化。",
    day: "白天",
    night: "夜晚",
    sunrise: "日出",
    sunset: "日落",
  },
} as const;

export type LabStrings = (typeof STRINGS)["en"];

/** Knob labels and hints, keyed by the policy key, output key, or CSS name. */
const KNOBS_ZH: Record<string, { label: string; hint?: string }> = {
  // policy
  edgesFull: { label: "细节 → 繁忙", hint: "细节达到多少算完全繁忙" },
  inkBoostMax: { label: "墨色增益上限", hint: "完全繁忙时增加的透明度百分点" },
  reliefBusy: { label: "繁忙浮雕", hint: "完全繁忙时的浮雕强度" },
  reliefGapStart: { label: "浮雕起点差距", hint: "墨与背景亮度差小于此值开始需要浮雕" },
  reliefGapFull: { label: "浮雕终点差距", hint: "差距达到此值不再需要浮雕" },
  reliefReading: { label: "阅读页浮雕", hint: "压暗层之下的乘数" },
  reliefFloor: { label: "浮雕下限", hint: "低于此值视为无" },
  glassAddMax: { label: "玻璃增填上限", hint: "完全繁忙时增加的填充百分点" },
  glassAddToneMax: { label: "玻璃增填 · 色调", hint: "色调冲突为满时增加的填充百分点" },
  flipMargin: { label: "反色余量", hint: "反色墨需比正常墨好多少才翻转" },
  veilBusy: { label: "压暗 · 繁忙", hint: "完全繁忙时增加的压暗透明度" },
  veilConflict: { label: "压暗 · 色调", hint: "色调冲突为满时增加的压暗透明度" },
  veilMax: { label: "压暗上限", hint: "总要留一些壁纸" },
  blurBase: { label: "虚化基值", hint: "平静壁纸上的像素半径" },
  blurBusy: { label: "虚化 · 繁忙", hint: "完全繁忙时增加的像素半径" },
  tintMinChroma: { label: "主色最低彩度", hint: "比这更灰：不取主色" },
  // outputs
  inkBoost: { label: "墨色增益" },
  relief: { label: "浮雕" },
  glassAdd: { label: "玻璃增填" },
  veil: { label: "阅读压暗" },
  blur: { label: "阅读虚化（px）" },
  tintL: { label: "主色 L" },
  tintC: { label: "主色 C" },
  tintH: { label: "主色 H" },
  // sheet
  "--ink-alpha-secondary": { label: "次级" },
  "--ink-alpha-tertiary": { label: "三级" },
  "--ink-alpha-quaternary": { label: "四级" },
  "--ink-alpha-ring": { label: "焦点环" },
  "--wash-alpha-muted": { label: "Muted" },
  "--wash-alpha-accent": { label: "Accent（悬停 / 选中）" },
  "--wash-alpha-border": { label: "边框" },
  "--relief-drop-a1": { label: "投影 · 0 1px 3px" },
  "--relief-drop-a2": { label: "投影 · 0 0 2px" },
  "--relief-halo-a1": { label: "光晕 · 0 0 4px" },
  "--relief-halo-a2": { label: "光晕 · 0 0 3px" },
  "--glass-relief-k": { label: "玻璃上 ×" },
  "--glass-relief-solid-k": { label: "面板 / 弹层上 ×" },
  "--glass-fill": { label: "玻璃" },
  "--glass-fill-raised": { label: "抬升" },
  "--glass-fill-panel": { label: "面板" },
  "--glass-fill-popover": { label: "弹层" },
  "--glass-fill-sheet": { label: "二级面板" },
  "--glass-hover-step": { label: "悬停增量" },
  "--glass-dark-add": { label: "深色补偿" },
  "--glass-add-k": { label: "吸收 --wp-glass-add ×" },
  "--tint-glass": { label: "玻璃着色" },
  "--tint-accent": { label: "强调着色" },
};

const SHEET_GROUPS_ZH: Record<string, { title: string; note?: string }> = {
  "Ink ladder": { title: "墨色阶梯", note: "--ink 的透明度。主墨即墨本身；正文在调用处为 foreground/85。" },
  Washes: { title: "洗色", note: "墨色几个百分点的填充：kbd、悬停、分隔线。" },
  "Relief shape": { title: "浮雕形状", note: "浅墨下投影，深墨下光晕。由 --wp-relief 缩放。" },
  "Glass fills": { title: "玻璃填充", note: "当前材质的阶梯。切换材质以编辑另一套。" },
  "Tint amounts": { title: "着色量", note: "零即中性。“壁纸”着色设置会提升两者。" },
};

export function useLabText() {
  const { locale } = useLocale();
  const L = STRINGS[locale] as LabStrings;
  const zh = locale === "zh";
  return {
    locale,
    zh,
    L,
    knobLabel: (key: string, fallback: string) => (zh ? (KNOBS_ZH[key]?.label ?? fallback) : fallback),
    knobHint: (key: string, fallback?: string) => (zh ? (KNOBS_ZH[key]?.hint ?? fallback) : fallback),
    groupTitle: (title: string) => (zh ? (SHEET_GROUPS_ZH[title]?.title ?? title) : title),
    groupNote: (title: string, fallback?: string) =>
      zh ? (SHEET_GROUPS_ZH[title]?.note ?? fallback) : fallback,
    themeName: (theme: "light" | "dark") => (theme === "dark" ? L.dark : L.light),
    materialName: (m: "tinted" | "clear") => (m === "clear" ? L.clear : L.tinted),
    tintName: (t: "neutral" | "wallpaper") => (t === "wallpaper" ? L.wallpaperTint : L.neutral),
    weatherName: (condition: WeatherCondition) => getWeatherConditionLabel(condition, locale as Locale),
  };
}
