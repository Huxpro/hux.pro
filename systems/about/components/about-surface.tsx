"use client";

import { BadgeLaunchProvider } from "@/components/badge";
import { TYPE } from "@/lib/typography";
import { GLASS_TRACK_FLAT } from "@/systems/theater/lib/chrome";
import { cn } from "@/lib/utils";
import { t, useInputCapability, useLocale } from "@/services";
import { useWallpaper } from "@/systems/ambient";
import { AnimatePresence, motion } from "motion/react";
import { BEZEL_INSET, VITRE_LAYER_ATTRIBUTE } from "vitre";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type Ref,
  type ReactNode,
} from "react";
import { useAbout } from "../provider";
import { EdgeGlow, Glow, useGlowTuning } from "@/systems/glow";

// =============================================================================
// AboutSurface — the About, floating over whatever page is underneath.
//
// Three layers, bottom to top:
//
//   the veil    the page, blurred and washed in the glass material
//               (`bg-glass`, so Tinted / Clear and the wallpaper tint apply),
//               so the words sit on something calm without the page going
//               away — you can still see where you are.
//   the words   a single column in the middle, brief, from
//               content/about/<locale>.mdx (rendered on the server by
//               AboutCopy and handed in as `en` / `zh`). Each block rises in
//               turn (`.about-copy`, globals.css).
//   the glow    the Siri ring on the screen's edge (systems/glow) — a shader,
//               always moving, above everything and taking no pointer.
//
// It leaves by a press anywhere outside the words, Escape, `O`, the button
// at the foot, or by anything in it opening something: a badge or a link
// hands the stage to what it opened (BadgeLaunchProvider).
//
// It sits above the theater and windows (z 10000–10005) and below the
// command palette (10050), which can still be summoned over it.
// =============================================================================

export interface AboutSurfaceProps {
  en: ReactNode;
  zh: ReactNode;
}

export function AboutSurface({ en, zh }: AboutSurfaceProps) {
  const { isOpen, close } = useAbout();
  const { locale } = useLocale();
  const { hasFineHoverPointer } = useInputCapability();
  const tuning = useGlowTuning();
  // Inside the bezel, when one is drawn: the About is a surface on the page's
  // screen, and the page's screen is the box within the bezel's bands, rounded
  // at its radius. Nothing of the veil or the ring may reach the bezel.
  // One radius for the screen (`screenRadius`), the same number <Vitre>
  // draws the bezel with: the veil and the ring follow it as the devtool
  // drags it, and without a bezel it is 0.
  const { bezel, screenRadius } = useWallpaper();
  const frame = bezel
    ? { ...BEZEL_INSET, borderRadius: screenRadius }
    : undefined;
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const desk = useDeskLayout();
  // Whether the words overflow their container: the fade at its edges says
  // there is more.
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const article = articleRef.current;
    const scroll = scrollRef.current;
    if (!article || !scroll) return;
    const measure = () => setOverflowing(scroll.scrollHeight > scroll.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroll);
    ro.observe(article);
    return () => ro.disconnect();
  }, [isOpen]);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Take focus while up, so Tab starts inside it and a screen reader lands
  // on it; give it back to whatever had it on the way out.
  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      returnFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  const onBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) close();
  };

  // A plain link in the copy navigates; the About steps aside for it. Badges
  // do the same through BadgeLaunchProvider, since they may open no page.
  const onCopyClick = (e: MouseEvent) => {
    const anchor = (e.target as Element).closest("a");
    if (!anchor || anchor.dataset.badge) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    close();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="about"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t(locale, "aboutTitle")}
            tabIndex={-1}
            {...(bezel ? { [VITRE_LAYER_ATTRIBUTE]: "" } : {})}
            className="fixed inset-0 z-[10020] flex flex-col overflow-hidden outline-none"
            style={frame}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div
              aria-hidden
              className="absolute inset-0 bg-glass/70 backdrop-blur-2xl backdrop-saturate-150"
            />
            {/* On a desk the words and the way out are one group, centred
                on the screen — spacers above and below take what is left.
                On a phone the words take every line the screen has and the
                way out sits at its foot. Either way the words scroll in their
                own container, and the way out never scrolls away with them. */}
            <div aria-hidden className="hidden sm:block sm:flex-1" onClick={onBackdrop} />
            <div
              ref={scrollRef}
              className={cn(
                "relative min-h-0 flex-1 overflow-y-auto overscroll-contain sm:flex-initial",
                overflowing && "about-scroll-fade",
              )}
              onClick={onBackdrop}
            >
              <div
                className={cn(
                  "flex min-h-full items-center justify-center",
                  // The ring owns the outer few dozen pixels; the words keep
                  // clear of it, and of the notch.
                  "px-[max(2.25rem,calc(env(safe-area-inset-left)+1.5rem))]",
                  "pt-[max(5rem,calc(env(safe-area-inset-top)+3.5rem))] pb-6",
                  "sm:px-12 sm:pt-10 sm:pb-2",
                )}
                onClick={onBackdrop}
              >
                <motion.article
                  ref={articleRef}
                  lang={locale === "zh" ? "zh" : "en"}
                  className="about-copy w-full max-w-[33rem] space-y-5 text-[15px] leading-[1.8] text-muted-foreground [&:lang(zh)]:leading-[1.9]"
                  initial={{ y: 10, scale: 0.985 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: 6, scale: 0.99 }}
                  transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                  onClickCapture={onCopyClick}
                >
                  <BadgeLaunchProvider onLaunch={close}>
                    {locale === "zh" ? zh : en}
                  </BadgeLaunchProvider>
                </motion.article>
              </div>
            </div>
            <div
              className={cn(
                "relative shrink-0",
                "px-[max(2.25rem,calc(env(safe-area-inset-left)+1.5rem))] sm:px-12",
                "pt-4 pb-[max(2.25rem,calc(env(safe-area-inset-bottom)+1.25rem))] sm:pt-8 sm:pb-10",
              )}
              onClick={onBackdrop}
            >
              <AboutFoot
                ref={footRef}
                keyboard={hasFineHoverPointer}
                onDismiss={close}
              />
            </div>
            <div aria-hidden className="hidden sm:block sm:flex-1" onClick={onBackdrop} />
          </motion.div>
        )}
      </AnimatePresence>
      <EdgeGlow
        active={isOpen}
        // The words, as far as their scroll container shows them, and the
        // way out under them: the light ends a share of the way to them.
        content={[articleRef, footRef]}
        // The devtool's Glow module: the About's own strength, and its depth
        // per layout (systems/glow/lib/tuning.ts).
        depth={desk ? tuning.aboutDesk : tuning.aboutPhone}
        strength={tuning.aboutStrength}
        radius={screenRadius}
        style={frame}
        layer={bezel}
        className={cn("z-[10021]", bezel && "overflow-hidden")}
      />
    </>
  );
}

