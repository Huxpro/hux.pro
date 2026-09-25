"use client";

import {
  getGlassLabel,
  getTintLabel,
  localeNames,
  t,
  useGlass,
  useInputCapability,
  useLocale,
  useTheme,
} from "@/services";
import { useAbout } from "@/systems/about";
import { useLocation, useSolarTheme, useWallpaper } from "@/systems/ambient";
import { getWallpaperPlayName, getWeatherWallpaperName } from "@/systems/ambient/lib/wallpaper";
import { useDevtool } from "@/systems/devtool";
import { installTarget, useInstall } from "@/systems/install";
import { useMusic } from "@/systems/music";
import { isVoiceSupported } from "@/systems/voice";
import {
  Bug,
  FileText,
  GitCommit,
  Home,
  Image as ImageIcon,
  Layers2,
  Languages,
  Mic,
  MapPin,
  Monitor,
  MonitorDown,
  Moon,
  Music,
  Orbit,
  Sparkles,
  SquarePlus,
  Sun,
  Sunrise,
} from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
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
 *   surface   opens a secondary surface (the wallpaper picker); the popover
 *             closes, the phone sheet stays behind it as a stack.
 *   toggle    flips a setting; chosen from search the palette stays open so
 *             the new value can be read back, from the slash list it closes.
 *   stay      changes what the palette itself is doing (voice: back to the
 *             field, listening); the palette stays exactly where it is.
 */
export type CommandKind = "navigate" | "surface" | "toggle" | "stay";

