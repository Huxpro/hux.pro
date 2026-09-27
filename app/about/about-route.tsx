"use client";

import { useAbout } from "@/systems/about";
import { useEffect, useRef } from "react";

/**
 * Opens the About on arrival at `/about`, and when it is put away, leaves the
 * address as `/` — the page underneath already is the home screen, so the
 * history entry is swapped rather than navigated (no remount, no scroll).
 */
export function AboutRoute() {
  const { isOpen, open, leftByNavigation } = useAbout();
  const opened = useRef(false);

  useEffect(() => {
    open();
  }, [open]);

  useEffect(() => {
    if (isOpen) {
      opened.current = true;
      return;
    }
    // Put away by a link to another page: the router is leaving `/about`
    // already, and a swap under its pending push would cancel it.
    if (leftByNavigation) return;
    if (opened.current && window.location.pathname === "/about") {
      window.history.replaceState(window.history.state, "", "/");
    }
  }, [isOpen, leftByNavigation]);

  return null;
}
