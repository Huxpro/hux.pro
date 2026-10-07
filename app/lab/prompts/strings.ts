// =============================================================================
// Prompts Lab strings: both languages, keyed (see systems/lab/i18n.ts).
//
// Field and rule names (statements, instances, shapedBy, ref, facet,
// could-link) stay as written: they are what you search prompts.json and
// lib/prompts-lab.ts for. The check messages themselves come from
// lib/prompts-lab.ts, in both languages, so the page and
// `pnpm prompts:check` say the same thing.
// =============================================================================

import type { LabTable } from "@/systems/lab";

const en = {
  // Views
  views: { map: "Map", voices: "Voices", search: "Search", checks: "Checks" },
  summary: (convictions: number, statements: number, instances: number, influences: number) =>
    `prompts.json · ${convictions} convictions · ${statements} statements · ${instances} instances · ${influences} influences`,
  issuesShort: (errors: number, warnings: number) =>
    errors || warnings ? `${errors} errors · ${warnings} warnings` : "clean",

  // Map
  graph: "References",
  graphNote:
    "Every entry, on its shelf, and what points where. A solid line is an instance filed under another entry too (the page's own reading order); a dashed one, an influence that shaped or is quoted by an entry. Hover or pick one to see only its lines.",
  influences: "Influences",
  legendLink: "instance ref",
  legendShaped: "shapedBy",
  legendQuoted: "quoted by ref",
  entries: "Entries",
  entriesNote:
    "Each entry measured: the voices under its head (three at most), its instances, how much of it is borrowed, how long its commentary runs, and what it links to and from.",
  voicesMeter: (n: number, max: number) => `${n}/${max} voices`,
  instancesMeter: (n: number) => `${n} instances`,
  quotedMeter: (q: number, total: number) => `${q}/${total} quoted`,
  bodyMeter: (en: number, zh: number) => `body ${en} · ${zh}`,
  linksIn: "in",
  linksOut: "out",

  // Detail
  detailEmpty: "Pick an entry on the map, a voice or a result to see it whole here.",
  head: "head",
  voice: "voice",
  instance: "instance",
  shapedBy: "shapedBy",
  shapes: "Shapes",
  quotedIn: "Quoted in",
  openOnPrompt: "Open on /prompt",
  close: "Close",
  untitled: "untitled",
  mine: "mine",

  // Voices
  voicesNote:
    "Everyone the page quotes, grouped by name across entries, most-quoted first. Look here before adding a quote: who is already speaking, and where.",
  filterVoices: "Filter by name…",
  repeatOnly: "quoted 2+",
  linkedOnly: "has an entry",
  times: (n: number) => `×${n}`,
  noVoices: "No one by that name.",

  // Search
  searchNote:
    "Every sentence on the page as one list, searched in both languages: text, titles, facets, names and sources. Where does this belong; have I already said it?",
  searchPlaceholder: "Search both languages…",
  kinds: { head: "head", voice: "voice", instance: "instance" },
  borrowed: "borrowed",
  results: (n: number) => `${n} results`,
  noResults: "Nothing matches.",

  // Checks
  checksNote:
    "The rules lib/prompts.ts states in comments, run as rules, plus a few the file cannot say about itself. The same checks as pnpm prompts:check, which fails on an error.",
  levels: { error: "Errors", warn: "Warnings", info: "Suggestions" },
  allClear: "Nothing to report.",
};

const zh: typeof en = {
  views: { map: "地图", voices: "声部", search: "检索", checks: "体检" },
  summary: (convictions, statements, instances, influences) =>
    `prompts.json · ${convictions} 条原则 · ${statements} 个 statements · ${instances} 个 instances · ${influences} 个 influences`,
  issuesShort: (errors, warnings) => (errors || warnings ? `${errors} 个错误 · ${warnings} 个警告` : "无问题"),

  graph: "引用关系",
  graphNote:
    "每一条原则在它的格里，以及谁指向谁。实线是一个 instance 同时挂在另一条下（也就是页面自己的阅读顺序）；虚线是一个 influence 塑造了或被引用于某一条。悬停或选中一个，只看它的线。",
  influences: "影响",
  legendLink: "instance ref",
  legendShaped: "shapedBy",
  legendQuoted: "按 ref 引用",
  entries: "条目",
  entriesNote: "每一条的体量：head 下的声部（最多三个）、instances、借来的比例、正文长度，以及它链出和被链入的条目。",
  voicesMeter: (n, max) => `${n}/${max} 声部`,
  instancesMeter: (n) => `${n} 个 instances`,
  quotedMeter: (q, total) => `${q}/${total} 有出处`,
  bodyMeter: (en, zh) => `正文 ${en} · ${zh}`,
  linksIn: "入",
  linksOut: "出",

  detailEmpty: "在地图上选一条、点一个声部或一条结果，它的全貌会显示在这里。",
  head: "head",
  voice: "声部",
  instance: "instance",
  shapedBy: "shapedBy",
  shapes: "塑造了",
  quotedIn: "被引用于",
  openOnPrompt: "在 /prompt 打开",
  close: "关闭",
  untitled: "无标题",
  mine: "我的",

  voicesNote: "页面引用过的每一个人，跨条目按名字归在一起，引用最多的在前。加新 quote 之前先来这里看：谁已经在说话，在哪里说。",
  filterVoices: "按名字筛选…",
  repeatOnly: "出现 2 次以上",
  linkedOnly: "有自己的条目",
  times: (n) => `×${n}`,
  noVoices: "没有这个名字。",

  searchNote: "页面上的每一句话拍平成一张表，中英文一起搜：正文、标题、facet、人名和出处。这句该放哪？我是不是已经说过了？",
  searchPlaceholder: "中英文一起搜…",
  kinds: { head: "head", voice: "声部", instance: "instance" },
  borrowed: "有出处",
  results: (n) => `${n} 条结果`,
  noResults: "没有匹配的。",

  checksNote:
    "lib/prompts.ts 在注释里写下的规矩，作为规则来跑，再加几条文件自己说不出来的。和 pnpm prompts:check 是同一套检查，有错误时它会失败。",
  levels: { error: "错误", warn: "警告", info: "建议" },
  allClear: "没有问题。",
};

export const PROMPTS_STRINGS: LabTable<typeof en> = { en, zh };