export interface CommandAction {
  /** cmdk value and React key. */
  id: string;
  /** Slash letter, when it has one. */
  key?: string;
  kind: CommandKind;
  /**
   *   navigation  goes somewhere
   *   actions     does one thing, now — install, speak, play
   *   settings    a value that stays, read back in its row
   */
  section: "navigation" | "actions" | "settings";
  /** In the slash list only, never a search result: a command whose control
   *  is already on screen (voice: the field's microphone). */
  slashOnly?: boolean;
  /** Search / slash row text. Keyboard-only commands (docs, editor) have none. */
  label?: string;
  icon?: React.ReactNode;
  /** cmdk search terms, both languages. */
  keywords: string[];
  /** `key`: the slash letter that ran it, when a key did — a command that
   *  can be held (voice) reads it to follow the key's release. */
  run: (ctx?: { key?: string }) => void | Promise<void>;
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
    play: wallpaperPlay,
    playAlbum: wallpaperPlayAlbum,
    openPicker: openWallpaperPicker,
  } = useWallpaper();
  const {
    material: glassMaterial,
    toggle: toggleGlass,
    tint: glassTint,
    setTint: setGlassTint,
  } = useGlass();
  const { followSun, setFollowSun } = useSolarTheme();
  const { isShowing: isDevtoolShowing, toggleShowing: toggleDevtool } =
    useDevtool();
  const {
    playerState: musicPlayerState,
    play: musicPlay,
    pause: musicPause,
  } = useMusic();
  const { open: openAbout } = useAbout();
  const { requestVoice } = useCommand();
  const { guide: installGuide, open: openInstall } = useInstall();
  const router = useTransitionRouter();

  // Named for where it lands: a phone's home screen, a Mac's Dock, an app
  // everywhere else. See systems/install/lib/platform.ts.
  const installDestination = installTarget(installGuide);

  const wallpaperLabel =
    wallpaperKind === "image"
      ? wallpaperPlay !== "off" && wallpaperPlayAlbum
        ? `${getWallpaperPlayName(locale, wallpaperPlay, wallpaperPlayAlbum)} · ${wallpaper.name}`
        : wallpaper.name
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
    {
      // The About: who made this and what it is. `O` opens it from anywhere
      // outside the palette too (systems/about).
      id: "about",
      key: "o",
      // `navigate`, not `surface`: the phone sheet must not stay behind the
      // About as a stack — it would show through the veil.
      kind: "navigate",
      section: "navigation",
      label: t(locale, "aboutTitle"),
      icon: <Orbit className={ROW_ICON} />,
      keywords: [
        "about",
        "hux",
        "who",
        "bio",
        "os",
        "credits",
        "关于",
        "黄玄",
        "简介",
        "致谢",
      ],
      run: () => openAbout(),
    },
    // Speak instead of type: back to the field, listening (systems/voice).
    // Only where the browser can recognise speech.
    ...(isVoiceSupported()
      ? [
          {
            id: "voice",
            key: "v",
            kind: "stay" as const,
            section: "actions" as const,
            slashOnly: true,
            label: t(locale, "voiceSearch"),
            icon: <Mic className={ROW_ICON} />,
            keywords: ["voice", "speak", "dictate", "microphone", "mic", "语音", "说话", "麦克风"],
            // Tap `/` `V` to start; hold it to talk, and let go to send.
            run: (ctx?: { key?: string }) => requestVoice(ctx?.key),
          },
        ]
      : []),
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
      // Keyboard-only, same as docs. `e` opens log.json. The other
      // labs stay on the editor dropdown; the palette does not list them.
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
      // `o` went to the About; `c` for coordinates.
      key: "c",
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
        "shuffle",
        "loop",
        "random",
        "壁纸",
        "背景",
        "天气",
        "渐变",
        "桌面",
        "随机",
        "循环",
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
    {
      id: "tint",
      key: "t",
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
      id: "follow-the-sun",
      key: "s",
      kind: "toggle",
      section: "settings",
      label: `${t(locale, "settingsSolarTheme")}: ${
        followSun ? t(locale, "stateOn") : t(locale, "stateOff")
      }`,
      icon: <Sunrise className={ROW_ICON} />,
      keywords: [
        "sun",
        "sunrise",
        "sunset",
        "follow the sun",
        "auto theme",
        "day night",
        "日出",
        "日落",
        "太阳",
        "自动切换",
      ],
      run: () => setFollowSun(!followSun),
    },
    {
      id: "music",
      key: "m",
      kind: "toggle",
      section: "actions",
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
    // Hidden once the site IS the app: from inside it there is nothing to add.
    ...(installGuide === "installed"
      ? []
      : [
          {
            id: "install",
            // Opens the directions, not the install: that press is the
            // browser's (see systems/install).
            kind: "surface",
            section: "actions",
            label: t(
              locale,
              installDestination === "dock"
                ? "installCommandDock"
                : installDestination === "app"
                  ? "installCommandApp"
                  : "installCommand"
            ),
            icon:
              installDestination === "home-screen" ? (
                <SquarePlus className={ROW_ICON} />
              ) : (
                <MonitorDown className={ROW_ICON} />
              ),
            keywords: [
              "install",
              "add to home screen",
              "home screen",
              "add to dock",
              "dock",
              "pwa",
              "app",
              "shortcut",
              "安装",
              "添加到主屏幕",
              "主屏幕",
              "桌面",
              "程序坞",
              "应用",
            ],
            run: openInstall,
          } satisfies CommandAction,
        ]),
    {
      id: "debug-panel",
      key: "d",
      // On and off are about what is ON SCREEN, not about `isEnabled` — as a
      // drawer, swiping it away is off, and turning it back on must not take
      // two presses. The devtool works that out (`isShowing`); this row just
      // reports it. Its kind follows what the press will actually do: on opens
      // a surface, so the palette stays behind it as a stack; off opens
      // nothing, so it leaves the way any other setting does.
      kind: isDevtoolShowing ? "toggle" : "surface",
      section: "settings",
      label: `${t(locale, "settingsDebugPanel")}: ${
        isDevtoolShowing ? t(locale, "stateOn") : t(locale, "stateOff")
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
      run: toggleDevtool,
    },
  ];
}

// =============================================================================
// Shell context — how the palette leaves once a command has run.
// The popover closes; the sheet closes too, except after a `surface` command,
// when it stays behind the sheet it opened (see CommandKind, and sheet.tsx).
// =============================================================================

export interface CommandShell {
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

/** Where a command was chosen from — it decides whether the palette stays. */
export type CommandOrigin = "search" | "slash";

/**
 * Run a command, then leave the palette unless it was a toggle chosen from
 * search, which stays so the new value can be read back (see CommandKind).
 */
export function useRunCommand() {
  const { leave } = useCommandShell();
  return async (action: CommandAction, origin: CommandOrigin, key?: string) => {
    await action.run({ key });
    if (action.kind === "stay") return;
    if (origin === "search" && action.kind === "toggle") return;
    leave(action.kind);
  };
}

/**
 * Slash-mode letter shortcuts: a single key runs the command that owns it,
 * Backspace returns to search. Renders nothing; mounted by either shell while
 * it is open — a phone with a hardware keyboard gets the letters too.
 */
export function SlashShortcuts({ actions }: { actions: CommandAction[] }) {
  const { isOpen, isSlashCommandsMode, isLoadBundleMode, setSlashCommandsMode } =
    useCommand();
  const run = useRunCommand();
  const enabled = isOpen && isSlashCommandsMode && !isLoadBundleMode;

  // The handler reads the latest actions without re-subscribing the listener
  // every render (the action list is rebuilt whenever a setting changes).
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // The slash list owns the keyboard while it is up: no key reaches the
    // page, whether or not a command answers to it.
    e.preventDefault();
    if (e.key === "Backspace") {
      setSlashCommandsMode(false);
      return;
    }
    const action = actions.find((a) => a.key === e.key.toLowerCase());
    if (action) void run(action, "slash", e.key);
  });

  useEffect(() => {
    if (!enabled) return;
    const listener = (e: KeyboardEvent) => onKeyDown(e);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [enabled]);

  return null;
}

/**
 * Whether to show keyboard hints — slash letters, `esc`, the footer's arrows.
 * Not a question of shell or viewport but of input: a fine hover pointer
 * means a desktop, or an iPad with a trackpad and so a keyboard; its absence
 * means a phone, or a bare iPad, whichever shell the palette is in. The
 * service tracks it live, so plugging a keyboard into an iPad turns them on.
 */
export function useShowKeyboardHints(): boolean {
  return useInputCapability().hasFineHoverPointer;
}

/**
 * The search field's value, and the one rule about it: "/" typed into an empty
 * field is not text, it is the way into slash mode. Lives in the part of a
 * shell that exists only while the palette is open, so it starts empty each
 * time without a reset.
 */
export function useCommandField() {
  const { setSlashCommandsMode } = useCommand();
  const [value, setValue] = useState("");
  const onChange = (next: string) => {
    if (next === "/" && value === "") {
      setSlashCommandsMode(true);
      setValue("");
    } else {
      setValue(next);
    }
  };
  return { value, onChange };
}
