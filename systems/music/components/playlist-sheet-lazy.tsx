"use client";

import { useArmed } from "@/lib/deferred";
import dynamic from "next/dynamic";
import { useMusic } from "../provider";

const MusicPlaylistSheetInner = dynamic(
  () =>
    import("./playlist-sheet").then((m) => ({
      default: m.MusicPlaylistSheet,
    })),
  { ssr: false },
);

/** Mounts the playlist browser only after the first open. */
export function MusicPlaylistSheet() {
  const { isPlaylistOpen } = useMusic();
  const armed = useArmed(isPlaylistOpen);
  if (!armed) return null;
  return <MusicPlaylistSheetInner />;
}
