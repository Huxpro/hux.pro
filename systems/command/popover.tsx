"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useDevtool } from "@/systems/devtool";
import { useDraggable } from "@/systems/draggable";
import { Command } from "cmdk";
import { motion } from "framer-motion";
import { Search, Slash } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { CommandResults, CommandSlashList, GROUP_HEADINGS } from "./results";

// =============================================================================
// CommandPopover — the palette as a floating card, Spotlight-style.
//
// The shell for anything wider than a phone: a centred card a fifth of the
// way down, draggable through the shared hook, closed by a click on the page.
// Its three modes (search, slash, load-bundle) morph inside one card — width,
// header and footer each animate rather than swapping.
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
  const { isSlashCommandsMode, isLoadBundleMode, close, setLoadBundleMode } =
    useCommand();
  const { locale } = useLocale();
  const actions = useCommandActions();
  const field = useCommandField();

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

  // Focus the field on open and on the way back from slash mode — not on a
  // phone, where the keyboard would jump the layout.
  useEffect(() => {
    if (isSlashCommandsMode || isPhoneSafari) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isSlashCommandsMode, isPhoneSafari]);

  return (
      <div
        className={cn(
          // Above the theater/PiP surfaces (z-[10000]+) — the command palette is
          // the primary nav and must always sit on top.
          "system-chrome z-[10050] flex items-start justify-center pt-[20vh]",
          isPhoneSafari ? "absolute inset-x-0" : "fixed inset-0"
        )}
        style={
          isPhoneSafari ? { top: scrollPosition, height: "100dvh" } : undefined
        }
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
          style={isDraggable ? motionStyle : undefined}
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
          className="w-full flex justify-center"
        >
          <Command
            className={cn(
              "relative mx-4 transition-all duration-300 ease-out",
              "bg-glass-popover backdrop-blur-xl",
              "rounded-2xl border border-black/10 dark:border-white/10",
              "shadow-overlay",
              "outline-none",
              "animate-in fade-in-0 zoom-in-95 duration-200",
              isLoadBundleMode
                ? "w-full max-w-[440px]"
                : isSlashCommandsMode
                ? "w-full max-w-[400px]"
                : "w-full max-w-[700px]",
              GROUP_HEADINGS
            )}
            loop
            shouldFilter={!isSlashCommandsMode && !isLoadBundleMode}
          >
            <SlashShortcuts actions={actions} />
            {/* Search / slash header — collapsed in load-bundle mode (panel owns chrome). */}
            <div
              className={cn(
                "border-b border-border/50",
                isLoadBundleMode && "hidden"
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
                        className={cn(
                          "w-full py-4 bg-transparent font-sans text-[16px] sm:text-sm",
                          "placeholder:text-tertiary-foreground",
                          "outline-none",
                          isDraggable && "cursor-default focus:cursor-text"
                        )}
                      />
                    </div>
                    {showHints && (
                      <kbd className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded">
                        esc
                      </kbd>
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
            </div>

            <div className="relative">
              {/* Load-bundle form — System UI panel inside the same glass shell */}
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

              <div
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  isSlashCommandsMode || isLoadBundleMode
                    ? "grid-rows-[0fr] opacity-0 pointer-events-none"
                    : "grid-rows-[1fr] opacity-100"
                )}
              >
                <div className="overflow-hidden min-h-0">
                  <CommandResults actions={actions} className="max-h-[360px]" />
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
                  <CommandSlashList actions={actions} />
                </div>
              </div>
            </div>

            {/* Footer — keyboard hints, so only where there is a keyboard;
                the load-bundle row keeps its note either way. */}
            {(showHints || isLoadBundleMode) && (
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
