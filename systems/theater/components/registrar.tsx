"use client";

import { useEffect, useMemo } from "react";
import { useLocale } from "@/services";
import { buildLibraryAlbums } from "../lib/albums";
import { useTheater } from "../provider";

// ---------------------------------------------------------------------------
// TheaterRegistrar — registers the library's shelves globally, so any entry
// point (the home card, a /works cover, a prompt's deck) opens the player on
// that media's entry with the whole library around it. Rebuilds on locale
// change. Renders nothing.
// ---------------------------------------------------------------------------

export function TheaterRegistrar() {
  const { locale } = useLocale();
  const { registerAlbums } = useTheater();
  const albums = useMemo(() => buildLibraryAlbums(locale), [locale]);

  useEffect(() => {
    registerAlbums(albums);
  }, [albums, registerAlbums]);

  return null;
}
