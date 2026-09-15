"use client";

import {
  getGlassLabel,
  getTintLabel,
  localeNames,
  t,
  useGlass,
  useLocale,
  useTheme,
} from "@/services";
import { useLocation, useWallpaper } from "@/systems/ambient";
import { getWeatherWallpaperName } from "@/systems/ambient/lib/wallpaper";
import { useDevtool } from "@/systems/devtool";
import { useMusic } from "@/systems/music";
import {
  Bug,
  FileText,
  GitCommit,
  Home,
  Image as ImageIcon,
  Layers2,
  Languages,
  MapPin,
  Monitor,
  Moon,
  Music,
  Sparkles,
  Sun,
} from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { createContext, useContext, useEffect } from "react";
import { useCommand } from "./provider";

// =============================================================================
// Command actions — the one list behind search results, the slash list and
// the slash letter shortcuts.
//
// A command is a thing the palette can do; how it is reached (typed, tapped,
// a single letter) is the shell's business, and there are two shells: the
// desktop popover and the phone sheet. Each command says what kind of thing
// it does, and the shell decides what happens to the palette afterwards.
// =============================================================================

/**
 * What a command does to the world, which decides what the palette does next:
 *
 *   navigate  goes somewhere; the palette is finished.
 *   surface   opens a secondary surface (the wallpaper picker); the palette is
 *             finished, but on a phone it hands off to the sheet it opened.
 *   toggle    flips a setting; chosen from search the palette stays open so
 *             the new value can be read back, from the slash list it closes.
 */
export type CommandKind = "navigate" | "surface" | "toggle";

export interface CommandAction {
  /** cmdk value and React key. */
  id: string;
  /** Slash letter, when it has one. */
  key?: string;
  kind: CommandKind;
  section: "navigation" | "settings";
  /** Search / slash row text. Keyboard-only commands (docs, editor) have none. */
  label?: string;
  icon?: React.ReactNode;
  /** cmdk search terms, both languages. */
  keywords: string[];
  run: () => void | Promise<void>;
}

const ROW_ICON = "h-4 w-4";

