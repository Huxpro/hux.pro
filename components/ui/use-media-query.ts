"use client";

import { useCallback, useSyncExternalStore } from "react";

// One MediaQueryList per query, shared by every reader.
const lists = new Map<string, MediaQueryList>();
function list(query: string): MediaQueryList {
  let mql = lists.get(query);
  if (!mql) lists.set(query, (mql = window.matchMedia(query)));
  return mql;
}

/** Whether `query` matches, live. False on the server and the first render. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = list(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => list(query).matches,
    () => false,
  );
}
