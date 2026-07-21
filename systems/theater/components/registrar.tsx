"use client";

import { useEffect, useMemo } from "react";
import { useLocale } from "@/services";
import { buildTalkAlbums } from "../lib/albums";
import { useTheater } from "../provider";

// ---------------------------------------------------------------------------
// TheaterRegistrar — registers the curated talk albums globally so any entry
// point (home widget, commit-page videos) can open the player with full
// playlist context. Rebuilds on locale change. Renders nothing.
// ---------------------------------------------------------------------------

export function TheaterRegistrar() {
  const { locale } = useLocale();
  const { registerAlbums } = useTheater();
  const albums = useMemo(() => buildTalkAlbums(locale), [locale]);

  useEffect(() => {
    registerAlbums(albums);
  }, [albums, registerAlbums]);

  return null;
}
