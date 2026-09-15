"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { SURFACE_TRANSITION_MS, SurfaceSheet } from "@/systems/surface";
import { Command } from "cmdk";
import { ChevronLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CommandShellProvider,
  useCommandActions,
  useSlashShortcuts,
  type CommandAction,
  type CommandShell,
} from "./actions";
import { LoadBundlePanel } from "./load-bundle-panel";
import { useCommand } from "./provider";
import { CommandResults, CommandSlashList, GROUP_HEADINGS } from "./results";

// =============================================================================
// CommandSheet — the palette as a phone sheet.
//
// The same sheet the wallpaper picker and the playlist are, with the search
// field where their title bar is. It opens at seven tenths of the screen and
// a drag (or a tap into the field) carries it to the top — the iOS medium and
// large detents, the way Maps' sheet grows when its search field is tapped.
//
// A launcher is not a secondary surface, so this one is modal: the page stops
// answering while it is up, and a tap on the page dismisses it, as a click on
// the page dismisses the desktop popover.
//
// Leaving after a command:
//
//   navigate / toggle   the sheet closes.
//   surface             the sheet stays and steps back while the surface it
//                       opened (the wallpaper picker) rises over it — the
//                       shared stack does that — and once the picker has
//                       landed, the sheet goes. Closing the picker then
//                       returns to the page, not to the palette: a launcher
//                       is finished the moment it has launched something.
//
// Slash mode on a phone is a list of rows with a back arrow, reached by typing
// "/" into the empty field. The field gives up the keyboard as the list comes
// in; a hardware keyboard still gets the letters.
// =============================================================================

/** iOS's medium and large detents, near enough. Opens at the first. */
const SNAP_POINTS = [0.7, 1];
const SNAP_TOP = SNAP_POINTS[SNAP_POINTS.length - 1];

const HEADER_BUTTON =
  "shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground active:scale-[0.92] active:bg-accent/60";

export function CommandSheet() {
  const {
    isOpen,
    isSlashCommandsMode,
    isLoadBundleMode,
    close,
    setSlashCommandsMode,
    setLoadBundleMode,
  } = useCommand();
  const { locale } = useLocale();
  const actions = useCommandActions();

  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);
  const [handingOff, setHandingOff] = useState(false);

  // A fresh sheet each time: empty field, lower detent, nothing in flight.
  useEffect(() => {
    if (isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close
    setInputValue("");
    setSnap(SNAP_POINTS[0]);
    setHandingOff(false);
  }, [isOpen]);

  // The hand-off: the surface this sheet opened takes one transition to
  // arrive; the sheet recedes behind it for that long, then goes.
  useEffect(() => {
    if (!handingOff) return;
    const timer = setTimeout(close, SURFACE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [handingOff, close]);

  // The slash list has no field, so the keyboard goes with it.
  useEffect(() => {
    if (isSlashCommandsMode || isLoadBundleMode) inputRef.current?.blur();
  }, [isSlashCommandsMode, isLoadBundleMode]);

  const shell = useMemo<CommandShell>(
    () => ({
      shape: "sheet",
      leave: (kind) => {
        if (kind === "surface") {
          // The keyboard goes down as the surface comes up.
          inputRef.current?.blur();
          setHandingOff(true);
        } else {
          close();
        }
      },
    }),
    [close]
  );

  const handleInputChange = (value: string) => {
    if (value === "/" && inputValue === "") {
      setSlashCommandsMode(true);
      setInputValue("");
    } else {
      setInputValue(value);
    }
  };

  return (
    <CommandShellProvider value={shell}>
      <SheetShortcuts
        actions={actions}
        enabled={isOpen && isSlashCommandsMode && !isLoadBundleMode}
      />
      <SurfaceSheet
        id="command"
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        modal
        snapPoints={SNAP_POINTS}
        activeSnapPoint={snap}
        onActiveSnapPointChange={(point) => {
          setSnap(point);
          // Dragged back down from the top: the keyboard goes too, as Maps'
          // does, so the lower detent is not half hidden behind it.
          if (point !== SNAP_TOP) inputRef.current?.blur();
        }}
        label={t(locale, "commandPalette")}
        className="system-chrome"
      >
        <Command
          loop
          shouldFilter={!isSlashCommandsMode && !isLoadBundleMode}
          className={cn("flex min-h-0 flex-1 flex-col outline-none", GROUP_HEADINGS)}
        >
          {/* Header — the search field, or the slash list's title with its
              way back. The load-bundle panel brings its own. */}
          {!isLoadBundleMode && (
            <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 pb-1 pt-1">
              {isSlashCommandsMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setSlashCommandsMode(false)}
                    aria-label={t(locale, "backToSearch")}
                    className={cn(HEADER_BUTTON, "-ml-2")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="flex-1 py-2 font-sans text-sm font-medium text-muted-foreground">
                    {t(locale, "slashCommands")}
                  </span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Command.Input
                    ref={inputRef}
                    value={inputValue}
                    onValueChange={handleInputChange}
                    // Tapping the field is asking for room: the sheet climbs
                    // to the top as the keyboard comes up.
                    onFocus={() => setSnap(SNAP_TOP)}
                    placeholder={t(locale, "searchPlaceholder")}
                    enterKeyHint="go"
                    className={cn(
                      // 16px: below that iOS Safari zooms the page on focus.
                      "min-w-0 flex-1 bg-transparent py-3 font-sans text-[16px] outline-none",
                      "placeholder:text-tertiary-foreground"
                    )}
                  />
                </>
              )}
              <button
                type="button"
                onClick={close}
                aria-label={t(locale, "commandClose")}
                className={cn(HEADER_BUTTON, "-mr-2")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {isLoadBundleMode ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <LoadBundlePanel
                onBack={() => setLoadBundleMode(false)}
                onLoaded={close}
              />
            </div>
          ) : isSlashCommandsMode ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <CommandSlashList actions={actions} />
            </div>
          ) : (
            <CommandResults
              actions={actions}
              className="min-h-0 flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)]"
            />
          )}
        </Command>
      </SurfaceSheet>
    </CommandShellProvider>
  );
}

/** Hook holder: the letter shortcuts need the shell context above them. */
function SheetShortcuts({
  actions,
  enabled,
}: {
  actions: CommandAction[];
  enabled: boolean;
}) {
  useSlashShortcuts(actions, enabled);
  return null;
}
