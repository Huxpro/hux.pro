"use client";

import { useEffect, useMemo } from "react";
import { useLocale } from "@/services";
import { buildSlidesAlbum, buildTalkAlbums } from "../lib/albums";
import { useTheater } from "../provider";

// ---------------------------------------------------------------------------
// TheaterRegistrar — registers the curated talk albums, and the Slides
// library, globally so any entry point (home widget, commit-page videos and
// decks) can open the player with full playlist context. Rebuilds on locale
// change. Renders nothing.
// ---------------------------------------------------------------------------

export function TheaterRegistrar() {
  const { locale } = useLocale();
  const { registerAlbums, registerSlidesAlbum } = useTheater();
  const albums = useMemo(() => buildTalkAlbums(locale), [locale]);
  const slides = useMemo(() => buildSlidesAlbum(locale), [locale]);

  useEffect(() => {
    registerAlbums(albums);
  }, [albums, registerAlbums]);

  // The second library: every deck, kept apart from the talks.
  useEffect(() => {
    registerSlidesAlbum(slides);
  }, [slides, registerSlidesAlbum]);

  return null;
}
