"use client";

/**
 * PlayableVideoEmbed
 *
 * Shared cover + playback shell for the directly-playable video platforms
 * (YouTube / Vimeo / Bilibili). Each platform component computes its own embed
 * URL, iframe attributes, and cover artwork, then hands them here so the
 * click-to-play behaviour lives in one place.
 *
 * Playback is responsive:
 *  - sm+ (desktop / tablet): opens VideoModal — a centered ~80% lightbox.
 *  - < sm (mobile): plays the iframe *in place*, swapping the cover for the
 *    player, and dims the surroundings via VideoSpotlight. The video never
 *    leaves its spot in the timeline.
 */

import {
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoModal } from "./video-modal";
import { VideoSpotlight } from "./video-spotlight";

const MOBILE_QUERY = "(max-width: 639px)";

/**
 * SSR-safe "is this a mobile-width viewport?" — false on the server / first
 * hydration snapshot, live on the client. Mirrors the Tailwind `sm` breakpoint
 * so it stays in step with the responsive classes.
 */
function useIsMobile(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(MOBILE_QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

const SIZE_CLASSES = {
  compact: "max-w-md",
  default: "",
  large: "max-w-4xl",
} as const;

export interface PlayableVideoEmbedProps {
  /** Iframe player URL — must already include autoplay params. */
  embedUrl: string;
  /** Accessible iframe title. */
  title: string;
  /** aria-label for the cover play button. */
  label: string;
  /** Cover artwork layer (thumbnail image or branded placeholder). */
  cover: ReactNode;
  /** Iframe `allow` attribute. */
  allow?: string;
  /** Iframe `sandbox` attribute (Bilibili needs a scoped sandbox). */
  sandbox?: string;
  /** Iframe `scrolling` attribute. */
  scrolling?: "yes" | "no" | "auto";
  /** Size variant. */
  size?: "compact" | "default" | "large";
  /** Extra classes for the cover / inline player box. */
  className?: string;
  /** Background for the cover box (platforms with a placeholder pass ""). */
  coverClassName?: string;
}

export function PlayableVideoEmbed({
  embedUrl,
  title,
  label,
  cover,
  allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
  sandbox,
  scrolling,
  size = "default",
  className,
  coverClassName = "bg-muted/20",
}: PlayableVideoEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isMobile = useIsMobile();
  const playerRef = useRef<HTMLDivElement>(null);

  const boxClasses = cn(
    "relative w-full aspect-video rounded-lg overflow-hidden",
    SIZE_CLASSES[size],
    className,
  );

  // Mobile + playing: the iframe takes the cover's place and VideoSpotlight
  // dims everything around it. The player stays exactly where the card is.
  if (isMobile && isPlaying) {
    return (
      <>
        <div ref={playerRef} className={cn(boxClasses, "bg-black")}>
          <iframe
            src={embedUrl}
            title={title}
            allow={allow}
            allowFullScreen
            sandbox={sandbox}
            scrolling={scrolling}
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
        <VideoSpotlight
          open
          targetRef={playerRef}
          onClose={() => setIsPlaying(false)}
        />
      </>
    );
  }

  // Cover: always on desktop (the modal floats above it), and on mobile until
  // the first tap.
  return (
    <>
      <button
        type="button"
        onClick={() => setIsPlaying(true)}
        className={cn(
          boxClasses,
          coverClassName,
          "border border-border/50 group cursor-pointer",
        )}
        aria-label={label}
      >
        {cover}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="w-16 h-16 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-black/50 transition-all">
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </div>
        </div>
      </button>

      {/* Desktop playback: centered modal. Not mounted on mobile. */}
      {!isMobile && (
        <VideoModal
          open={isPlaying}
          onClose={() => setIsPlaying(false)}
          src={embedUrl}
          title={title}
          allow={allow}
          sandbox={sandbox}
          scrolling={scrolling}
        />
      )}
    </>
  );
}
