/**
 * Lynx app registry — sample apps sourced from @lynx-example / @vue-lynx-example
 * (same bundles showcased on lynxjs.org / vue.lynxjs.org / go.lynxjs.org).
 *
 * Bundles are prepared into `public/lynx-examples/` by:
 *   pnpm lynx:examples
 */

export type LocalizedString = { en: string; zh: string };

export interface LynxApp {
  /** Stable id; also used as the go-web `example` folder name */
  id: string;
  title: LocalizedString;
  subtitle: LocalizedString;
  /** Accent for the home-screen icon tile */
  accent: string;
  /** Short glyph / initials on the icon */
  glyph: string;
  /** Framework badge */
  framework: "react" | "vue";
  /** Default source file hint for go-web (unused in preview mode, kept for completeness) */
  defaultFile: string;
  /** Preferred window size (phone-like by default) */
  window: { width: number; height: number };
}

export const LYNX_APPS: LynxApp[] = [
  {
    id: "hello-world",
    title: { en: "Hello World", zh: "你好世界" },
    subtitle: { en: "ReactLynx starter", zh: "ReactLynx 入门" },
    accent: "oklch(0.55 0.14 250)",
    glyph: "R",
    framework: "react",
    defaultFile: "src/App.tsx",
    window: { width: 390, height: 720 },
  },
  {
    id: "animation",
    title: { en: "Animation", zh: "动画" },
    subtitle: { en: "Motion on Lynx", zh: "Lynx 动效" },
    accent: "oklch(0.58 0.16 30)",
    glyph: "A",
    framework: "react",
    defaultFile: "src/App.tsx",
    window: { width: 390, height: 720 },
  },
  {
    id: "bankcards",
    title: { en: "Bank Cards", zh: "银行卡" },
    subtitle: { en: "Scroll & cards demo", zh: "滚动与卡片" },
    accent: "oklch(0.52 0.12 160)",
    glyph: "B",
    framework: "react",
    defaultFile: "src/App.tsx",
    window: { width: 390, height: 720 },
  },
  {
    id: "Vuehello-world",
    title: { en: "Vue Hello", zh: "Vue 你好" },
    subtitle: { en: "VueLynx starter", zh: "VueLynx 入门" },
    accent: "oklch(0.55 0.14 145)",
    glyph: "V",
    framework: "vue",
    defaultFile: "src/App.vue",
    window: { width: 390, height: 720 },
  },
  {
    id: "Vuetodomvc",
    title: { en: "TodoMVC", zh: "待办" },
    subtitle: { en: "VueLynx TodoMVC", zh: "VueLynx 待办" },
    accent: "oklch(0.5 0.1 280)",
    glyph: "T",
    framework: "vue",
    defaultFile: "src/App.vue",
    window: { width: 390, height: 720 },
  },
];

export function getLynxApp(id: string): LynxApp | undefined {
  return LYNX_APPS.find((app) => app.id === id);
}