export function useCommandActions(): CommandAction[] {
  const { theme, preference, setThemePreference } = useTheme();
  const { locale, setLocale } = useLocale();
  const { locationMode, setLocationMode, requestAccurateLocation } =
    useLocation();
  const {
    kind: wallpaperKind,
    weatherStyle,
    wallpaper,
    openPicker: openWallpaperPicker,
  } = useWallpaper();
  const {
    material: glassMaterial,
    toggle: toggleGlass,
    tint: glassTint,
    setTint: setGlassTint,
  } = useGlass();
  const { isEnabled: isDevtoolEnabled, setEnabled: setDevtoolEnabled } =
    useDevtool();
  const {
    playerState: musicPlayerState,
    play: musicPlay,
    pause: musicPause,
  } = useMusic();
  const router = useTransitionRouter();

  const wallpaperLabel =
    wallpaperKind === "image"
      ? wallpaper.name
      : getWeatherWallpaperName(locale, weatherStyle);

  const themeLabel =
    preference === "system"
      ? t(locale, "themeSystem")
      : theme === "light"
      ? t(locale, "themeLight")
      : t(locale, "themeDark");
  const ThemeIcon =
    preference === "system" ? Monitor : theme === "light" ? Sun : Moon;

  return [
    {
      id: "home",
      key: "h",
      kind: "navigate",
      section: "navigation",
      label: t(locale, "home"),
      icon: <Home className={ROW_ICON} />,
      keywords: ["home", "index", "main", "首页"],
      run: () => router.push("/"),
    },
    {
      id: "writing",
      key: "u",
      kind: "navigate",
      section: "navigation",
      label: t(locale, "writingTitle"),
      icon: <FileText className={ROW_ICON} />,
      keywords: [
        "writing",
        "blog",
        "posts",
        "prose",
        "articles",
        "文字",
        "写作",
        "博客",
        "文章",
      ],
      run: () => router.push("/writing"),
    },
    {
      id: "works",
      key: "x",
      kind: "navigate",
      section: "navigation",
      label: t(locale, "worksTitle"),
      icon: <GitCommit className={ROW_ICON} />,
      keywords: [
        "works",
        "log",
        "history",
        "timeline",
        "commits",
        "git",
        "career",
        "作品",
        "日志",
        "历史",
      ],
      run: () => router.push("/works"),
    },
    {
      id: "prompt",
      key: "p",
      kind: "navigate",
      section: "navigation",
      label: t(locale, "promptsTitle"),
      icon: <Sparkles className={ROW_ICON} />,
      keywords: [
        "prompt",
        "prompts",
        "ai",
        "system",
        "instructions",
        "系统提示词",
        "提示词",
        "AI",
        "系统",
      ],
      run: () => router.push("/prompt"),
    },
    // Keyboard-only: reachable by letter from the slash list, never listed.
    {
      id: "docs",
      key: "i",
      kind: "navigate",
      section: "navigation",
      keywords: [],
      run: () => router.push("/docs"),
    },
    {
      id: "editor",
      key: "e",
      kind: "navigate",
      section: "navigation",
      keywords: [],
      run: () => router.push("/editor"),
    },
    {
      id: "theme",
      key: "a",
      kind: "toggle",
      section: "settings",
      label: `${t(locale, "appearance")}: ${themeLabel}`,
      icon: <ThemeIcon className={ROW_ICON} />,
      keywords: ["theme", "dark", "light", "mode", "主题", "深色", "浅色"],
      run: () => {
        setThemePreference(
          preference === "system"
            ? "dark"
            : preference === "dark"
            ? "light"
            : "system"
        );
      },
    },
    {
      id: "language",
      key: "l",
      kind: "toggle",
      section: "settings",
      label: `${t(locale, "languageLabel")}: ${localeNames[locale]}`,
      icon: <Languages className={ROW_ICON} />,
      keywords: ["language", "english", "chinese", "语言", "中文", "英文"],
      run: () => setLocale(locale === "en" ? "zh" : "en"),
    },
    {
      id: "location",
      key: "o",
      kind: "toggle",
      section: "settings",
      label: `${t(locale, "settingsGeolocation")}: ${
        locationMode === "accurate"
          ? t(locale, "locationAccurate")
          : t(locale, "locationIp")
      }`,
      icon: <MapPin className={ROW_ICON} />,
      keywords: [
        "location",
        "geolocation",
        "geo",
        "ip",
        "accurate",
        "定位",
        "位置",
        "精确",
      ],
      run: async () => {
        if (locationMode === "ip") {
          await requestAccurateLocation();
        } else {
          setLocationMode("ip");
        }
      },
    },
    {
      id: "wallpaper",
      key: "w",
      kind: "surface",
      section: "settings",
      label: `${t(locale, "settingsWallpaper")}: ${wallpaperLabel}`,
      icon: <ImageIcon className={ROW_ICON} />,
      keywords: [
        "wallpaper",
        "background",
        "image",
        "desktop",
        "macos",
        "ios",
        "壁纸",
        "背景",
        "天气",
        "渐变",
        "桌面",
      ],
      run: () => openWallpaperPicker(),
    },
    {
      id: "glass",
      key: "g",
      kind: "toggle",
      section: "settings",
      label: `${t(locale, "settingsGlass")}: ${getGlassLabel(glassMaterial, locale)}`,
      icon: <Layers2 className={ROW_ICON} />,
      keywords: [
        "glass",
        "material",
        "clear",
        "tinted",
        "translucent",
        "liquid glass",
        "玻璃",
        "材质",
        "透明",
        "色调",
      ],
      run: () => toggleGlass(),
    },
    // No letter: search only.
    {
      id: "tint",
      kind: "toggle",
      section: "settings",
      label: `${t(locale, "settingsTint")}: ${getTintLabel(glassTint, locale)}`,
      icon: (
        <span
          aria-hidden
          className="size-4 shrink-0 rounded-full border border-border bg-tint"
        />
      ),
      keywords: [
        "tint",
        "accent",
        "colour",
        "color",
        "wallpaper colour",
        "neutral",
        "着色",
        "强调色",
        "中性",
      ],
      run: () =>
        setGlassTint(glassTint === "wallpaper" ? "neutral" : "wallpaper"),
    },
    {
      id: "music",
      key: "m",
      kind: "toggle",
      section: "settings",
      label: `${t(locale, "settingsMusic")}: ${
        musicPlayerState === "playing"
          ? t(locale, "musicPause")
          : t(locale, "musicPlay")
      }`,
      icon: <Music className={ROW_ICON} />,
      keywords: [
        "music",
        "spotify",
        "now playing",
        "song",
        "track",
        "音乐",
        "歌曲",
        "播放",
      ],
      run: () => {
        if (musicPlayerState === "playing") {
          musicPause();
        } else {
          musicPlay();
        }
      },
    },
    {
      id: "debug-panel",
      key: "d",
      kind: "toggle",
      section: "settings",
      label: `${t(locale, "settingsDebugPanel")}: ${
        isDevtoolEnabled ? t(locale, "stateOn") : t(locale, "stateOff")
      }`,
      icon: <Bug className={ROW_ICON} />,
      keywords: [
        "debug",
        "debug panel",
        "developer",
        "devtools",
        "test gradients",
        "调试",
        "调试面板",
      ],
      run: () => setDevtoolEnabled(!isDevtoolEnabled),
    },
  ];
}

// =============================================================================
// Shell context — how the palette leaves once a command has run.
//
// The popover simply closes. The sheet closes too, except after a `surface`
// command, when it stays put and recedes while the surface it opened arrives,
// then goes — the iOS hand-off from one sheet to the next.
// =============================================================================

export interface CommandShell {
  /** The palette's shape, for content that adapts (no keyboard hints on a sheet). */
  shape: "popover" | "sheet";
  /** Leave the palette after a command of this kind. */
  leave: (kind: CommandKind) => void;
}

const CommandShellContext = createContext<CommandShell | null>(null);

export const CommandShellProvider = CommandShellContext.Provider;

export function useCommandShell(): CommandShell {
  const ctx = useContext(CommandShellContext);
  if (!ctx) {
    throw new Error("useCommandShell must be used within a command shell");
  }
  return ctx;
}

/**
 * Run a command and leave the palette the way its kind asks — from the slash
 * list, every kind leaves. Search rows call `leave` only for the kinds that
 * finish the palette (see CommandKind).
 */
export function useRunCommand() {
  const { leave } = useCommandShell();
  return async (action: CommandAction, { stayOnToggle = false } = {}) => {
    await action.run();
    if (stayOnToggle && action.kind === "toggle") return;
    leave(action.kind);
  };
}

/**
 * Slash-mode letter shortcuts: a single key runs the command that owns it,
 * Backspace returns to search. Works in either shell — a phone with a hardware
 * keyboard gets them too.
 */
export function useSlashShortcuts(actions: CommandAction[], enabled: boolean) {
  const { setSlashCommandsMode } = useCommand();
  const run = useRunCommand();

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // The slash list owns the keyboard while it is up: no key reaches
      // the page, whether or not a command answers to it.
      e.preventDefault();
      if (e.key === "Backspace") {
        setSlashCommandsMode(false);
        return;
      }
      const action = actions.find((a) => a.key === e.key.toLowerCase());
      if (action) void run(action);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, actions, run, setSlashCommandsMode]);
}
