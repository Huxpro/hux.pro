"use client";

import { useCommandPalette, useLocale, useTheme } from "@/components/providers";
import { getLocalizedDescription, getLocalizedTitle } from "@/lib/content";
import { blogPosts, talks } from "@/lib/data";
import { t } from "@/lib/i18n";
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

  // Focus input when opened or when switching to search mode
  useEffect(() => {
    if (isOpen && !isActionMode) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
    if (!isOpen) {
      setInputValue("");
    }
  }, [isOpen, isActionMode]);

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
      close();
    },
    [router, close]
  );

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
      switch (key) {
        case "h":
          e.preventDefault();
          handleNavigation("/");
          break;
        case "e":
          e.preventDefault();
          handleNavigation("/career");
          break;
        case "b":
          e.preventDefault();
          handleNavigation("/blog");
          break;
        case "t":
          e.preventDefault();
          handleNavigation("/talks");
          break;
        case "d":
          e.preventDefault();
          toggleTheme();
          break;
        case "l":
          e.preventDefault();
          setLocale(locale === "en" ? "zh" : "en");
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isActionMode,
    handleNavigation,
    toggleTheme,
    setLocale,
    locale,
    setActionMode,
  ]);

  // Handle keyboard shortcuts in search mode
  useEffect(() => {
    if (!isOpen || isActionMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is actively typing in the command input
      const target = e.target as HTMLElement;
      const isCommandInput =
        target === inputRef.current ||
        (target.tagName === "INPUT" && target.closest("[cmdk-root]") !== null);

      // Only trigger shortcuts if:
      // 1. Command input is not focused, OR
      // 2. Command input is focused but empty (allows quick shortcuts)
      if (isCommandInput && inputValue.length > 0) {
        return; // User is typing, let them continue
      }

      // Single letter shortcuts in search mode
      const key = e.key.toLowerCase();
      // Only trigger for single letter keys (not modifiers or special keys)
      if (key.length === 1 && /[a-z]/.test(key)) {
        switch (key) {
          case "h":
            e.preventDefault();
            handleNavigation("/");
            break;
          case "e":
            e.preventDefault();
            handleNavigation("/career");
            break;
          case "b":
            e.preventDefault();
            handleNavigation("/blog");
            break;
          case "t":
            e.preventDefault();
            handleNavigation("/talks");
            break;
          case "d":
            e.preventDefault();
            toggleTheme();
            break;
          case "l":
            e.preventDefault();
            setLocale(locale === "en" ? "zh" : "en");
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    isActionMode,
    inputValue,
    handleNavigation,
    toggleTheme,
    setLocale,
    locale,
  ]);

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={close}
      />

      {/* Modal container - morphs between modes */}
      <div
        className={cn(
          "relative mx-4 transition-all duration-300 ease-out",
          "bg-popover/95 backdrop-blur-xl",
          "rounded-2xl border border-border/50",
          "shadow-2xl shadow-black/20",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          // Width morphs between action (400px) and search (600px) mode
          isActionMode ? "w-full max-w-[400px]" : "w-full max-w-[600px]"
        )}
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
                <Command className="flex-1" loop shouldFilter={!isActionMode}>
                  <Command.Input
                    ref={inputRef}
                    value={inputValue}
                    onValueChange={handleInputChange}
                    placeholder={t(locale, "searchPlaceholder")}
                    className={cn(
                      "w-full py-4 bg-transparent font-mono text-sm",
                      "placeholder:text-muted-foreground/60",
                      "outline-none"
                    )}
                  />
                </Command>
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
                <span className="flex-1 font-mono text-sm text-muted-foreground">
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
              <Command
                className={cn(
                  "**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wider"
                )}
                loop
                value={inputValue}
              >
                <Command.List className="max-h-[300px] overflow-y-auto p-2">
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
                        "text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                        "hover:bg-accent/50"
                      )}
                    >
                      <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1">{t(locale, "home")}</span>
                      <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                        H
                      </kbd>
                    </Command.Item>

                    <Command.Item
                      value="career"
                      keywords={[
                        "career",
                        "work",
                        "job",
                        "experience",
                        "职业",
                        "工作",
                      ]}
                      onSelect={() => handleNavigation("/career")}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                        "text-sm cursor-pointer transition-colors",
                        "text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                        "hover:bg-accent/50"
                      )}
                    >
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1">{t(locale, "career")}</span>
                      <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                        E
                      </kbd>
                    </Command.Item>

                    <Command.Item
                      value="blog"
                      keywords={[
                        "blog",
                        "posts",
                        "writing",
                        "articles",
                        "博客",
                        "文章",
                      ]}
                      onSelect={() => handleNavigation("/blog")}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                        "text-sm cursor-pointer transition-colors",
                        "text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                        "hover:bg-accent/50"
                      )}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1">{t(locale, "blog")}</span>
                      <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                        B
                      </kbd>
                    </Command.Item>

                    <Command.Item
                      value="talks"
                      keywords={[
                        "talks",
                        "presentations",
                        "speaking",
                        "演讲",
                        "分享",
                      ]}
                      onSelect={() => handleNavigation("/talks")}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                        "text-sm cursor-pointer transition-colors",
                        "text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                        "hover:bg-accent/50"
                      )}
                    >
                      <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1">{t(locale, "talks")}</span>
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
                        "text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                        "hover:bg-accent/50"
                      )}
                    >
                      {theme === "light" ? (
                        <Moon className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Sun className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="flex-1">
                        {theme === "light"
                          ? t(locale, "switchToDark")
                          : t(locale, "switchToLight")}
                      </span>
                      <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                        D
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
                        "text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                        "hover:bg-accent/50"
                      )}
                    >
                      <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1">
                        {locale === "en"
                          ? t(locale, "switchToZh")
                          : t(locale, "switchToEn")}
                      </span>
                      <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                        L
                      </kbd>
                    </Command.Item>
                  </Command.Group>

                  {/* Blog Posts */}
                  <Command.Group heading={t(locale, "blog")}>
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
                          "blog",
                          "post",
                          "article",
                          "文章",
                        ].filter(Boolean)}
                        onSelect={() => handleNavigation(`/blog/${post.slug}`)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                          "text-sm cursor-pointer transition-colors",
                          "text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                          "hover:bg-accent/50"
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
                  <Command.Group heading={t(locale, "talks")}>
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
                          "talk",
                          "presentation",
                          "演讲",
                        ].filter(Boolean)}
                        onSelect={() => handleNavigation("/talks")}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                          "text-sm cursor-pointer transition-colors",
                          "text-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
                          "hover:bg-accent/50"
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
              </Command>
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
                <ActionItem
                  letter="H"
                  label={t(locale, "home")}
                  icon={<Home className="h-4 w-4" />}
                  onClick={() => handleNavigation("/")}
                />
                <ActionItem
                  letter="E"
                  label={t(locale, "career")}
                  icon={<Briefcase className="h-4 w-4" />}
                  onClick={() => handleNavigation("/career")}
                />
                <ActionItem
                  letter="B"
                  label={t(locale, "blog")}
                  icon={<FileText className="h-4 w-4" />}
                  onClick={() => handleNavigation("/blog")}
                />
                <ActionItem
                  letter="T"
                  label={t(locale, "talks")}
                  icon={<Mic className="h-4 w-4" />}
                  onClick={() => handleNavigation("/talks")}
                />

                {/* Settings */}
                <div className="px-3 py-2 mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t(locale, "settings")}
                </div>
                <ActionItem
                  letter="D"
                  label={
                    theme === "light"
                      ? t(locale, "switchToDark")
                      : t(locale, "switchToLight")
                  }
                  icon={
                    theme === "light" ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )
                  }
                  onClick={toggleTheme}
                />
                <ActionItem
                  letter="L"
                  label={
                    locale === "en"
                      ? t(locale, "switchToZh")
                      : t(locale, "switchToEn")
                  }
                  icon={<Languages className="h-4 w-4" />}
                  onClick={() => setLocale(locale === "en" ? "zh" : "en")}
                />
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
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                      ↑↓
                    </kbd>
                    {t(locale, "navigate")}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                      ↵
                    </kbd>
                    {t(locale, "select")}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                      /
                    </kbd>
                    actions
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
                <span className="flex items-center gap-1">
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
      </div>
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
