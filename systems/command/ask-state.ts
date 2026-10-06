// The pure state behind Command and Ask sharing the same room. Kept free of
// React, Next and browser globals so every transition can be tested as a
// small state machine rather than inferred from a handful of booleans.

export const ASK_PLACEMENTS = ["center", "side", "top"] as const;
export type AskPlacement = (typeof ASK_PLACEMENTS)[number];
export type AskEntry = "command" | "direct";
export type AskPlatform = "desk" | "phone";
export type PaletteMode = "closed" | "search" | "slash" | "bundle" | "ask";
export type AskSurface = "side" | "top" | "sheet" | null;
export type AskPlacementProvenance =
  | "automatic"
  | "user"
  | "command-park"
  | "capacity"
  | "navigation";

/**
 * The side panel is 440px, the ordinary command card is up to 700px, and the
 * reading column wants 680px. At 1280px the page already begins reserving the
 * panel's width in globals.css; below it, calling the viewport a "desk" did
 * not mean those two tasks could actually share it.
 */
export const ASK_SIDE_MIN_WIDTH = 1280;

export function canUseAskSide(width: number): boolean {
  return width >= ASK_SIDE_MIN_WIDTH;
}

export function isAskPlacement(value: unknown): value is AskPlacement {
  return (ASK_PLACEMENTS as readonly unknown[]).includes(value);
}

export interface AskParking {
  /** Where Ask stood before a transient command moved it out of the way. */
  returnTo: AskPlacement;
  entry: AskEntry;
  provenance: AskPlacementProvenance;
  /** Command displaced Ask, or capacity displaced a Side already sharing it. */
  reason: "command" | "capacity";
}

export interface CommandAskState {
  palette: PaletteMode;
  askSurface: AskSurface;
  askPill: boolean;
  askStarted: boolean;
  askEntry: AskEntry;
  /** Why the effective placement currently looks the way it does. */
  askProvenance: AskPlacementProvenance;
  /** A user choice scoped to the current page, even during a capacity fallback. */
  manualPlacement: AskPlacement | null;
  parking: AskParking | null;
}

export const INITIAL_COMMAND_ASK_STATE: CommandAskState = {
  palette: "closed",
  askSurface: null,
  askPill: false,
  askStarted: false,
  askEntry: "direct",
  askProvenance: "automatic",
  manualPlacement: null,
  parking: null,
};

export function visibleAskPlacement(state: CommandAskState): AskPlacement | null {
  if (state.palette === "ask") return "center";
  if (state.askSurface === "sheet") return "center";
  return state.askSurface;
}

/** A placement normalized to the shell that represents it on this viewport. */
function showAsk(
  state: CommandAskState,
  placement: AskPlacement,
  platform: AskPlatform,
  entry: AskEntry,
  provenance: AskPlacementProvenance,
  manualPlacement = state.manualPlacement,
): CommandAskState {
  if (placement === "center" && platform === "desk") {
    return {
      ...state,
      palette: "ask",
      askSurface: null,
      askPill: false,
      askStarted: true,
      askEntry: entry,
      askProvenance: provenance,
      manualPlacement,
      parking: null,
    };
  }
  if (placement === "center") {
    return {
      ...state,
      palette: "closed",
      askSurface: "sheet",
      askPill: false,
      askStarted: true,
      askEntry: entry,
      askProvenance: provenance,
      manualPlacement,
      parking: null,
    };
  }
  return {
    ...state,
    palette: "closed",
    askSurface: placement,
    askPill: false,
    askStarted: true,
    askEntry: entry,
    askProvenance: provenance,
    manualPlacement,
    parking: null,
  };
}

export type AskParkTarget = "side" | "top" | "pill";

export type CommandAskAction =
  | { type: "OPEN_PALETTE"; mode: Exclude<PaletteMode, "closed" | "ask"> }
  | { type: "CLOSE_PALETTE"; platform: AskPlatform; canSide: boolean }
  | { type: "SET_PALETTE_MODE"; mode: PaletteMode }
  | {
      type: "SHOW_ASK";
      placement: AskPlacement;
      platform: AskPlatform;
      entry: AskEntry;
      provenance: AskPlacementProvenance;
    }
  | {
      type: "PARK_AND_OPEN";
      mode: "search" | "slash" | "bundle";
      target: AskParkTarget;
      returnTo: AskPlacement;
      entry: AskEntry;
    }
  | { type: "CLOSE_ASK" }
  | { type: "MINIMIZE_ASK"; pill: boolean }
  | { type: "NAVIGATE"; reading: boolean; platform: AskPlatform; canSide: boolean }
  | { type: "VIEWPORT"; platform: AskPlatform; canSide: boolean };

