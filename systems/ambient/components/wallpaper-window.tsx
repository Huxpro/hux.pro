"use client";

import { t, useLocale } from "@/services";
import { useEffect, useRef, useState } from "react";
import { WallpaperPickerBody } from "./wallpaper-sheet";

// =============================================================================
// WallpaperWindow — the wallpaper picker, as a window (unified windows)
//
// The best place to choose a wallpaper is a window standing on it: every
// choice lands on the desktop around the window as it is made. Columns follow
// the window's own width — two in the portrait size it opens at, three once
// it is dragged wide — rather than the viewport's.
// =============================================================================

/** Wide enough for three columns of pair cards. */
const THREE_COLUMNS_PX = 560;

export function WallpaperWindow() {
  const { locale } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setColumns(entry.contentRect.width >= THREE_COLUMNS_PX ? 3 : 2);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full overflow-y-auto px-4 pb-4 pt-12">
      <h2 className="sr-only">{t(locale, "wallpaperTitle")}</h2>
      <WallpaperPickerBody columns={columns} />
    </div>
  );
}
