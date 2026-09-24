"use client";

import { useAbout } from "@/systems/about";
import { useEffect, useRef } from "react";

/**
 * Opens the About on arrival at `/about`, and when it is put away, leaves the
 * address as `/` — the page underneath already is the home screen, so the
 * history entry is swapped rather than navigated (no remount, no scroll).
 */
export function AboutRoute() {
  const { isOpen, open } = useAbout();
  const opened = useRef(false);

  useEffect(() => {
    open();
  }, [open]);

  useEffect(() => {
    if (isOpen) {
      opened.current = true;
      return;
    }
    if (opened.current && window.location.pathname === "/about") {
      window.history.replaceState(window.history.state, "", "/");
    }
  }, [isOpen]);

  return null;
}
