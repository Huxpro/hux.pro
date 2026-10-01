"use client";

import { useAbout } from "@/systems/about";
import { useEffect, useRef } from "react";

/**
 * Opens the About on arrival at `/about`, and when it is put away, leaves the
 * address as `/`. The page underneath already is the home screen, so the
 * history entry is swapped rather than navigated (no remount, no scroll).
 */
export function AboutRoute() {
  const { isOpen, open, dismissed } = useAbout();
  const opened = useRef(false);

  useEffect(() => {
    open();
  }, [open]);

  useEffect(() => {
    if (isOpen) {
      opened.current = true;
      return;
    }
    // Only when the visitor put it away: anything else that closed it (a
    // link to another page) is taking the address itself, and a swap under
    // the router's pending push would cancel it.
    if (dismissed && opened.current && window.location.pathname === "/about") {
      window.history.replaceState(window.history.state, "", "/");
    }
  }, [isOpen, dismissed]);

  return null;
}
