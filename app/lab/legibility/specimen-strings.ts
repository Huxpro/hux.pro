import type { LabTable } from "@/systems/lab";

// The specimens' own words, where the site has none to lend. Wherever a
// specimen draws a piece of the site that already has a string in the site
// dictionary (a widget title, the palette placeholder, the wallpaper sheet),
// specimens.tsx reads that string instead, so the two cannot drift. Content —
// post and talk titles, a track — stays as it was authored, as on the site.

const en = {
  ladder: {
    primary: "primary — the ink",
    secondary: "secondary — muted-foreground",
    tertiary: "tertiary — captions, dates beside a title",
    quaternary: "quaternary — hashes, separators, placeholders",
  },
  apps: ["Writing", "Works", "Prompt", "Docs"],
  nowPlaying: "now playing",
  navigation: "navigation",
  paletteRows: ["Writing", "Wallpaper: Tahoe", "Glass: Clear", "Toggle theme"],
  minRead: "4 min read",
  articleLead:
    "A fixed grey was a pre-computed alpha for a page that was only ever white or near-black. Under a picture it stops being any alpha at all — ",
  articleLink: "the same word",
  articleMid: " reads differently on every wallpaper, and ",
  articleTail: " stops meaning “secondary”.",
  articleQuote: "Regardless of the material you choose, use vibrant colors on top of it.",
  articleLang: "en",
};

const zh: typeof en = {
  ladder: {
    primary: "一阶 — 墨本身",
    secondary: "二阶 — muted-foreground",
    tertiary: "三阶 — 说明文字、标题旁的日期",
    quaternary: "四阶 — 哈希、分隔符、占位符",
  },
  apps: ["写作", "作品", "提示词", "文档"],
  nowPlaying: "正在播放",
  navigation: "导航",
  paletteRows: ["写作", "壁纸：Tahoe", "玻璃：透明", "切换主题"],
  minRead: "4 分钟",
  articleLead:
    "固定的灰色，其实是为一张只会是白色或近黑色的页面预先算好的透明度。一旦底下换成一张图，它就什么透明度都不是了——",
  articleLink: "同一个词",
  articleMid: "在每一张壁纸上读起来都不一样，",
  articleTail: "也不再意味着「次要」。",
  articleQuote: "无论选择哪种材质，都要在其上使用鲜明的颜色。",
  articleLang: "zh",
};

export const SPECIMEN_STRINGS: LabTable<typeof en> = { en, zh };
