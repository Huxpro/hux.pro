"use client";

import { getLocalizedDescription, getLocalizedTitle, getPostHref } from "@/lib/content";
import { blogPosts } from "@/lib/data";
import { cn } from "@/lib/utils";
import { localeNames, t, useInputCapability, useLocale, useTheme } from "@/services";
import { useLocation, useWeather } from "@/systems/ambient";
import { useDevtool } from "@/systems/devtool";
import { useMusic } from "@/systems/music";
import { Command } from "cmdk";
import {
  Bug,
  FileText,
  GitCommit,
  Hash,
  Home,
  Languages,
  MapPin,
  Monitor,
  Moon,
  Music,
  Search,
  Slash,
  Sparkles,
  Sun,
  Waves,
} from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDraggable } from "@/systems/draggable";
import { useCommand } from "./provider";

export function CommandPalette() {
  const drag = useDraggable("command-palette");
  const { primaryInput } = useInputCapability();
  const { isOpen, isSlashCommandsMode, close, setSlashCommandsMode } =
    useCommand();

  // Devtool repositioning is a pointer affordance; on touch the same drag
  // budget goes to the sheet-style dismiss gesture below.
  const repositionEnabled = drag.isEnabled && primaryInput === "mouse";
  const { theme, preference, setThemePreference } = useTheme();
  const { locale, setLocale } = useLocale();
  const { locationMode, setLocationMode, requestAccurateLocation } =
    useLocation();
  const { gradientMode, cycleGradientMode } = useWeather();
  const { isEnabled: isDevtoolEnabled, setEnabled: setDevtoolEnabled, signalDragReset } =
    useDevtool();
  const {
    playerState: musicPlayerState,
    play: musicPlay,
    pause: musicPause,
  } = useMusic();
  const router = useTransitionRouter();

  // Reset drag position on reopen (when persist is off, the hook handles the logic)
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      signalDragReset("command-palette");
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, signalDragReset]);

  const gradientModeLabel =
    gradientMode === "full"
      ? locale === "zh"
        ? "全屏"
        : "Full"
      : gradientMode === "widget"
      ? locale === "zh"
        ? "卡片"
        : "Widget"
      : t(locale, "stateOff");
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

  // ---------------------------------------------------------------------------
  // Touch dismiss — the palette behaves like a floating sheet: dragging
  // in either vertical direction anywhere on the takeover (except the
  // scrolling list) scrubs the summon animation in reverse. The finger's
  // travel maps proportionally onto opacity + scale + a damped drift that
  // follows the drag direction — the panel never docks to the screen edge
  // (no safe-area collision), it dissolves in place. Release past the
  // threshold (or a flick) commits; otherwise it springs back.
  // ---------------------------------------------------------------------------
  const SHEET_TRAVEL = 280;
  // Signed progress: + is a downward toss, - an upward one.
  const dismiss = useMotionValue(0);
  const dismissSpring = useSpring(dismiss, { stiffness: 420, damping: 36 });
  const sheetOpacity = useTransform(dismissSpring, (p) => 1 - 0.85 * Math.abs(p));
  const sheetScale = useTransform(dismissSpring, (p) => 1 - 0.06 * Math.abs(p));
  const sheetY = useTransform(dismissSpring, (p) => 64 * p);
  // The frosted scrim recedes with the toss — the whole takeover leaves
  // as one object, not a panel peeling off a static veil.
  const backdropOpacity = useTransform(dismissSpring, (p) => 1 - Math.abs(p));
  const sheetDrag = useRef<{
    id: number;
    startX: number;
    startY: number;
    active: boolean;
    lastY: number;
    lastT: number;
    vy: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      dismiss.jump(0);
      dismissSpring.jump(0);
    }
  }, [isOpen, dismiss, dismissSpring]);

  /**
   * Close while swallowing the tap's trailing synthetic click. When the
   * overlay unmounts between pointerup and click, the browser re-hit-tests
   * and the click lands on whatever sat under the backdrop — usually the
   * FAB, which would immediately reopen the palette.
   */
  const closeSwallowingGhostClick = useCallback(() => {
    const swallow = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    document.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => {
      document.removeEventListener("click", swallow, { capture: true });
    }, 500);
    close();
  }, [close]);

  const endSheetDrag = useCallback(
    (e: React.PointerEvent, commitAllowed: boolean) => {
      const s = sheetDrag.current;
      if (!s || e.pointerId !== s.id) return;
      sheetDrag.current = null;
      if (!s.active) {
        // Plain tap on the backdrop dismisses via pointerup — reliable on
        // touch regardless of Safari's click-synthesis heuristics.
        if (
          commitAllowed &&
          (e.target as HTMLElement).closest("[data-palette-backdrop]")
        ) {
          closeSwallowingGhostClick();
        }
        return;
      }
      const p = dismiss.get();
      const flick = Math.abs(s.vy) > 0.5;
      if (commitAllowed && (Math.abs(p) > 0.4 || flick)) {
        // Finish the reverse-summon in the toss's direction, then unmount.
        const direction = Math.sign(flick ? s.vy : p) || 1;
        animate(dismiss, direction, { duration: 0.16, ease: "easeOut" }).then(
          () => {
            close();
          }
        );
      } else {
        dismiss.set(0); // the spring carries it home
      }
    },
    [dismiss, close, closeSwallowingGhostClick]
  );

  const sheetHandlers =
    primaryInput === "touch"
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            if (!e.isPrimary || sheetDrag.current) return;
            // The results list owns vertical panning (touch-pan-y).
            if ((e.target as HTMLElement).closest("[cmdk-list]")) return;
            sheetDrag.current = {
              id: e.pointerId,
              startX: e.clientX,
              startY: e.clientY,
              active: false,
              lastY: e.clientY,
              lastT: e.timeStamp,
              vy: 0,
            };
          },
          onPointerMove: (e: React.PointerEvent) => {
            const s = sheetDrag.current;
            if (!s || e.pointerId !== s.id) return;
            const dy = e.clientY - s.startY;
            if (!s.active) {
              // Vertical intent, either direction; taps and horizontal
              // wobbles pass through.
              if (
                Math.abs(dy) < 10 ||
                Math.abs(e.clientX - s.startX) > Math.abs(dy)
              )
                return;
              s.active = true;
              // Capture from drag detection (not pointerdown) so plain
              // taps keep their natural targets — and captured drags
              // can't end in stray clicks/focus.
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Pointer already gone — the gesture still works.
              }
            }
            const dt = Math.max(1, e.timeStamp - s.lastT);
            s.vy = 0.8 * s.vy + 0.2 * ((e.clientY - s.lastY) / dt);
            s.lastY = e.clientY;
            s.lastT = e.timeStamp;
            dismiss.set(Math.min(1, Math.max(-1, dy / SHEET_TRAVEL)));
          },
          onPointerUp: (e: React.PointerEvent) => endSheetDrag(e, true),
          onPointerCancel: (e: React.PointerEvent) => endSheetDrag(e, false),
        }
      : undefined;

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
      key: "u",
      label: t(locale, "writingTitle"),
      icon: <FileText className="h-4 w-4" />,
      onSelect: () => handleNavigation("/writing"),
      section: "navigation",
    },
    {
      key: "x",
      label: t(locale, "worksTitle"),
      icon: <GitCommit className="h-4 w-4" />,
      onSelect: () => handleNavigation("/works"),
      section: "navigation",
    },
    {
      key: "p",
      label: t(locale, "promptsTitle"),
      icon: <Sparkles className="h-4 w-4" />,
      onSelect: () => handleNavigation("/prompt"),
      section: "navigation",
    },
    {
      key: "i",
      onSelect: () => handleNavigation("/docs"),
    },
    {
      key: "e",
      onSelect: () => handleNavigation("/editor"),
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
      label: `${t(locale, "settingsWeatherGradient")}: ${gradientModeLabel}`,
      icon: <Waves className="h-4 w-4" />,
      onSelect: () => {
        cycleGradientMode();
        close();
      },
      section: "settings",
    },
    {
      key: "m",
      label: `${t(locale, "settingsMusic")}: ${
        musicPlayerState === "playing"
          ? t(locale, "musicPause")
          : t(locale, "musicPlay")
      }`,
      icon: <Music className="h-4 w-4" />,
      onSelect: () => {
        if (musicPlayerState === "playing") {
          musicPause();
        } else {
          musicPlay();
        }
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
        case "u":
          handleNavigation("/writing");
          return;
        case "x":
          handleNavigation("/works");
          return;
        case "p":
          handleNavigation("/prompt");
          return;
        case "i":
          handleNavigation("/docs");
          return;
        case "e":
          handleNavigation("/editor");
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
          cycleGradientMode();
          close();
          return;
        case "m":
          if (musicPlayerState === "playing") {
            musicPause();
          } else {
            musicPlay();
          }
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
    gradientModeLabel,
    musicPlayerState,
    musicPlay,
    musicPause,
    isDevtoolEnabled,
    requestAccurateLocation,
    setLocationMode,
    cycleGradientMode,
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
      // The dismiss scrub listens on the whole takeover, so a downward
      // drag anywhere — backdrop or panel chrome — scrubs the palette
      // away. Capturing to this container (which has no click handler)
      // also means a captured drag can never end in a stray
      // backdrop-click dismissal.
      {...sheetHandlers}
    >
      {/* Backdrop is a gesture surface, not just a click-catcher:
          touch-none swallows native panning, so a swipe over it can't
          scroll the page behind the open palette (which would desync the
          iOS absolute-position anchor and read as broken elsewhere).
          On touch it's also a frosted scrim (the ruler takeover's visual
          language) that recedes as the dismiss gesture scrubs.
          On iOS it still dismisses at pointerdown, but only while the
          keyboard is up — that tap races the keyboard teardown's
          viewport shift, so we act before the storm; without the
          keyboard, iOS taps resolve through the gesture's pointerup
          (sidestepping Safari's click synthesis on plain divs). */}
      <motion.div
        data-palette-backdrop
        className={cn(
          "absolute inset-0 touch-none",
          primaryInput === "touch"
            ? "bg-background/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
            : "bg-transparent"
        )}
        style={primaryInput === "touch" ? { opacity: backdropOpacity } : undefined}
        onClick={!isIOS ? close : undefined}
        onPointerDown={
          isIOS
            ? () => {
                if (document.activeElement === inputRef.current) {
                  closeSwallowingGhostClick();
                }
              }
            : undefined
        }
      />

      <motion.div
        ref={drag.contentRef as React.RefObject<HTMLDivElement>}
        drag={repositionEnabled ? true : undefined}
        dragControls={drag.dragControls}
        dragListener={false}
        dragMomentum={false}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
        style={repositionEnabled ? drag.motionStyle : undefined}
        onPointerDown={
          repositionEnabled
            ? (e: React.PointerEvent) => {
                const target = e.target as HTMLElement;
                if (!target.closest("[data-drag-handle]")) return;
                const isInput = target.closest("input, [cmdk-input]");
                if (isInput && inputValue.length > 0) return;
                if (!isInput) {
                  // Non-input part of drag handle: drag immediately
                  drag.dragControls.start(e);
                  return;
                }
                // Empty input: disambiguate tap (→ focus) vs drag (→ move)
                e.preventDefault();
                const startX = e.clientX;
                const startY = e.clientY;
                const threshold = 5;
                const onMove = (moveE: PointerEvent) => {
                  if (
                    Math.abs(moveE.clientX - startX) + Math.abs(moveE.clientY - startY) >
                    threshold
                  ) {
                    drag.dragControls.start(moveE);
                    cleanup();
                  }
                };
                const onUp = () => {
                  inputRef.current?.focus();
                  cleanup();
                };
                const cleanup = () => {
                  document.removeEventListener("pointermove", onMove);
                  document.removeEventListener("pointerup", onUp);
                  document.removeEventListener("pointercancel", cleanup);
                };
                document.addEventListener("pointermove", onMove);
                document.addEventListener("pointerup", onUp);
                document.addEventListener("pointercancel", cleanup);
              }
            : undefined
        }
        onClickCapture={
          repositionEnabled ? drag.preventClickAfterDrag : undefined
        }
        className="w-full flex justify-center"
      >
      {/* Sheet layer — scrubbed by the touch dismiss gesture (attached on
          the takeover container above); identity on pointer devices.
          Nested so it composes with devtool reposition. */}
      <motion.div
        className="w-full flex justify-center"
        style={{ opacity: sheetOpacity, scale: sheetScale, y: sheetY }}
      >
      <Command
        className={cn(
          "relative mx-4 transition-all duration-300 ease-out",
          "bg-popover/75 backdrop-blur-xl",
          "rounded-2xl border border-black/10 dark:border-white/10",
          "shadow-overlay",
          "outline-none",
          // No double-tap-zoom interception — item taps commit instantly.
          "touch-manipulation",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          isSlashCommandsMode ? "w-full max-w-[400px]" : "w-full max-w-[700px]",
          "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
        )}
        loop
        shouldFilter={!isSlashCommandsMode}
      >
        {/* Non-scrolling chrome is touch-none so a swipe starting here
            can't chain-scroll the page behind; only the results list
            (touch-pan-y) pans. Also what hands the drag gesture to the
            handle when dragging is enabled. */}
        <div className="touch-none border-b border-border/50" data-drag-handle>
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
                      "outline-none",
                      repositionEnabled && "cursor-default focus:cursor-text",
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
              {/* pan-y: this list only ever scrolls vertically;
                  overscroll-contain: hitting its ends must not chain the
                  rubber-band into the page behind the palette. */}
              <Command.List className="max-h-[360px] touch-pan-y overflow-y-auto overscroll-contain p-2">
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
                    value="writing"
                    keywords={[
                      "writing",
                      "blog",
                      "posts",
                      "prose",
                      "articles",
                      "文字",
                      "写作",
                      "博客",
                      "文章",
                    ]}
                    onSelect={() => handleNavigation("/writing")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{t(locale, "writingTitle")}</span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      U
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="works"
                    keywords={[
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
                    ]}
                    onSelect={() => handleNavigation("/works")}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <GitCommit className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">{t(locale, "worksTitle")}</span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      X
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
                      "系统提示词",
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
                    <span className="flex-1">{t(locale, "promptsTitle")}</span>
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
                      "widget",
                      "mood",
                      "天气",
                      "渐变",
                      "背景",
                    ]}
                    onSelect={() => cycleGradientMode()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Waves className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      {t(locale, "settingsWeatherGradient")}: {gradientModeLabel}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      W
                    </kbd>
                  </Command.Item>
                  <Command.Item
                    value="music"
                    keywords={[
                      "music",
                      "spotify",
                      "now playing",
                      "song",
                      "track",
                      "音乐",
                      "歌曲",
                      "播放",
                    ]}
                    onSelect={() => {
                      if (musicPlayerState === "playing") {
                        musicPause();
                      } else {
                        musicPlay();
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "text-sm cursor-pointer transition-colors",
                      "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
                      "hover:bg-accent/25"
                    )}
                  >
                    <Music className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      {t(locale, "settingsMusic")}:{" "}
                      {musicPlayerState === "playing"
                        ? t(locale, "musicPause")
                        : t(locale, "musicPlay")}
                    </span>
                    <kbd className="px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted/50 rounded shrink-0">
                      M
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

                <Command.Group heading={t(locale, "writingTitle")}>
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
                      onSelect={() => handleNavigation(getPostHref(post, locale, "/writing"))}
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
              <div className="touch-none p-2">
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

        <div className="touch-none border-t border-border/50 text-xs text-muted-foreground">
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
      </motion.div>
      </motion.div>
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
