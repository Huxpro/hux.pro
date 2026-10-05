"use client";

import { followHref } from "@/lib/follow-href";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useDevtool } from "@/systems/devtool";
import { useDraggable } from "@/systems/draggable";
import { AskChat } from "@/systems/ask";
import { askStrings } from "@/systems/ask/strings";
import { Command } from "cmdk";
import { motion } from "framer-motion";
import { Search, Slash } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CommandShellProvider,
  SlashShortcuts,
  useCommandActions,
  useCommandField,
  useShowKeyboardHints,
  type CommandShell,
} from "./actions";
import { LoadBundlePanel } from "./load-bundle-panel";
import { useCommand } from "./provider";
import { useCommandVoice, useSpaceToTalk, VoiceButton, VoiceGlow } from "./voice";
import {
  CommandResults,
  CommandSlashList,
  GROUP_HEADINGS,
  SlashEntry,
  usePaletteFilter,
  usePaletteSelection,
} from "./results";

// Adaptive geometry for the popover only. The phone sheet fills its detents
// with flex-1; this is the Spotlight card, whose list should grow with the
// viewport instead of sitting on a 360px cap.
// Offset: a little below Spotlight's 20vh, capped so it still sits in the
// upper third. Search list: 43dvh. On a 16" MacBook (~1040px chrome) that
// lands on Geolocation as the last full row. Slash list: no 43dvh cap, so
// the card grows for the full lettered list (the original morph) and only
// scrolls when it would hit the remaining viewport.
const PALETTE_GEOMETRY = {
  "--command-palette-offset": "min(22vh, 13.5rem)",
  "--command-palette-chrome":
    "calc(100dvh - var(--command-palette-offset) - 9rem - env(safe-area-inset-bottom, 0px))",
  "--command-palette-list-max":
    "min(40rem, 43dvh, var(--command-palette-chrome))",
  "--command-palette-slash-max":
    "min(40rem, var(--command-palette-chrome))",
  // Ask brings its own header and footer, so only the card's margins come
  // off what is left under the offset. As it opens, about the palette's own
  // height: the command card, turned into a chat.
  "--command-palette-ask-max":
    "min(36rem, calc(100dvh - var(--command-palette-offset) - 4rem - env(safe-area-inset-bottom, 0px)))",
} as CSSProperties;

// Ask with its history open: a chat app, which wants height more than a
// place in the upper third, so the card rises and grows to make room.
const PALETTE_ASK_APP_GEOMETRY = {
  "--command-palette-offset": "min(12vh, 7rem)",
  "--command-palette-ask-max":
    "min(44rem, calc(100dvh - var(--command-palette-offset) - 4rem - env(safe-area-inset-bottom, 0px)))",
} as CSSProperties;

const PALETTE_LIST_MAX =
  "max-h-[var(--command-palette-list-max)] overscroll-contain";

const PALETTE_SLASH_MAX =
  "max-h-[var(--command-palette-slash-max)] overflow-y-auto overscroll-contain";

// Ask: a conversation wants a fixed height to scroll within, not one that
// jumps with every line streamed in.
const PALETTE_ASK_HEIGHT = "h-[var(--command-palette-ask-max)]";

// =============================================================================
// CommandPopover: the palette as a floating card, Spotlight-style.
//
// The shell for anything wider than a phone: a centred card a fifth of the
// way down, draggable through the shared hook, closed by a click on the page.
// Its four modes (search, slash, load-bundle, Ask) morph inside one card:
// width, header and footer each animate rather than swapping.
//
// Ask opens as the search card turned into a chat: the same width and place,
// a little taller. Its sidebar button opens the past conversations beside
// the conversation (AskChat's rail), and the card grows to 960px and rises
// for them: a chat app. Escape goes back to search when search was the way
// in, and closes the palette when Ask was reached directly (⌘J, the Ask
// ball), which has no search behind it.
//
// It still works at phone widths (the devtool's Command module can ask for it
// there) and keeps its iOS Safari accommodations for that case: the page is
// pinned at its scroll position while the card is up, and the field is not
// focused on open so the keyboard does not jump the layout.
//
// The shell (CommandPopover) is always mounted; the card, with the command
// list, the field and the shortcuts, exists only while the palette is open.
// =============================================================================

