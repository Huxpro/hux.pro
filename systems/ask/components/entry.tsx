"use client";

import { askLazy } from "./lazy-view";
import { AskSkeleton } from "./skeleton";

// =============================================================================
// The two heavy surfaces, as the page imports them. Each one's module (AI
// Elements, streamdown, the AI SDK client) stays out until Ask is actually
// opened; until then the skeleton is what the already-open surface shows.
// =============================================================================

export const AskChat = askLazy(() => import("./chat"), (props) => (
  <AskSkeleton kind="center" onBack={props.onBack} trailing={props.trailing} />
));

export const AskPanel = askLazy(() => import("./panel"), (props) => (
  <AskSkeleton kind="surface" onClose={props.onClose} />
));
