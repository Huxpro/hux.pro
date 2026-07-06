"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";

/**
 * Media "bleed out" setting — a tiny persisted, global dev-time channel,
 * adjustable from the devtool panel. When on (the default), wide landscape
 * media breaks out of the reading column on desktop (see the `data-bleed`
 * rules in app/globals.css); when off, everything stays column-width.
 *
 * The switch is CSS-only: {@link BleedRootSync} reflects the setting onto a
 * `data-bleed-off` attribute on <html>, which a disable rule keys off. The
 * setting applies whether or not the devtool is enabled; the panel is just the
 * UI for flipping it.
 */

const STORAGE_KEY = "hux_bleed_enabled";
const CHANGE_EVENT = "hux:bleed-enabled";
const ROOT_ATTR = "data-bleed-off";

export function getBleedEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // Default on: only an explicit "off" disables the bleed.
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setBleedEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
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

export function useBleedEnabled(): boolean {
  return useSyncExternalStore(subscribe, getBleedEnabled, () => true);
}

/**
 * Reflects the bleed setting onto <html> as a `data-bleed-off` attribute so the
 * CSS disable rule can neutralize the outset globally. Renders nothing; mount
 * once at the app root.
 */
export function BleedRootSync() {
  const enabled = useBleedEnabled();

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.removeAttribute(ROOT_ATTR);
    else root.setAttribute(ROOT_ATTR, "");
  }, [enabled]);

  return null;
}
