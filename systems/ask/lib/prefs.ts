import { makeStore } from "@/components/post/persisted-setting";
import {
  askEffortOf,
  askModelOf,
  DEFAULT_ASK_EFFORT,
  DEFAULT_ASK_MODEL,
  type AskEffort,
} from "./models";

// =============================================================================
// The visitor's last picks: which model, how hard it thinks. What a new
// conversation starts on (each conversation then keeps its own, ./chat.ts).
// Per-viewer conveniences, remembered where storage allows. Their own module,
// with nothing of the AI SDK, so the devtool can show and reset them without
// loading the chat.
// =============================================================================

const CHANGE = "hux-ask-prefs";

export const askModelPref = makeStore<string>("hux_ask_model", CHANGE, DEFAULT_ASK_MODEL, (raw) =>
  askModelOf(raw ?? DEFAULT_ASK_MODEL).id,
);

export const askEffortPref = makeStore<AskEffort>("hux_ask_effort", CHANGE, DEFAULT_ASK_EFFORT, (raw) =>
  askEffortOf(raw ?? DEFAULT_ASK_EFFORT),
);