/** The About's two layouts: a centred group on a desk (`sm` and up), the
 *  whole screen on a phone. */
const DESK_QUERY = "(min-width: 640px)";
function useDeskLayout(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DESK_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESK_QUERY).matches,
    () => true,
  );
}

function AboutFoot({
  keyboard,
  onDismiss,
  ref,
}: {
  keyboard: boolean;
  onDismiss: () => void;
  ref?: Ref<HTMLDivElement>;
}) {
  const { locale } = useLocale();
  return (
    // On a phone the way out is centred at the screen's foot. On a desk it
    // hangs from the words' left edge, as their last line: centred under a
    // ragged paragraph it lines up with nothing.
    <div
      ref={ref}
      className="about-foot system-chrome mx-auto flex w-full max-w-[33rem] flex-col items-center sm:items-start"
    >
      {/* Glass, not a slab: the way out is part of the veil it sits on. It
          breathes — the glow's pulse, blooming out from behind it — the one
          thing on the screen asking to be pressed. Where there is a
          keyboard it wears its key, Esc. */}
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          "relative inline-flex items-center gap-2.5 rounded-full py-2 text-[13px] font-medium text-foreground",
          keyboard ? "pr-2 pl-5" : "px-5",
          GLASS_TRACK_FLAT,
          "active:scale-[0.97] active:duration-0",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        {/* Reveal, every time: the veil lifts off the page underneath. */}
        {t(locale, "aboutEnter")}
        {keyboard && (
          <kbd aria-hidden className={cn(TYPE.kbd, "px-1.5 py-0 text-[10px] leading-5")}>
            esc
          </kbd>
        )}
        <Glow active motion="pulse" inside={false} bleed={14} reach={3} strength={0.9} />
      </button>
      {/* One quiet line for every device: the palette is where it lives. */}
      <span className="mt-3 max-w-[12.5rem] text-center text-[11px] leading-relaxed text-quaternary-foreground sm:max-w-none sm:text-left">
        {t(locale, "aboutReopenHintTouch")}
      </span>
    </div>
  );
}
