"use client";

import { useCommandPalette, useLocale, useTheme } from "@/components/providers";
import { getLocalizedDescription, getLocalizedTitle } from "@/lib/content";
import { blogPosts, talks } from "@/lib/data";
import { localeNames, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Command } from "cmdk";
import {
  Briefcase,
  FileText,
  Hash,
  Home,
  Languages,
  Mic,
  Moon,
  Search,
  Slash,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function CommandPalette() {
  const { isOpen, isActionMode, close, setActionMode } = useCommandPalette();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isIOS, setIsIOS] = useState(false);

  // Detect iOS devices (iPhone/iPod only, excluding iPad)
  useEffect(() => {
    const checkIsIOS = () => {
      if (typeof window === "undefined") return false;
      return /iPhone|iPod/.test(navigator.userAgent);
    };
    setIsIOS(checkIsIOS());
  }, []);

  // Lock scroll and set position when opened (ONLY for iOS devices)
  useEffect(() => {
    if (!isIOS) return;

    if (isOpen) {
      setScrollPosition(window.scrollY);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, isIOS]);

  // Focus input when opened or when switching to search mode
  useEffect(() => {
    if (isOpen && !isActionMode) {
      // Skip autofocus on iOS to prevent keyboard from popping up immediately
      if (isIOS) return;

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    if (!isOpen) {
      setInputValue("");
    }
  }, [isOpen, isActionMode, isIOS]);

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
      close();
    },
    [router, close]
  );

  // Define actions configuration
  // This centralizes both the rendering and the keyboard shortcuts
  type Action = {
    key: string;
    label?: string;
    icon?: React.ReactNode;
    onSelect: () => void;
    section?: "navigation" | "settings";
  };

  const actions: Action[] = [
    // Navigation
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
    // Hidden Actions
    {
      key: "d",
      // Hidden action: /docs
      // This is not rendered in the list but accessible via shortcut
      onSelect: () => handleNavigation("/docs"),
    },
    // Settings
    {
      key: "a",
      label: `${t(locale, "appearance")}: ${
        theme === "light" ? t(locale, "themeDark") : t(locale, "themeLight")
      }`,
      icon:
        theme === "light" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        ),
      onSelect: () => {
        toggleTheme();
        close();
      },
      section: "settings",
    },
    {
      key: "l",
      label: `${t(locale, "languageLabel")}: ${
        localeNames[locale === "en" ? "zh" : "en"]
      }`,
      icon: <Languages className="h-4 w-4" />,
      onSelect: () => {
        setLocale(locale === "en" ? "zh" : "en");
        close();
      },
      section: "settings",
    },
  ];

  // Handle action mode key presses
  useEffect(() => {
    if (!isOpen || !isActionMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Backspace exits action mode
      if (e.key === "Backspace") {
        e.preventDefault();
        setActionMode(false);
        return;
      }

      // Single letter shortcuts in action mode
      const key = e.key.toLowerCase();
      const action = actions.find((a) => a.key === key);

      if (action) {
        e.preventDefault();
        action.onSelect();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isActionMode, actions, setActionMode]);

  // Handle keyboard shortcuts in search mode
  useEffect(() => {
    // Only allow ESC in search mode
    // Single letter shortcuts are disabled in search mode to prevent conflict with typing
    if (!isOpen || isActionMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is actively typing in the command input
      const target = e.target as HTMLElement;
      const isCommandInput =
        target === inputRef.current ||
        (target.tagName === "INPUT" && target.closest("[cmdk-root]") !== null);

      if (isCommandInput && inputValue.length > 0) {
        return; // User is typing, let them continue
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isActionMode, inputValue]);

  // Handle "/" key in search mode to enter action mode
  const handleInputChange = (value: string) => {
    if (value === "/" && inputValue === "") {
      setActionMode(true);
      setInputValue("");
    } else {
      setInputValue(value);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "z-50 flex items-start justify-center pt-[20vh]",
        isIOS ? "absolute inset-x-0" : "fixed inset-0"
      )}
      style={isIOS ? { top: scrollPosition, height: "100dvh" } : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-transparent"
        onClick={!isIOS ? close : undefined}
        onPointerDown={isIOS ? close : undefined}
      />

      {/* Modal container - morphs between modes */}
      <Command
        className={cn(
          "relative mx-4 transition-all duration-300 ease-out",
          "bg-popover/75 backdrop-blur-xl",
          "rounded-2xl border border-black/10 dark:border-white/10",
          "shadow-2xl shadow-black/30",
          "outline-none",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          // Width morphs between action (400px) and search (700px) mode
          isActionMode ? "w-full max-w-[400px]" : "w-full max-w-[700px]",
          // Group heading styles
          "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
        )}
        loop
        shouldFilter={!isActionMode}
      >
        {/* Header - morphs between search input and action header */}
        <div className="border-b border-border/50">
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: isActionMode ? "0fr" : "1fr" }}
          >
            <div className="overflow-hidden">
              {/* Search header */}
              <div
                className={cn(
                  "flex items-center gap-3 px-4 transition-opacity duration-300 ease-out",
                  isActionMode ? "opacity-0" : "opacity-100"
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
                      "w-full py-4 bg-transparent font-mono text-[16px] sm:text-sm",
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
            style={{ gridTemplateRows: isActionMode ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              {/* Action header */}
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-opacity duration-300 ease-out",
                  isActionMode ? "opacity-100" : "opacity-0"
                )}
              >
                <Slash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 font-mono text-xs text-muted-foreground">
                  {t(locale, "actionMode")}
                </span>
                <kbd className="px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded">
                  esc
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Content area - crossfades between modes */}
        <div className="relative">
          {/* Search content */}
          <div
            className={cn(
              "grid transition-all duration-300 ease-out",
              isActionMode
                ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                : "grid-rows-[1fr] opacity-100"
            )}
          >
            <div className="overflow-hidden min-h-0">
              <Command.List className="max-h-[360px] overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  {t(locale, "noResults")}
                </Command.Empty>

                {/* Navigation */}
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
                </Command.Group>

                {/* Settings */}
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
                    onSelect={() => toggleTheme()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    {theme === "light" ? (
                      <Moon className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Sun className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1">
                      {t(locale, "appearance")}:{" "}
                      {theme === "light"
                        ? t(locale, "themeDark")
                        : t(locale, "themeLight")}
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
                      {t(locale, "languageLabel")}:{" "}
                      {localeNames[locale === "en" ? "zh" : "en"]}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      L
                    </kbd>
                  </Command.Item>
                </Command.Group>

                {/* Blog Posts */}
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

                {/* Talks */}
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

          {/* Action content */}
          <div
            className={cn(
              "grid transition-all duration-300 ease-out",
              isActionMode
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0 pointer-events-none"
            )}
          >
            <div className="overflow-hidden min-h-0">
              <div className="p-2">
                {/* Navigation */}
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

                {/* Settings */}
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

        {/* Footer - morphs between modes */}
        <div className="border-t border-border/50 text-xs text-muted-foreground">
          {/* Search footer */}
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: isActionMode ? "0fr" : "1fr" }}
          >
            <div className="overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-2 transition-opacity duration-300 ease-out"
                style={{ opacity: isActionMode ? 0 : 1 }}
              >
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 font-mono">
                    <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                      ↑↓
                    </kbd>
                    {t(locale, "navigate")}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                      ↵
                    </kbd>
                    {t(locale, "select")}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
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

          {/* Action footer */}
          <div
            className="grid transition-all duration-300 ease-out"
            style={{ gridTemplateRows: isActionMode ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-2 transition-opacity duration-300 ease-out"
                style={{ opacity: isActionMode ? 1 : 0 }}
              >
                <span className="flex items-center gap-1 font-mono">
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

// Action item component for action mode
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
