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
  { type: "SHOW_ASK", placement: "center", platform: "desk", entry: "direct" },
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
  assert.deepEqual(parked.parking, { returnTo: "center", entry: "direct" });

  const restored = reduceCommandAsk(parked, {
    type: "CLOSE_PALETTE",
    platform: "desk",
    canSide: true,
  });
  assert.equal(restored.palette, "ask");
  assert.equal(visibleAskPlacement(restored), "center");
  assert.equal(restored.parking, null);
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

test("losing side capacity rehomes Ask without creating two foreground panes", () => {
  const side = reduceCommandAsk(INITIAL_COMMAND_ASK_STATE, {
    type: "SHOW_ASK",
    placement: "side",
    platform: "desk",
    entry: "direct",
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
});
