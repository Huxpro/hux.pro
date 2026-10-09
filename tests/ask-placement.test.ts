import assert from "node:assert/strict";
import test from "node:test";
import {
  ASK_SIDE_MIN_WIDTH,
  canUseAskSide,
  INITIAL_COMMAND_ASK_STATE,
  reduceCommandAsk,
  visibleAskPlacement,
  type CommandAskState,
} from "../systems/command/ask-state.ts";

const showCenter = (): CommandAskState => reduceCommandAsk(
  INITIAL_COMMAND_ASK_STATE,
  {
    type: "SHOW_ASK",
    placement: "center",
    platform: "desk",
    entry: "direct",
    provenance: "automatic",
  },
);

test("side capacity follows the width where the page can reserve the panel", () => {
  assert.equal(canUseAskSide(ASK_SIDE_MIN_WIDTH - 1), false);
  assert.equal(canUseAskSide(ASK_SIDE_MIN_WIDTH), true);
});

test("a centered Ask is one coherent palette state", () => {
  const state = showCenter();
  assert.equal(state.palette, "ask");
  assert.equal(state.askSurface, null);
  assert.equal(state.askPill, false);
  assert.equal(visibleAskPlacement(state), "center");
});

test("Command parks a centered Ask at the side and closing it restores center", () => {
  const parked = reduceCommandAsk(showCenter(), {
    type: "PARK_AND_OPEN",
    mode: "search",
    target: "side",
    returnTo: "center",
    entry: "direct",
  });
  assert.equal(parked.palette, "search");
  assert.equal(visibleAskPlacement(parked), "side");
  assert.deepEqual(parked.parking, {
    returnTo: "center",
    entry: "direct",
    provenance: "automatic",
    reason: "command",
  });

  const restored = reduceCommandAsk(parked, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: true,
  });
  assert.equal(restored.palette, "ask");
  assert.equal(visibleAskPlacement(restored), "center");
  assert.equal(restored.parking, null);
});

test("temporary parking also restores a Top conversation", () => {
  const top = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "top",
    platform: "desk",
    entry: "direct",
    provenance: "user",
  });
  const parked = reduceCommandAsk(top, {
    type: "PARK_AND_OPEN",
    mode: "search",
    target: "side",
    returnTo: "top",
    entry: "direct",
  });
  assert.equal(visibleAskPlacement(parked), "side");
  assert.equal(parked.askProvenance, "command-park");
  assert.equal(parked.parking?.provenance, "user");
  assert.equal(parked.parking?.reason, "command");

  const restored = reduceCommandAsk(parked, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(restored), "top");
  assert.equal(restored.palette, "closed");
  assert.equal(restored.askProvenance, "user");
});

test("parking restores the effective place even when an older manual intent remains", () => {
  const manualSide = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "side",
    platform: "desk",
    entry: "direct",
    provenance: "user",
  });
  // Asking from Command is an explicit center morph, but does not erase the
  // page-scoped preference used by a later direct reopen.
  const center = reduceCommandAsk(manualSide, {
    type: "SHOW_ASK",
    placement: "center",
    platform: "desk",
    entry: "command",
    provenance: "automatic",
  });
  const parked = reduceCommandAsk(center, {
    type: "PARK_AND_OPEN",
    mode: "search",
    target: "side",
    returnTo: "center",
    entry: "command",
  });
  const restored = reduceCommandAsk(parked, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(restored), "center");
  assert.equal(restored.manualPlacement, "side");
});

test("a manual placement survives close inside the same page context", () => {
  const manual = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "top",
    platform: "desk",
    entry: "direct",
    provenance: "user",
  });
  const closed = reduceCommandAsk(manual, { type: "CLOSE_ASK" });
  assert.equal(visibleAskPlacement(closed), null);
  assert.equal(closed.manualPlacement, "top");
  assert.equal(closed.askProvenance, "user");
});

test("capacity temporarily displaces and then restores a manual Side", () => {
  const manual = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "side",
    platform: "desk",
    entry: "direct",
    provenance: "user",
  });
  const narrow = reduceCommandAsk(manual, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: false,
  });
  assert.equal(visibleAskPlacement(narrow), "center");
  assert.equal(narrow.askProvenance, "capacity");
  assert.equal(narrow.manualPlacement, "side");

  const wide = reduceCommandAsk(narrow, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(wide), "side");
  assert.equal(wide.askProvenance, "user");
  assert.equal(wide.manualPlacement, "side");
});

