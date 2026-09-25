"use client";

import { BadgeLaunchProvider } from "@/components/badge";
import { TYPE } from "@/lib/typography";
import { GLASS_TRACK_FLAT } from "@/systems/theater/lib/chrome";
import { cn } from "@/lib/utils";
import { t, useInputCapability, useLocale } from "@/services";
import { useWallpaper } from "@/systems/ambient";
import { AnimatePresence, motion } from "motion/react";
import { BEZEL_INSET, BEZEL_LAYER_ATTRIBUTE } from "vitre";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useAbout } from "../provider";
import { Glow, useGlowTuning } from "@/systems/glow";

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
  const { isOpen, close, seen } = useAbout();
  const { locale } = useLocale();
  const { hasFineHoverPointer } = useInputCapability();
  const tuning = useGlowTuning();
  // Inside the bezel, when one is drawn: the About is a surface on the page's
  // screen, and the page's screen is the box within the bezel's bands, rounded
  // at its radius. Nothing of the veil or the ring may reach the bezel.
  const { bezel, bezelRadius } = useWallpaper();
  const frame = bezel
    ? { ...BEZEL_INSET, borderRadius: bezelRadius }
    : undefined;
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  // The gutter (screen edge → words, the narrower side) the ring's depth is a
  // share of, and whether the words overflow their container. Measured while
  // open; the gutter is kept after, for the ring's way out.
  const [gutter, setGutter] = useState<number | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const article = articleRef.current;
    const scroll = scrollRef.current;
    if (!dialog || !article || !scroll) return;
    const measure = () => {
      const a = article.getBoundingClientRect();
      const f = dialog.getBoundingClientRect();
      setGutter(Math.max(0, Math.min(a.left - f.left, f.right - a.right)));
      setOverflowing(scroll.scrollHeight > scroll.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(dialog);
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
            {...(bezel ? { [BEZEL_LAYER_ATTRIBUTE]: "" } : {})}
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
                firstTime={!seen}
                keyboard={hasFineHoverPointer}
                onDismiss={close}
              />
            </div>
            <div aria-hidden className="hidden sm:block sm:flex-1" onClick={onBackdrop} />
          </motion.div>
        )}
      </AnimatePresence>
      <Glow
        active={isOpen}
        fixed
        // The bezel's radius inside one; otherwise the screen's own — a
        // phone's is rounded, a browser window's nearly square.
        radius={bezel ? bezelRadius : hasFineHoverPointer ? 10 : 44}
        style={frame}
        layer={bezel}
        // The devtool's Glow module: the About's own strength, and its depth
        // as a share of the gutter — the room between the screen's edge and
        // the words. The light reaches visibly about 2.5× its `reach`, so
        // 20% of a desk's ~450px gutter is a ~36px reach, and a phone's
        // ~36px gutter keeps it to a thin line (never under 8px).
        strength={tuning.aboutStrength}
        reach={gutter === null ? undefined : Math.max(8, (tuning.aboutDepth * gutter) / 2.5)}
        className={cn("z-[10021]", bezel && "overflow-hidden")}
      />
    </>
  );
}

function AboutFoot({
  firstTime,
  keyboard,
  onDismiss,
}: {
  firstTime: boolean;
  keyboard: boolean;
  onDismiss: () => void;
}) {
  const { locale } = useLocale();
  const [before, after] = t(locale, "aboutReopenHint").split("{key}");
  return (
    // The button is the centre of weight; the hint sits under it, kept to
    // about its width so the eye stays on the press.
    <div className="about-foot system-chrome mx-auto flex w-full max-w-[33rem] flex-col items-center">
      {/* Glass, not a slab: the way out is part of the veil it sits on. */}
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          "rounded-full px-5 py-2 text-[13px] font-medium text-foreground",
          GLASS_TRACK_FLAT,
          "active:scale-[0.97] active:duration-0",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        {t(locale, firstTime ? "aboutEnter" : "aboutClose")}
      </button>
      <span className="mt-3 max-w-[12.5rem] text-center text-[11px] leading-relaxed text-tertiary-foreground">
        {keyboard ? (
          <>
            {before}
            <kbd className={cn(TYPE.kbd, "font-sans font-medium")}>O</kbd>
            {after}
          </>
        ) : (
          t(locale, "aboutReopenHintTouch")
        )}
      </span>
    </div>
  );
}
