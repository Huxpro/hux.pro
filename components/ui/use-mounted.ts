"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * False on the server and while hydrating, true after: for output the server
 * cannot know (the reader's theme, platform, pointer). No effect and no state
 * update — React reconciles the two snapshots itself.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
