"use client";

import { useEffect } from "react";

const EDITABLE = "input, textarea, [contenteditable='true']";

function isEditable(node: EventTarget | Node | null) {
  if (!node) return false;
  const el = node instanceof Element ? node : (node as Node).parentElement;
  return !!el?.closest(EDITABLE);
}

/**
 * iOS Safari will skip `user-select: none` nodes and expand a long-press into
 * a full-page selection (Copy / Find Selection across the whole viewport).
 * While this hook is mounted, a selection that is not inside a text field is
 * cancelled — CSS on `.system-surface` is the first line; this is the iOS one.
 */
export function useLockTextSelection() {
  useEffect(() => {
    const onSelectStart = (e: Event) => {
      if (isEditable(e.target)) return;
      e.preventDefault();
    };

    const onSelectionChange = () => {
      const active = document.activeElement;
      if (active && isEditable(active)) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      if (isEditable(sel.anchorNode)) return;
      sel.removeAllRanges();
    };

    document.addEventListener("selectstart", onSelectStart, { capture: true });
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("selectstart", onSelectStart, true);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);
}