export function reduceCommandAsk(
  state: CommandAskState,
  action: CommandAskAction,
): CommandAskState {
  switch (action.type) {
    case "OPEN_PALETTE":
      return { ...state, palette: action.mode };

    case "CLOSE_PALETTE": {
      const parking = state.parking;
      if (!parking) return { ...state, palette: "closed" };
      // A capacity fallback uses the center palette as Ask's temporary shell.
      // Closing that shell closes Ask; it must not immediately reopen at the
      // side merely because the resize that displaced it is remembered.
      if (parking.reason === "capacity" && state.palette === "ask") {
        return {
          ...state,
          palette: "closed",
          askSurface: null,
          askPill: false,
          parking: null,
        };
      }
      const requested = parking.returnTo;
      const target = requested === "side" && !action.canSide ? "center" : requested;
      const restored = showAsk(
        { ...state, parking: null },
        target,
        action.platform,
        parking.entry,
        target === requested
          ? parking.provenance
          : "capacity",
      );
      return parking.reason === "capacity" && target !== requested
        ? { ...restored, parking }
        : restored;
    }

    case "SET_PALETTE_MODE":
      return {
        ...state,
        palette: action.mode,
        ...(action.mode === "ask"
          ? { askSurface: null, askPill: false, parking: null }
          : {}),
        // Ask in the palette is the center surface. Returning to another
        // palette mode closes that surface but keeps a side/top surface.
        ...(state.palette === "ask" && action.mode !== "ask"
          ? { askSurface: null, askPill: false, parking: null }
          : {}),
      };

    case "SHOW_ASK":
      return showAsk(
        state,
        action.placement,
        action.platform,
        action.entry,
        action.provenance,
        action.provenance === "user" ? action.placement : state.manualPlacement,
      );

    case "PARK_AND_OPEN":
      return {
        ...state,
        palette: action.mode,
        askSurface: action.target === "pill" ? null : action.target,
        askPill: action.target === "pill",
        askStarted: true,
        askEntry: action.entry,
        askProvenance: "command-park",
        parking: {
          returnTo: action.returnTo,
          entry: action.entry,
          provenance: state.askProvenance,
          reason: "command",
        },
      };

    case "CLOSE_ASK":
      return {
        ...state,
        palette: state.palette === "ask" ? "closed" : state.palette,
        askSurface: null,
        askPill: false,
        parking: null,
      };

    case "MINIMIZE_ASK":
      return {
        ...state,
        palette: state.palette === "ask" ? "closed" : state.palette,
        askSurface: null,
        askPill: action.pill,
        parking: null,
      };

    case "NAVIGATE": {
      // Navigation makes a temporary parking decision real: closing Command
      // must not teleport Ask back over the new page. A center conversation
      // arriving on a reading page moves beside it only when the viewport can
      // genuinely hold both columns.
      const next = {
        ...state,
        parking: null,
        manualPlacement: null,
        askProvenance: "navigation" as const,
      };
      if (
        action.reading &&
        action.platform === "desk" &&
        action.canSide &&
        visibleAskPlacement(state) === "center"
      ) {
        return showAsk(next, "side", action.platform, state.askEntry, "navigation", null);
      }
      return next;
    }

    case "VIEWPORT": {
      // Capacity temporarily displaces Side. Keep its origin in `parking` so
      // both automatic and manual placement return when the room does.
      if (action.canSide && state.askProvenance === "capacity") {
        if (state.palette !== "closed" && state.palette !== "ask") {
          // A Side that was already sharing Command returns as soon as it fits.
          // A real Command park remains reversible to its earlier place.
          if (state.parking) {
            return {
              ...state,
              askSurface: "side",
              askPill: false,
              askProvenance: state.parking.reason === "command"
                ? "command-park"
                : state.parking.provenance,
              parking: state.parking.reason === "command" ? state.parking : null,
            };
          }
          return state;
        }
        if (
          state.parking?.reason === "capacity" &&
          visibleAskPlacement(state) !== null
        ) {
          return showAsk(
            state,
            state.parking.returnTo,
            action.platform,
            state.parking.entry,
            state.parking.provenance,
          );
        }
        return state;
      }
      if (visibleAskPlacement(state) !== "side" || action.canSide) return state;
      // A command already owns the middle: collapse Ask to its pill until the
      // command closes. Otherwise move the conversation into the center shell.
      if (state.palette !== "closed" && state.palette !== "ask") {
        return {
          ...state,
          askSurface: null,
          askPill: true,
          askProvenance: "capacity",
          parking: state.parking ?? {
            returnTo: "side",
            entry: state.askEntry,
            provenance: state.askProvenance,
            reason: "capacity",
          },
        };
      }
      return {
        ...showAsk(state, "center", action.platform, state.askEntry, "capacity"),
        parking: {
          returnTo: "side",
          entry: state.askEntry,
          provenance: state.askProvenance,
          reason: "capacity",
        },
      };
    }
  }
}