test("capacity also restores an automatically placed Side", () => {
  const automatic = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "side",
    platform: "desk",
    entry: "direct",
    provenance: "automatic",
  });
  const narrow = reduceCommandAsk(automatic, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: false,
  });
  assert.equal(visibleAskPlacement(narrow), "center");
  assert.equal(narrow.parking?.reason, "capacity");

  const wide = reduceCommandAsk(narrow, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(wide), "side");
  assert.equal(wide.askProvenance, "automatic");
  assert.equal(wide.parking, null);
});

test("closing a capacity-fallback Center closes Ask instead of reopening it", () => {
  const manualSide = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "side",
    platform: "desk",
    entry: "direct",
    provenance: "user",
  });
  const narrow = reduceCommandAsk(manualSide, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: false,
  });
  const closed = reduceCommandAsk(narrow, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: false,
  });
  assert.equal(closed.palette, "closed");
  assert.equal(visibleAskPlacement(closed), null);
  assert.equal(closed.manualPlacement, "side");

  const wideWhileClosed = reduceCommandAsk(closed, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(wideWhileClosed), null);

  const command = reduceCommandAsk(closed, {
    type: "OPEN_PALETTE",
    mode: "search",
  });
  const commandClosed = reduceCommandAsk(command, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(commandClosed), null);
});

test("a narrow desk parks Ask as a pill instead of forcing two wide panels", () => {
  const parked = reduceCommandAsk(showCenter(), {
    type: "PARK_AND_OPEN",
    mode: "slash",
    target: "pill",
    returnTo: "center",
    entry: "command",
  });
  assert.equal(parked.palette, "slash");
  assert.equal(parked.askPill, true);
  assert.equal(visibleAskPlacement(parked), null);

  const restored = reduceCommandAsk(parked, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: false,
  });
  assert.equal(visibleAskPlacement(restored), "center");
  assert.equal(restored.askPill, false);
});

test("navigation commits temporary parking and does not teleport Ask back", () => {
  const parked = reduceCommandAsk(showCenter(), {
    type: "PARK_AND_OPEN",
    mode: "search",
    target: "side",
    returnTo: "center",
    entry: "direct",
  });
  const navigated = reduceCommandAsk(parked, {
    type: "NAVIGATE",
    reading: true,
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(navigated), "side");
  assert.equal(navigated.parking, null);

  const closed = reduceCommandAsk(navigated, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(closed), "side");
});

test("a reading navigation moves center aside only when both columns fit", () => {
  const wide = reduceCommandAsk(showCenter(), {
    type: "NAVIGATE",
    reading: true,
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(wide), "side");

  const narrow = reduceCommandAsk(showCenter(), {
    type: "NAVIGATE",
    reading: true,
    platform: "desk",
    canSide: false,
  });
  assert.equal(visibleAskPlacement(narrow), "center");
});

test("navigation clears the prior page's manual override", () => {
  const manualCenter = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "center",
    platform: "desk",
    entry: "direct",
    provenance: "user",
  });
  const nextPage = reduceCommandAsk(manualCenter, {
    type: "NAVIGATE",
    reading: true,
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(nextPage), "side");
  assert.equal(nextPage.manualPlacement, null);
  assert.equal(nextPage.askProvenance, "navigation");
});

test("losing side capacity rehomes Ask without creating two foreground panes", () => {
  const side = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "side",
    platform: "desk",
    entry: "direct",
    provenance: "automatic",
  });
  const centered = reduceCommandAsk(side, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: false,
  });
  assert.equal(visibleAskPlacement(centered), "center");

  const sharing = reduceCommandAsk(
    { ...side, palette: "search" },
    { type: "VIEWPORT", platform: "desk", canSide: false },
  );
  assert.equal(sharing.palette, "search");
  assert.equal(sharing.askPill, true);
  assert.equal(visibleAskPlacement(sharing), null);
  assert.equal(sharing.parking?.reason, "capacity");

  const commandClosed = reduceCommandAsk(sharing, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: false,
  });
  assert.equal(visibleAskPlacement(commandClosed), "center");

  const wideAfterCommand = reduceCommandAsk(commandClosed, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(wideAfterCommand), "side");
  assert.equal(wideAfterCommand.askProvenance, "automatic");

  const roomyAgain = reduceCommandAsk(sharing, {
    type: "VIEWPORT",
    platform: "desk",
    canSide: true,
  });
  assert.equal(visibleAskPlacement(roomyAgain), "side");
  assert.equal(roomyAgain.askProvenance, "automatic");
  assert.equal(roomyAgain.parking, null);
});
