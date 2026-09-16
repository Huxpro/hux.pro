"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  HEADER_BUTTON,
  SURFACE_TRANSITION_MS,
  SurfaceSheet,
} from "@/systems/surface";
import { Command } from "cmdk";
import { ChevronLeft, Search, X } from "lucide-react";
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
import {
  CommandResults,
  CommandSlashList,
  GROUP_HEADINGS,
  SlashEntry,
} from "./results";

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
// Leaving after a command (see CommandKind): the sheet closes, except after a
// `surface` command, when it stays and steps back while the surface it opened
// rises over it — the shared stack does that — and once that surface has
// landed, the sheet goes. Closing the picker then returns to the page, not to
// the palette: a launcher is finished the moment it has launched something.
//
// Slash mode on a phone is a list of rows with a back arrow, reached by typing
// "/" into the empty field. The field gives up the keyboard as the list comes
// in; a hardware keyboard still gets the letters.
//
// The shell (this component) is always mounted so the sheet can animate out;
// everything that costs something — the command list, the field, the
// shortcuts — lives in SheetBody, which Base UI unmounts with the sheet.
// =============================================================================

/** iOS's medium and large detents, near enough. Opens at the first. */
const SNAP_POINTS = [0.7, 1];
const SNAP_TOP = SNAP_POINTS[SNAP_POINTS.length - 1];

export function CommandSheet() {
  const { isOpen, close } = useCommand();
  const { locale } = useLocale();

  const inputRef = useRef<HTMLInputElement>(null);
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);
  const [handingOff, setHandingOff] = useState(false);

  // A fresh sheet each time: lower detent, nothing in flight.
  useEffect(() => {
    if (isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close
    setSnap(SNAP_POINTS[0]);
    setHandingOff(false);
  }, [isOpen]);

  // The hand-off: the surface this sheet opened takes one transition to
  // arrive; the sheet recedes behind it for that long, then goes. A timer
  // rather than that surface's own "arrived" event, because the surface may
  // already have been open underneath, in which case nothing arrives at all.
  useEffect(() => {
    if (!handingOff) return;
    const timer = setTimeout(close, SURFACE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [handingOff, close]);

  const shell = useMemo<CommandShell>(
    () => ({
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

  return (
    <CommandShellProvider value={shell}>
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
        <SheetBody
          inputRef={inputRef}
          // Tapping the field is asking for room: the sheet climbs to the
          // top as the keyboard comes up.
          onFieldFocus={() => setSnap(SNAP_TOP)}
        />
      </SurfaceSheet>
    </CommandShellProvider>
  );
}

/** Everything inside the shell. Mounted only while the sheet is up. */
function SheetBody({
  inputRef,
  onFieldFocus,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFieldFocus: () => void;
}) {
  const { isSlashCommandsMode, isLoadBundleMode, close, setSlashCommandsMode, setLoadBundleMode } =
    useCommand();
  const { locale } = useLocale();
  const actions = useCommandActions();
  const field = useCommandField();
  const showHints = useShowKeyboardHints();

  // The slash list has no field, so the keyboard goes with it.
  useEffect(() => {
    if (isSlashCommandsMode || isLoadBundleMode) inputRef.current?.blur();
  }, [isSlashCommandsMode, isLoadBundleMode, inputRef]);

  return (
    <Command
      loop
      shouldFilter={!isSlashCommandsMode && !isLoadBundleMode}
      className={cn("flex min-h-0 flex-1 flex-col outline-none", GROUP_HEADINGS)}
    >
      <SlashShortcuts actions={actions} />

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
                value={field.value}
                onValueChange={field.onChange}
                onFocus={onFieldFocus}
                placeholder={t(locale, "searchPlaceholder")}
                enterKeyHint="go"
                className={cn(
                  // 16px: below that iOS Safari zooms the page on focus.
                  "min-w-0 flex-1 bg-transparent py-3 font-sans text-[16px] outline-none",
                  "placeholder:text-tertiary-foreground"
                )}
              />
              {/* No keyboard to type "/" on: the field's trailing accessory
                  opens the slash list, while the field is empty. */}
              {!showHints && field.value === "" && <SlashEntry />}
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
  );
}
