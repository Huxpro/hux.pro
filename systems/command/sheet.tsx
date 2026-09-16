"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { detentHeight, HEADER_BUTTON, SurfaceSheet } from "@/systems/surface";
import { Command } from "cmdk";
import { Search, Slash, X } from "lucide-react";
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
// `surface` command, when it stays where it is and steps back while the
// surface it opened — the wallpaper picker — rises over it, the shared stack
// doing the stepping. Closing the picker brings the palette forward again:
// on a phone a sheet presented from a sheet returns to it, as on iOS.
//
// Slash mode on a phone is a second sheet stacked on this one, the way iOS
// presents a sheet from a sheet: the palette stays open and steps back, the
// slash list rises over it level with its detent, and a drag down (the
// palette following the finger forward), its close button or a tap on the
// receded palette brings the palette forward again — one level at a time,
// as on iOS; the palette's own close is on the palette.
// It is a true stack (the sheet is a React child of the palette's, so Base UI
// treats it as nested, and the shared stack recedes the parent), reached by
// the "/" chip in the field or by typing "/" into the empty field. The field
// gives up the keyboard as the list comes in; a hardware keyboard still gets
// the letters.
//
// The shell (this component) is always mounted so the sheet can animate out;
// everything that costs something — the command list, the field, the
// shortcuts — lives in SheetBody, which Base UI unmounts with the sheet.
// =============================================================================

/** iOS's medium and large detents, near enough. Opens at the first. */
const SNAP_POINTS = [0.7, 1];
const SNAP_TOP = SNAP_POINTS[SNAP_POINTS.length - 1];

type Detent = number | string | null;

/** The palette's detent as a number; a string or unset detent counts as the first. */
const detentOf = (snap: Detent): number =>
  typeof snap === "number" ? snap : SNAP_POINTS[0];

export function CommandSheet() {
  const { isOpen, close } = useCommand();
  const { locale } = useLocale();

  const inputRef = useRef<HTMLInputElement>(null);
  const [snap, setSnap] = useState<Detent>(SNAP_POINTS[0]);

  // A fresh sheet each time: lower detent.
  useEffect(() => {
    if (isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on close
    setSnap(SNAP_POINTS[0]);
  }, [isOpen]);

  const shell = useMemo<CommandShell>(
    () => ({
      leave: (kind) => {
        if (kind === "surface") {
          // The palette stays, a step back; only the keyboard goes.
          inputRef.current?.blur();
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
          snap={snap}
          // Tapping the field is asking for room: the sheet climbs to the
          // top as the keyboard comes up. A tap, not a focus: focus also
          // comes back on its own when a sheet stacked on this one closes,
          // and that is nobody asking for anything.
          onFieldTap={() => setSnap(SNAP_TOP)}
        />
      </SurfaceSheet>
    </CommandShellProvider>
  );
}

/** Everything inside the shell. Mounted only while the sheet is up. */
function SheetBody({
  inputRef,
  snap,
  onFieldTap,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** The palette's detent, which the slash sheet opens at. */
  snap: Detent;
  onFieldTap: () => void;
}) {
  const {
    isSlashCommandsMode,
    isLoadBundleMode,
    close,
    setSlashCommandsMode,
    setLoadBundleMode,
  } = useCommand();
  const { locale } = useLocale();
  const actions = useCommandActions();
  const field = useCommandField();
  const showHints = useShowKeyboardHints();

  // The slash sheet stands level with the palette: as tall as the palette's
  // detent, read once on the way in. No detents of its own — a sheet with
  // detents reports its swipe as a position between them, which at the lowest
  // detent is already "all the way", and the palette underneath needs the
  // plain fraction of the way out to come forward under the finger. (Base UI
  // contract; see the list at the top of systems/surface/sheet.tsx before
  // giving it detents or a different way out.)
  const [slashDetent, setSlashDetent] = useState(() => detentOf(snap));

  // The slash list has no field, so the keyboard goes with it.
  useEffect(() => {
    if (!isSlashCommandsMode && !isLoadBundleMode) return;
    inputRef.current?.blur();
    if (isSlashCommandsMode) setSlashDetent(detentOf(snap));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `snap` is read on open only
  }, [isSlashCommandsMode, isLoadBundleMode, inputRef]);

  return (
    <>
      <Command
        loop
        shouldFilter={!isLoadBundleMode}
        className={cn("flex min-h-0 flex-1 flex-col outline-none", GROUP_HEADINGS)}
      >
        <SlashShortcuts actions={actions} />

        {/* Header — the search field. The load-bundle panel brings its own. */}
        {!isLoadBundleMode && (
          <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 pb-1 pt-1">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              ref={inputRef}
              value={field.value}
              onValueChange={field.onChange}
              onClick={onFieldTap}
              placeholder={t(locale, "searchPlaceholder")}
              enterKeyHint="go"
              className={cn(
                // 16px: below that iOS Safari zooms the page on focus.
                "min-w-0 flex-1 bg-transparent py-3 font-sans text-[16px] outline-none",
                "placeholder:text-tertiary-foreground"
              )}
            />
            {/* No keyboard to type "/" on: the field's trailing accessory
                opens the slash sheet, while the field is empty. Tucked in
                against the close button so the two read as one cluster. */}
            {!showHints && field.value === "" && (
              <SlashEntry className="-mr-2" />
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
        ) : (
          <CommandResults
            actions={actions}
            className="min-h-0 flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)]"
          />
        )}
      </Command>

      {/* The slash sheet, stacked on the palette. Outside the cmdk root, so a
          key pressed in here is not also a key pressed in the search list. */}
      <SurfaceSheet
        id="command-slash"
        nestedIn="command"
        open={isSlashCommandsMode}
        onOpenChange={(open) => {
          if (!open) setSlashCommandsMode(false);
        }}
        modal
        height={detentHeight(slashDetent)}
        // Focus must not come back to the field: on iOS a field focused with
        // no keyboard gets one on the next touch anywhere in the palette.
        restoreFocus={false}
        label={t(locale, "slashCommands")}
        className="system-chrome"
      >
        {/* One way out, one level down — a stacked sheet's close is its own,
            as on iOS. The palette's own close is on the palette. */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 pb-1 pt-1">
          <Slash className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 py-2 font-sans text-sm font-medium text-muted-foreground">
            {t(locale, "slashCommands")}
          </span>
          <button
            type="button"
            onClick={() => setSlashCommandsMode(false)}
            aria-label={t(locale, "backToSearch")}
            className={cn(HEADER_BUTTON, "-mr-2")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <CommandSlashList actions={actions} />
        </div>
      </SurfaceSheet>
    </>
  );
}
