// Plain data shared by the palette, Ask's tool schemas and the benchmark.
// Every command id must have a description here; its implementation stays
// in useCommandActions so a tap in either surface does exactly the same thing.
export interface CommandDefinition {
  title: { en: string; zh: string };
  description: string;
  /** Ask may apply an explicit request, or must keep it behind a tap.
   * A target override can be stricter (GPS and starting music). */
  policy: { execution: "on-request" | "user-gesture"; gestureValues?: readonly string[] };
  options?: readonly { value: string; en: string; zh: string }[];
}

export const COMMAND_CATALOG = {
  home: { policy: { execution: "on-request" }, title: { en: "Home", zh: "首页" }, description: "Go to the home page with the personal OS widgets." },
  writing: { policy: { execution: "on-request" }, title: { en: "Writing", zh: "文字" }, description: "Open the blog and essays, in English and Chinese." },
  works: { policy: { execution: "on-request" }, title: { en: "Works", zh: "作品" }, description: "Open the career timeline, projects, talks and recordings." },
  prompt: { policy: { execution: "on-request" }, title: { en: "Prompts", zh: "提示词" }, description: "Open Hux's convictions, influences and system prompts." },
  about: { policy: { execution: "on-request" }, title: { en: "About", zh: "关于" }, description: "Open the About overlay introducing Hux and this personal operating system." },
  voice: { policy: { execution: "user-gesture" }, title: { en: "Voice search", zh: "语音搜索" }, description: "Start dictating into the command palette microphone. Requires browser speech recognition support." },
  ask: { policy: { execution: "on-request" }, title: { en: "Ask AI", zh: "问 AI" }, description: "Open this AI conversation in the command palette." },
  docs: { policy: { execution: "on-request" }, title: { en: "Documentation", zh: "文档" }, description: "Open the site's technical documentation." },
  lab: { policy: { execution: "on-request" }, title: { en: "Labs", zh: "实验室" }, description: "Explore the interactive labs: glass, glow, typography, attachments and the Vitre bezel library." },
  theme: { policy: { execution: "on-request" },
    title: { en: "Appearance", zh: "外观" },
    description: "Change the site theme: light, dark, follow the operating system, or follow local sunrise and sunset. Omit value to offer all four choices.",
    options: [
      { value: "light", en: "Light", zh: "浅色" },
      { value: "dark", en: "Dark", zh: "深色" },
      { value: "system", en: "Follow the System", zh: "跟随系统" },
      { value: "sun", en: "Follow the Sun", zh: "跟随太阳" },
    ],
  },
  language: { policy: { execution: "on-request" },
    title: { en: "Language", zh: "语言" },
    description: "Set the site's UI language to English (en) or Chinese (zh). This changes the website language, not just the reply language. Omit value to offer both choices.",
    options: [{ value: "en", en: "English", zh: "English" }, { value: "zh", en: "中文", zh: "中文" }],
  },
  location: { policy: { execution: "on-request", gestureValues: ["gps"] },
    title: { en: "Location", zh: "定位" },
    description: "Choose approximate IP location or accurate GPS for local weather, sun and moon. Accurate location may ask the browser's permission after a tap.",
    options: [{ value: "ip", en: "Approximate", zh: "大致位置" }, { value: "gps", en: "Accurate", zh: "精确位置" }],
  },
  wallpaper: { policy: { execution: "on-request" },
    title: { en: "Wallpaper", zh: "壁纸" },
    description: "Change the background or weather wallpaper. picker opens the existing Apple/Nature image, shuffle and loop chooser. sky shows the animated local weather sky; gradient shows a weather gradient; classic shows the classic weather animation. These are visual styles, not changes to real weather. Omit value to offer the picker and weather styles.",
    options: [
      { value: "picker", en: "Choose wallpaper", zh: "选择壁纸" },
      { value: "sky", en: "Weather · Sky", zh: "天气 · 天空" },
      { value: "gradient", en: "Weather · Gradient", zh: "天气 · 渐变" },
      { value: "classic", en: "Weather · Classic", zh: "天气 · 经典" },
    ],
  },
  glass: { policy: { execution: "on-request" },
    title: { en: "Glass", zh: "玻璃" },
    description: "Choose clear or tinted Liquid Glass material for the site's floating surfaces.",
    options: [{ value: "clear", en: "Clear", zh: "透明" }, { value: "tinted", en: "Tinted", zh: "色调" }],
  },
  tint: { policy: { execution: "on-request" },
    title: { en: "Tint", zh: "着色" },
    description: "Use neutral glass/accent colours or borrow the wallpaper's dominant colour.",
    options: [{ value: "neutral", en: "Neutral", zh: "中性" }, { value: "wallpaper", en: "Wallpaper", zh: "壁纸色" }],
  },
  music: { policy: { execution: "on-request", gestureValues: ["play"] },
    title: { en: "Music", zh: "音乐" },
    description: "Play or pause the site's background music player. For a talk's recording use play instead.",
    options: [{ value: "play", en: "Play music", zh: "播放音乐" }, { value: "pause", en: "Pause music", zh: "暂停音乐" }],
  },
  install: { policy: { execution: "on-request" }, title: { en: "Install", zh: "安装" }, description: "Open the browser-specific guide to add this site to the home screen, Dock or as an app. Unavailable when already installed." },
  "debug-panel": { policy: { execution: "user-gesture" }, title: { en: "Devtool", zh: "调试面板" }, description: "Toggle the developer panel for inspecting and experimenting with the site's UI settings." },
  "sky-window": { policy: { execution: "on-request" }, title: { en: "Open Sky Window", zh: "打开天空之窗" }, description: "Discover the hidden Sky Window: turn your phone to look around the real sky, sun and moon. Selects the sky background and opens the existing motion/location explanation before any permission prompt. Requires a device with motion sensors; a desktop can preview the explanation." },
} satisfies Record<string, CommandDefinition>;

export type CommandId = keyof typeof COMMAND_CATALOG;
export type CommandToolName = `command_${CommandId}`;
export const COMMAND_IDS = Object.keys(COMMAND_CATALOG) as CommandId[];

export function commandDefinition(id: CommandId): CommandDefinition {
  return COMMAND_CATALOG[id];
}

export function commandIdOf(toolName: string): CommandId | null {
  if (!toolName.startsWith("command_")) return null;
  const id = toolName.slice("command_".length);
  return Object.hasOwn(COMMAND_CATALOG, id) ? id as CommandId : null;
}

export function validCommandValue(id: CommandId, value: unknown): boolean {
  return value === undefined || commandDefinition(id).options?.some((o) => o.value === value) === true;
}
