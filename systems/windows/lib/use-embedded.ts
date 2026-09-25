"use client";

import { useSyncExternalStore } from "react";
import { isEmbeddedWindow } from "./embed";

// Never changes after boot, so there is nothing to subscribe to.
const subscribe = () => () => {};

/**
 * Whether this document is a page inside a window. False on the server and on
 * the hydrating render (so markup agrees), the truth right after.
 */
export function useEmbeddedWindow(): boolean {
  return useSyncExternalStore(subscribe, isEmbeddedWindow, () => false);
}
