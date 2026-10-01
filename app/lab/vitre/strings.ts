import type { LabTable } from "@/app/lab/i18n";

// The lab's own words. The documentation itself — every section, table and
// API summary — is the package's, bilingual in its own `Text` type
// (packages/vitre/site/src/docs), and follows the site's language here.

const en = {
  sections: "Sections",
  caption: "Safari's bars are simulated from the page's theme-color.",
  statusTitle: "Tap to scroll to the top",
  phoneTitle: "You are holding the device",
  phoneBody:
    "On a phone the demo needs no simulator: open it full screen and Safari's own toolbar and status bar take its colours. Each card there runs one feature.",
  phoneOpen: "Open the demo",
  live: "In the phone",
  onIphone: "Open this page on an iPhone to use the demo with Safari's real chrome.",
};

const zh: typeof en = {
  sections: "章节",
  caption: "Safari 的状态栏和工具栏根据页面的 theme-color 模拟。",
  statusTitle: "点击回到顶部",
  phoneTitle: "你手里就是那台设备",
  phoneBody:
    "在手机上，演示不需要模拟器：全屏打开它，Safari 自己的工具栏和状态栏就会用上它的颜色。里面的每张卡片演示一个功能。",
  phoneOpen: "打开演示",
  live: "手机里",
  onIphone: "用 iPhone 打开这页，就能在真的 Safari 里试这个 demo。",
};

export const VITRE_STRINGS: LabTable<typeof en> = { en, zh };
