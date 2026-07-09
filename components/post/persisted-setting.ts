"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny persisted client setting: a `localStorage` value broadcast on a custom
 * event, exposed as `get` / `set` plus a `use` hook. Shared by the reading
 * settings (bleed, typeface, measure, focus) and the ruler dock side — each is
 * the same "value + change event + useSyncExternalStore" shape.
 *
 * The setting applies whether or not the devtool is enabled; the panel is just
 * the UI for flipping it.
 */
export interface PersistedSetting<T extends string> {
  get: () => T;
  set: (value: T) => void;
  use: () => T;
}

export function makeStore<T extends string>(
  key: string,
  event: string,
  fallback: T,
  parse: (raw: string | null) => T
): PersistedSetting<T> {
  const get = (): T => {
    if (typeof window === "undefined") return fallback;
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return fallback;
    }
  };

  const set = (value: T): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable — the event still updates this session.
    }
    window.dispatchEvent(new Event(event));
  };

  const subscribe = (callback: () => void) => {
    window.addEventListener(event, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(event, callback);
      window.removeEventListener("storage", callback);
    };
  };

  const useStore = (): T => useSyncExternalStore(subscribe, get, () => fallback);

  return { get, set, use: useStore };
}
