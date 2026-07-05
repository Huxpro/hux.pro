"use client";

import { useSyncExternalStore } from "react";

/**
 * Ruler ToC settings — a tiny persisted channel, adjustable from the
 * devtool panel. The setting applies whether or not the devtool is
 * enabled; the panel is just the UI for flipping it.
 */

export type RulerSide = "left" | "right";

const STORAGE_KEY = "hux_ruler_side";
const CHANGE_EVENT = "hux:ruler-side";

export function getRulerSide(): RulerSide {
  if (typeof window === "undefined") return "right";
  try {
    return localStorage.getItem(STORAGE_KEY) === "left" ? "left" : "right";
  } catch {
    return "right";
  }
}

export function setRulerSide(side: RulerSide): void {
  try {
    localStorage.setItem(STORAGE_KEY, side);
  } catch {
    // Storage unavailable — the event still updates this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useRulerSide(): RulerSide {
  return useSyncExternalStore(subscribe, getRulerSide, () => "right");
}
