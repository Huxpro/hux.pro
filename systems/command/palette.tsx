"use client";

import { getLocalizedDescription, getLocalizedTitle } from "@/lib/content";
import { blogPosts, talks } from "@/lib/data";
import { cn } from "@/lib/utils";
import { localeNames, t, useLocale, useTheme } from "@/services";
import { useLocation, useWeather } from "@/systems/ambient";
import { useDevtool } from "@/systems/devtool";
import { Command } from "cmdk";
import {
  Briefcase,
  Bug,
  FileText,
  GitCommit,
  Hash,
  Home,
  Languages,
  MapPin,
  Mic,
  Monitor,
  Moon,
  Search,
  Slash,
  Sparkles,
  Sun,
  Waves,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCommand } from "./provider";

export function CommandPalette() {
  const { isOpen, isSlashCommandsMode, close, setSlashCommandsMode } =
    useCommand();
  const { theme, preference, setThemePreference } = useTheme();
  const { locale, setLocale } = useLocale();
  const { locationMode, setLocationMode, requestAccurateLocation } =
    useLocation();
  const {
    isGradientEnabledForPath,
    getRoutePattern,
    setRouteGradientPreference,
  } = useWeather();
  const { isEnabled: isDevtoolEnabled, setEnabled: setDevtoolEnabled } =
    useDevtool();
  const router = useRouter();
  const pathname = usePathname();

  const currentPattern = getRoutePattern(pathname);
  const isCurrentRouteGradientEnabled = isGradientEnabledForPath(pathname);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isIOS] = useState(() => {
    if (typeof window === "undefined") return false;
    return /iPhone|iPod/.test(navigator.userAgent);
  });

  useEffect(() => {
    if (!isIOS) return;
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScrollPosition(window.scrollY);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, isIOS]);

  useEffect(() => {
    if (isOpen && !isSlashCommandsMode) {
      if (isIOS) return;
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInputValue("");
    }
  }, [isOpen, isSlashCommandsMode, isIOS]);

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
      close();
    },
    [router, close]
  );

  type Action = {
    key: string;
    label?: string;
    icon?: React.ReactNode;
    onSelect: () => void | Promise<void>;
    section?: "navigation" | "settings";
  };

  const actions: Action[] = [
    {
      key: "h",
      label: t(locale, "home"),
      icon: <Home className="h-4 w-4" />,
      onSelect: () => handleNavigation("/"),
      section: "navigation",
    },
    {
      key: "e",
      label: t(locale, "projects"),
      icon: <Briefcase className="h-4 w-4" />,
      onSelect: () => handleNavigation("/projects"),
      section: "navigation",
    },
    {
      key: "b",
      label: t(locale, "prose"),
      icon: <FileText className="h-4 w-4" />,
      onSelect: () => handleNavigation("/prose"),
      section: "navigation",
    },
    {
      key: "t",
      label: t(locale, "productions"),
      icon: <Mic className="h-4 w-4" />,
      onSelect: () => handleNavigation("/productions"),
      section: "navigation",
    },
    {
      key: "o",
      label: t(locale, "log"),
      icon: <GitCommit className="h-4 w-4" />,
      onSelect: () => handleNavigation("/log"),
      section: "navigation",
    },
    {
      key: "p",
      label: t(locale, "prompt"),
      icon: <Sparkles className="h-4 w-4" />,
      onSelect: () => handleNavigation("/prompt"),
      section: "navigation",
    },
    {
      key: "i",
      onSelect: () => handleNavigation("/docs"),
    },
    {
      key: "a",
      label: `${t(locale, "appearance")}: ${
        preference === "system"
          ? t(locale, "themeSystem")
          : theme === "light"
          ? t(locale, "themeLight")
          : t(locale, "themeDark")
      }`,
      icon:
        preference === "system" ? (
          <Monitor className="h-4 w-4" />
        ) : theme === "light" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        ),
      onSelect: () => {
        const nextPreference =
          preference === "system"
            ? "dark"
            : preference === "dark"
            ? "light"
            : "system";
        setThemePreference(nextPreference);
        close();
      },
      section: "settings",
    },
    {
      key: "l",
      label: `${t(locale, "languageLabel")}: ${localeNames[locale]}`,
      icon: <Languages className="h-4 w-4" />,
      onSelect: () => {
        setLocale(locale === "en" ? "zh" : "en");
        close();
      },
      section: "settings",
    },
    {
      key: "g",
      label: `${t(locale, "settingsGeolocation")}: ${
        locationMode === "accurate"
          ? t(locale, "locationAccurate")
          : t(locale, "locationIp")
      }`,
      icon: <MapPin className="h-4 w-4" />,
      onSelect: async () => {
        if (locationMode === "ip") {
          await requestAccurateLocation();
        } else {
          setLocationMode("ip");
        }
        close();
      },
      section: "settings",
    },
    {
      key: "w",
      label: `${t(locale, "settingsWeatherGradient")} (${currentPattern}): ${
        isCurrentRouteGradientEnabled
          ? t(locale, "stateOn")
          : t(locale, "stateOff")
      }`,
      icon: <Waves className="h-4 w-4" />,
      onSelect: () => {
        setRouteGradientPreference(
          currentPattern,
          !isCurrentRouteGradientEnabled
        );
        close();
      },
      section: "settings",
    },
    {
      key: "d",
      label: `${t(locale, "settingsDebugPanel")}: ${
        isDevtoolEnabled ? t(locale, "stateOn") : t(locale, "stateOff")
      }`,
      icon: <Bug className="h-4 w-4" />,
      onSelect: () => {
        setDevtoolEnabled(!isDevtoolEnabled);
        close();
      },
      section: "settings",
    },
  ];

  useEffect(() => {
    if (!isOpen || !isSlashCommandsMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        setSlashCommandsMode(false);
        return;
      }

      const key = e.key.toLowerCase();
      e.preventDefault();
      switch (key) {
        case "h":
          handleNavigation("/");
          return;
        case "e":
          handleNavigation("/projects");
          return;
        case "b":
          handleNavigation("/prose");
          return;
        case "t":
          handleNavigation("/productions");
          return;
        case "o":
          handleNavigation("/log");
          return;
        case "p":
          handleNavigation("/prompt");
          return;
        case "i":
          handleNavigation("/docs");
          return;
        case "a": {
          const nextPreference =
            preference === "system"
              ? "dark"
              : preference === "dark"
              ? "light"
              : "system";
          setThemePreference(nextPreference);
          close();
          return;
        }
        case "l":
          setLocale(locale === "en" ? "zh" : "en");
          close();
          return;
        case "g":
          void (async () => {
            if (locationMode === "ip") {
              await requestAccurateLocation();
            } else {
              setLocationMode("ip");
            }
            close();
          })();
          return;
        case "w":
          setRouteGradientPreference(
            currentPattern,
            !isCurrentRouteGradientEnabled
          );
          close();
          return;
        case "d":
          setDevtoolEnabled(!isDevtoolEnabled);
          close();
          return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isSlashCommandsMode,
    setSlashCommandsMode,
    handleNavigation,
    preference,
    setThemePreference,
    close,
    setLocale,
    locale,
    locationMode,
    currentPattern,
    isCurrentRouteGradientEnabled,
    isDevtoolEnabled,
    requestAccurateLocation,
    setLocationMode,
    setRouteGradientPreference,
    setDevtoolEnabled,
  ]);

  useEffect(() => {
    if (!isOpen || isSlashCommandsMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isCommandInput =
        target === inputRef.current ||
        (target.tagName === "INPUT" && target.closest("[cmdk-root]") !== null);
      if (isCommandInput && inputValue.length > 0) {
        return;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSlashCommandsMode, inputValue]);

  const handleInputChange = (value: string) => {
    if (value === "/" && inputValue === "") {
      setSlashCommandsMode(true);
      setInputValue("");
    } else {
      setInputValue(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "z-[60] flex items-start justify-center pt-[20vh]",
        isIOS ? "absolute inset-x-0" : "fixed inset-0"
      )}
      style={isIOS ? { top: scrollPosition, height: "100dvh" } : undefined}
    >
      <div
        className="absolute inset-0 bg-transparent"
        onClick={!isIOS ? close : undefined}
        onPointerDown={isIOS ? close : undefined}
      />

      <Command
        className={cn(
          "relative mx-4 transition-all duration-300 ease-out",
          "bg-popover/75 backdrop-blur-xl",
          "rounded-2xl border border-black/10 dark:border-white/10",
          "shadow-2xl shadow-black/30",
          "outline-none",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          isSlashCommandsMode ? "w-full max-w-[400px]" : "w-full max-w-[700px]",
          "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
        )}
        loop
        shouldFilter={!isSlashCommandsMode}
      >
        <div className="border-b border-border/50">
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: isSlashCommandsMode ? "0fr" : "1fr" }}
          >
            <div className="overflow-hidden">
              <div
                className={cn(
                  "flex items-center gap-3 px-4 transition-opacity duration-300 ease-out",
                  isSlashCommandsMode ? "opacity-0" : "opacity-100"
                )}
              >
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <Command.Input
                    ref={inputRef}
                    value={inputValue}
                    onValueChange={handleInputChange}
                    placeholder={t(locale, "searchPlaceholder")}
                    className={cn(
                      "w-full py-4 bg-transparent font-sans text-[16px] sm:text-sm",
                      "placeholder:text-muted-foreground/60",
                      "outline-none"
                    )}
                  />
                </div>
                <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded">
                  esc
                </kbd>
              </div>
            </div>
          </div>
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: isSlashCommandsMode ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-opacity duration-300 ease-out",
                  isSlashCommandsMode ? "opacity-100" : "opacity-0"
                )}
              >
                <Slash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 font-sans text-sm font-medium text-muted-foreground">
                  {t(locale, "slashCommands")}
                </span>
                <kbd className="px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded">
                  esc
                </kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            className={cn(
              "grid transition-all duration-300 ease-out",
              isSlashCommandsMode
                ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                : "grid-rows-[1fr] opacity-100"
            )}
          >
            <div className="overflow-hidden min-h-0">
              <Command.List className="max-h-[360px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  {t(locale, "noResults")}
                </Command.Empty>

                <Command.Group heading={t(locale, "navigation")}>
                  <Command.Item
                    value="home"
                    keywords={["home", "index", "main", "首页"]}
                    onSelect={() => handleNavigation("/")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{t(locale, "home")}</span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      H
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="projects"
                    keywords={[
                      "projects",
                      "career",
                      "work",
                      "job",
                      "experience",
                      "项目",
                      "职业",
                      "工作",
                    ]}
                    onSelect={() => handleNavigation("/projects")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{t(locale, "projects")}</span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      E
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="prose"
                    keywords={[
                      "prose",
                      "blog",
                      "posts",
                      "writing",
                      "articles",
                      "博客",
                      "文章",
                    ]}
                    onSelect={() => handleNavigation("/prose")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{t(locale, "prose")}</span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      B
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="productions"
                    keywords={[
                      "productions",
                      "talks",
                      "presentations",
                      "speaking",
                      "演讲",
                      "分享",
                    ]}
                    onSelect={() => handleNavigation("/productions")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{t(locale, "productions")}</span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      T
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="log"
                    keywords={[
                      "log",
                      "history",
                      "timeline",
                      "commits",
                      "git",
                      "career",
                      "日志",
                      "历史",
                      "时间线",
                      "提交",
                    ]}
                    onSelect={() => handleNavigation("/log")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <GitCommit className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{t(locale, "log")}</span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      O
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="prompt"
                    keywords={[
                      "prompt",
                      "prompts",
                      "ai",
                      "system",
                      "instructions",
                      "提示词",
                      "AI",
                      "系统",
                    ]}
                    onSelect={() => handleNavigation("/prompt")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{t(locale, "prompt")}</span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      P
                    </kbd>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading={t(locale, "settings")}>
                  <Command.Item
                    value="theme"
                    keywords={[
                      "theme",
                      "dark",
                      "light",
                      "mode",
                      "主题",
                      "深色",
                      "浅色",
                    ]}
                    onSelect={() => {
                      const nextPreference =
                        preference === "system"
                          ? "dark"
                          : preference === "dark"
                          ? "light"
                          : "system";
                      setThemePreference(nextPreference);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    {preference === "system" ? (
                      <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : theme === "light" ? (
                      <Sun className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Moon className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1">
                      {t(locale, "appearance")}:{" "}
                      {preference === "system"
                        ? t(locale, "themeSystem")
                        : theme === "light"
                        ? t(locale, "themeLight")
                        : t(locale, "themeDark")}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      A
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="language"
                    keywords={[
                      "language",
                      "english",
                      "chinese",
                      "语言",
                      "中文",
                      "英文",
                    ]}
                    onSelect={() => setLocale(locale === "en" ? "zh" : "en")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      {t(locale, "languageLabel")}: {localeNames[locale]}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      L
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="location"
                    keywords={[
                      "location",
                      "geolocation",
                      "geo",
                      "ip",
                      "accurate",
                      "定位",
                      "位置",
                      "精确",
                    ]}
                    onSelect={async () => {
                      if (locationMode === "ip") {
                        await requestAccurateLocation();
                      } else {
                        setLocationMode("ip");
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      {t(locale, "settingsGeolocation")}:{" "}
                      {locationMode === "accurate"
                        ? t(locale, "locationAccurate")
                        : t(locale, "locationIp")}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      G
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="weather-gradient"
                    keywords={[
                      "weather",
                      "gradient",
                      "background",
                      "mood",
                      "天气",
                      "渐变",
                      "背景",
                    ]}
                    onSelect={() =>
                      setRouteGradientPreference(
                        currentPattern,
                        !isCurrentRouteGradientEnabled
                      )
                    }
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Waves className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      {t(locale, "settingsWeatherGradient")}{" "}
                      <span className="font-mono">({currentPattern})</span>:{" "}
                      {isCurrentRouteGradientEnabled
                        ? t(locale, "stateOn")
                        : t(locale, "stateOff")}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      W
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="debug-panel"
                    keywords={[
                      "debug",
                      "debug panel",
                      "developer",
                      "devtools",
                      "test gradients",
                      "调试",
                      "调试面板",
                    ]}
                    onSelect={() => setDevtoolEnabled(!isDevtoolEnabled)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Bug className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      {t(locale, "settingsDebugPanel")}:{" "}
                      {isDevtoolEnabled
                        ? t(locale, "stateOn")
                        : t(locale, "stateOff")}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      D
                    </kbd>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading={t(locale, "prose")}>
                  {blogPosts.map((post) => (
                    <Command.Item
                      key={`blog-${post.slug}`}
                      value={`blog-${post.slug}`}
                      keywords={[
                        post.title,
                        post.titleZh || "",
                        post.description,
                        post.descriptionZh || "",
                        ...(post.tags || []),
                        "prose",
                        "blog",
                        "post",
                        "article",
                        "文章",
                      ].filter(Boolean)}
                      onSelect={() => handleNavigation(`/prose/${post.slug}`)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                        "text-sm cursor-pointer transition-colors",
                        "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                        "hover:bg-accent/25"
                      )}
                    >
                      <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">
                          {getLocalizedTitle(post, locale)}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {getLocalizedDescription(post, locale)}
                        </div>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading={t(locale, "productions")}>
                  {talks.map((talk) => (
                    <Command.Item
                      key={`talk-${talk.id}`}
                      value={`talk-${talk.id}`}
                      keywords={[
                        talk.title,
                        talk.titleZh || "",
                        talk.event,
                        talk.description || "",
                        talk.descriptionZh || "",
                        "productions",
                        "talk",
                        "presentation",
                        "演讲",
                      ].filter(Boolean)}
                      onSelect={() => handleNavigation("/productions")}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                        "text-sm cursor-pointer transition-colors",
                        "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                        "hover:bg-accent/25"
                      )}
                    >
                      <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate">
                          {locale === "zh" && talk.titleZh
                            ? talk.titleZh
                            : talk.title}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {talk.event}
                        </div>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </div>
          </div>

          <div
            className={cn(
              "grid transition-all duration-300 ease-out",
              isSlashCommandsMode
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            )}
          >
            <div className="overflow-hidden min-h-0">
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t(locale, "navigation")}
                </div>
                {actions
                  .filter(
                    (action) => action.section === "navigation" && action.label
                  )
                  .map((action) => (
                    <ActionItem
                      key={action.key}
                      letter={action.key.toUpperCase()}
                      label={action.label!}
                      icon={action.icon}
                      onClick={action.onSelect}
                    />
                  ))}
                <div className="px-3 py-2 mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t(locale, "settings")}
                </div>
                {actions
                  .filter(
                    (action) => action.section === "settings" && action.label
                  )
                  .map((action) => (
                    <ActionItem
                      key={action.key}
                      letter={action.key.toUpperCase()}
                      label={action.label!}
                      icon={action.icon}
                      onClick={action.onSelect}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 text-xs text-muted-foreground">
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: isSlashCommandsMode ? "0fr" : "1fr" }}
          >
            <div className="overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-2 transition-opacity duration-300 ease-out"
                style={{ opacity: isSlashCommandsMode ? 0 : 1 }}
              >
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 font-sans">
                    <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                      ↑↓
                    </kbd>
                    {t(locale, "navigate")}
                  </span>
                  <span className="flex items-center gap-1 font-sans">
                    <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                      ↵
                    </kbd>
                    {t(locale, "select")}
                  </span>
                  <span className="flex items-center gap-1 font-sans">
                    <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                      /
                    </kbd>
                    {t(locale, "actions")}
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                    ⌘
                  </kbd>
                  <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                    K
                  </kbd>
                </div>
              </div>
            </div>
          </div>
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: isSlashCommandsMode ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-2 transition-opacity duration-300 ease-out"
                style={{ opacity: isSlashCommandsMode ? 1 : 0 }}
              >
                <span className="flex items-center gap-1 font-sans">
                  <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                    ⌫
                  </kbd>
                  {t(locale, "backToSearch")}
                </span>
                <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                  /
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </Command>
    </div>
  );
}

function ActionItem({
  letter,
  label,
  icon,
  onClick,
}: {
  letter: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
        "text-sm cursor-pointer transition-colors",
        "text-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <kbd className="px-2 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
        {letter}
      </kbd>
    </button>
  );
}