export function CommandPopover() {
  const { isOpen, close } = useCommand();
  const { signalDragReset } = useDevtool();
  const drag = useDraggable("command-palette");

  // Reset drag position on reopen (when persist is off, the hook handles the logic)
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      signalDragReset("command-palette");
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, signalDragReset]);

  const shell = useMemo<CommandShell>(
    () => ({ leave: close }),
    [close]
  );

  return (
    <CommandShellProvider value={shell}>
      {isOpen && <PopoverCard drag={drag} />}
    </CommandShellProvider>
  );
}

/** The card and everything in it. Mounted only while the palette is open. */
function PopoverCard({ drag }: { drag: ReturnType<typeof useDraggable> }) {
  // Destructured up front: reading `drag.*` inside the JSX trips the
  // react-hooks/refs rule, since the same object also carries `contentRef`.
  const {
    isEnabled: isDraggable,
    contentRef,
    dragControls,
    motionStyle,
    onDragStart,
    onDragEnd,
    preventClickAfterDrag,
  } = drag;
  const {
    isSlashCommandsMode,
    isLoadBundleMode,
    isAskMode,
    askRequest,
    close,
    setLoadBundleMode,
    setAskMode,
    openAsk,
    askEntry,
  } = useCommand();
  // The history sidebar, for this opening of the palette: each one starts as
  // the command card.
  const [askRail, setAskRail] = useState(false);
  const { locale } = useLocale();
  const router = useTransitionRouter();
  const actions = useCommandActions();
  const field = useCommandField();
  const filter = usePaletteFilter(field.value);
  const selection = usePaletteSelection(field.value);
  const voice = useCommandVoice(field.onChange);
  const spaceToTalk = useSpaceToTalk(voice, field.value === "");

  const inputRef = useRef<HTMLInputElement>(null);
  const showHints = useShowKeyboardHints();
  // The phone, not the platform: iPad Safari is left alone. What follows
  // works around the phone's small viewport, where a focused field makes
  // Safari scroll and resize the page under a fixed card.
  const [isPhoneSafari] = useState(() =>
    /iPhone|iPod/.test(navigator.userAgent)
  );
  // Where the page was when the card came up; it is pinned there on a phone.
  const [scrollPosition] = useState(() => window.scrollY);

  useEffect(() => {
    if (!isPhoneSafari) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPhoneSafari]);

  // Focus the field on open and on the way back from slash mode, but not on a
  // phone, where the keyboard would jump the layout. The slash list has no
  // field, so on the way in the keyboard goes with it.
  // Ask brings its own field and focuses it.
  useEffect(() => {
    if (isSlashCommandsMode) {
      inputRef.current?.blur();
      return;
    }
    if (isPhoneSafari || isAskMode) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isSlashCommandsMode, isAskMode, isPhoneSafari]);

  return (
      <div
        className={cn(
          // Above the theater/PiP surfaces (z-[10000]+). The command palette is
          // the primary nav and must always sit on top.
          "system-chrome z-[10050] flex items-start justify-center overflow-y-auto",
          "pt-[var(--command-palette-offset)] pb-8",
          "transition-[padding-top] duration-300 ease-out",
          isPhoneSafari ? "absolute inset-x-0" : "fixed inset-0"
        )}
        style={{
          ...PALETTE_GEOMETRY,
          ...(isAskMode && askRail ? PALETTE_ASK_APP_GEOMETRY : {}),
          // The card's width in this mode; the card and its wrapper both read it.
          "--command-card-w": `${
            isLoadBundleMode ? 440 : isAskMode ? (askRail ? 960 : 700) : isSlashCommandsMode ? 400 : 700
          }px`,
          ...(isPhoneSafari
            ? { top: scrollPosition, height: "100dvh" }
            : {}),
        } as CSSProperties}
      >
        <div
          className="absolute inset-0 bg-transparent"
          onClick={!isPhoneSafari ? close : undefined}
          onPointerDown={isPhoneSafari ? close : undefined}
        />

        <motion.div
          ref={contentRef as React.RefObject<HTMLDivElement>}
          drag={isDraggable ? true : undefined}
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onPointerDown={
            isDraggable
              ? (e: React.PointerEvent) => {
                  const target = e.target as HTMLElement;
                  if (!target.closest("[data-drag-handle]")) return;
                  const isInput = target.closest("input, [cmdk-input]");
                  if (isInput && field.value.length > 0) return;
                  if (!isInput) {
                    // Non-input part of drag handle: drag immediately
                    dragControls.start(e);
                    return;
                  }
                  // Empty input: disambiguate tap (→ focus) vs drag (→ move)
                  e.preventDefault();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const threshold = 5;
                  const onMove = (moveE: PointerEvent) => {
                    if (
                      Math.abs(moveE.clientX - startX) +
                        Math.abs(moveE.clientY - startY) >
                      threshold
                    ) {
                      dragControls.start(moveE);
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
            isDraggable ? preventClickAfterDrag : undefined
          }
          // The card's own width (and its margins), not the page's: what is
          // dragged is kept on screen when let go, and a full-width wrapper
          // had no room to move sideways at all. Eased with the card's own
          // width as it changes mode.
          className="w-full flex justify-center transition-[max-width] duration-300 ease-out"
          style={{
            ...(isDraggable ? motionStyle : {}),
            maxWidth: "calc(var(--command-card-w) + 2rem)",
          }}
        >
          <Command
            className={cn(
              "relative mx-4 transition-all duration-300 ease-out",
              "bg-glass-popover backdrop-blur-xl",
              "rounded-2xl border border-black/10 dark:border-white/10",
              "shadow-overlay",
              "outline-none",
              "animate-in fade-in-0 zoom-in-95 duration-200",
              "w-full max-w-(--command-card-w)",
              // Clipped, so the history rail's wash keeps the corners.
              isAskMode && "overflow-hidden",
              GROUP_HEADINGS
            )}
            loop
            shouldFilter={!isSlashCommandsMode && !isLoadBundleMode}
            filter={filter}
            {...selection}
          >
            <SlashShortcuts actions={actions} />
            {/* Search / slash header, collapsed in load-bundle and Ask (each owns its chrome). */}
            <div
              className={cn(
                "relative border-b border-border/50",
                (isLoadBundleMode || isAskMode) && "hidden"
              )}
              data-drag-handle
              style={isDraggable ? { touchAction: "none" } : undefined}
            >
              <div
                className="grid transition-all duration-300 ease-out"
                style={{
                  gridTemplateRows: isSlashCommandsMode ? "0fr" : "1fr",
                }}
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
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder={t(locale, "searchPlaceholder")}
                        {...spaceToTalk}
                        onKeyDown={(e) => {
                          // Tab: ask what was typed (systems/ask).
                          if (e.key === "Tab" && !e.shiftKey && field.value.trim()) {
                            e.preventDefault();
                            openAsk(field.value, "search");
                            return;
                          }
                          spaceToTalk.onKeyDown(e);
                        }}
                        className={cn(
                          "w-full py-4 bg-transparent font-sans text-[16px] sm:text-sm",
                          "placeholder:text-tertiary-foreground",
                          "outline-none",
                          isDraggable && "cursor-default focus:cursor-text"
                        )}
                      />
                    </div>
                    <VoiceButton voice={voice} className="-mx-1" />
                    {/* One slot, two readings: a hint where there is a
                        keyboard, the way into slash mode where there is not. */}
                    {showHints ? (
                      <kbd className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded">
                        esc
                      </kbd>
                    ) : (
                      field.value === "" && <SlashEntry />
                    )}
                  </div>
                </div>
              </div>
              <div
                className="grid transition-all duration-300 ease-out"
                style={{
                  gridTemplateRows: isSlashCommandsMode ? "1fr" : "0fr",
                }}
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
                    {showHints && (
                      <kbd className="px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded">
                        esc
                      </kbd>
                    )}
                  </div>
                </div>
              </div>
              {/* Listening: the site's glow along the field's bottom edge. */}
              <VoiceGlow voice={voice} />
            </div>

            <div className="relative">
              {/* Load-bundle form: System UI panel inside the same glass shell */}
              <div
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  isLoadBundleMode
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0 pointer-events-none"
                )}
              >
                <div className="overflow-hidden min-h-0" data-drag-handle>
                  {isLoadBundleMode && (
                    <LoadBundlePanel
                      onBack={() => setLoadBundleMode(false)}
                      onLoaded={close}
                    />
                  )}
                </div>
              </div>

              {/* Ask: the conversation, in place of the results. The height
                  lives on the slot, not on the chat: the chat's module loads
                  the first time Ask opens, and the card has to jump to its
                  size before that arrives. A skeleton fills the slot until
                  the chat fades in over it. */}
              <div
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  isAskMode
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0 pointer-events-none"
                )}
              >
                <div
                  className={cn(
                    "flex min-h-0 flex-col overflow-hidden",
                    isAskMode && PALETTE_ASK_HEIGHT,
                    "transition-[height] duration-300 ease-out",
                  )}
                >
                  {isAskMode && (
                    <AskChat
                      request={askRequest}
                      onBack={askEntry === "command" ? () => setAskMode(false) : undefined}
                      onNavigate={(href) => {
                        followHref(href, (to) => router.push(to));
                        close();
                      }}
                      trailing={
                        showHints && (
                          <kbd className="mr-2 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded">
                            esc
                          </kbd>
                        )
                      }
                      railOpen={askRail}
                      onToggleRail={() => setAskRail((v) => !v)}
                      className="min-h-0 flex-1"
                    />
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  isSlashCommandsMode || isLoadBundleMode || isAskMode
                    ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                    : "grid-rows-[1fr] opacity-100"
                )}
              >
                <div className="overflow-hidden min-h-0">
                  <CommandResults actions={actions} className={PALETTE_LIST_MAX} />
                </div>
              </div>

              <div
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  isSlashCommandsMode && !isLoadBundleMode
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0 pointer-events-none"
                )}
              >
                <div className="overflow-hidden min-h-0">
                  <CommandSlashList
                    actions={actions}
                    className={PALETTE_SLASH_MAX}
                  />
                </div>
              </div>
            </div>

            {/* Footer: keyboard hints, so only where there is a keyboard;
                the load-bundle row keeps its note either way. */}
            {(showHints || isLoadBundleMode) && !isAskMode && (
            <div className="border-t border-border/50 text-xs text-muted-foreground">
              {showHints && (
              <div
                className="grid transition-all duration-300 ease-out"
                style={{
                  gridTemplateRows:
                    isSlashCommandsMode || isLoadBundleMode ? "0fr" : "1fr",
                }}
              >
                <div className="overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-2 transition-opacity duration-300 ease-out"
                    style={{
                      opacity: isSlashCommandsMode || isLoadBundleMode ? 0 : 1,
                    }}
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
                      <span className="flex items-center gap-1 font-sans">
                        <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                          ⌘J
                        </kbd>
                        {askStrings(locale).askRow}
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
              )}
              {showHints && (
              <div
                className="grid transition-all duration-300 ease-out"
                style={{
                  gridTemplateRows:
                    isSlashCommandsMode && !isLoadBundleMode ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-2 transition-opacity duration-300 ease-out"
                    style={{
                      opacity: isSlashCommandsMode && !isLoadBundleMode ? 1 : 0,
                    }}
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
              )}
              <div
                className="grid transition-all duration-300 ease-out"
                style={{ gridTemplateRows: isLoadBundleMode ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-2 transition-opacity duration-300 ease-out"
                    style={{ opacity: isLoadBundleMode ? 1 : 0 }}
                  >
                    <span className="flex items-center gap-1 font-sans">
                      {showHints && (
                        <kbd className="px-1.5 py-0.5 font-mono bg-muted/50 rounded">
                          esc
                        </kbd>
                      )}
                      {t(locale, "backToSearch")}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t(locale, "appsLoadBundleOverTheAir")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            )}
          </Command>
        </motion.div>
      </div>
  );
}
