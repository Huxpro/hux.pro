"use client";

import { MagicLinkHost } from "@/components/magic-link";
import { TYPE } from "@/lib/typography";
import { GLASS_TRACK_FLAT } from "@/systems/theater/lib/chrome";
import { cn } from "@/lib/utils";
import { t, useInputCapability, useLocale } from "@/services";
import { useWallpaper } from "@/systems/ambient";
import { useBreakpointValue } from "@/systems/surface";
import { AnimatePresence, motion } from "motion/react";
import { BEZEL_INSET, VITRE_LAYER_ATTRIBUTE } from "vitre";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type Ref,
  type ReactNode,
} from "react";
import { ABOUT_GLOW_Z, ABOUT_Z, OVER_ABOUT_Z, useAbout } from "../provider";
import { EdgeGlow, Glow, useGlowTuning } from "@/systems/glow";
import { AboutLanguageSwitch } from "./about-language";

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
// hands the stage to what it opened (MagicLinkHost).
//
// It sits above the theater and windows (z 10000–10005) and below the
// command palette (10050), which can still be summoned over it.
// =============================================================================

export interface AboutSurfaceProps {
  en: ReactNode;
  zh: ReactNode;
}

/**
 * How far around the words (and the way out) a click still counts as a miss
 * rather than a way out: a generous column margin, about the width of a
 * hand's slip beside a line. Past it, towards the screen's edges, a click
 * closes. Pointer only — see `onBackdrop`.
 */
const MISS_MARGIN_X = 96;
const MISS_MARGIN_Y = 64;

export function AboutSurface({ en, zh }: AboutSurfaceProps) {
  const { isOpen, dismiss, close, seen } = useAbout();
  // Whether this showing is the newcomer's first, held while it is up —
  // dismissing marks the visitor as met at once, and the way out must not
  // turn from Reveal to Close as it leaves.
  const [firstTime, setFirstTime] = useState(!seen);
  if (isOpen && firstTime !== !seen) setFirstTime(!seen);
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

  // Pressing outside the words puts the About away — but only where that is
  // what the press meant. On a touch screen, never: a phone's About is the
  // whole screen, every blank stretch of it is a thumb resting between
  // lines, and the way out is the button at its foot. With a pointer, not
  // near the words either: a click in the column's margin is a reader
  // steadying a selection or missing a link, not leaving. Out towards the
  // edges of the screen, well clear of the text, a click is a deliberate
  // gesture — there it closes, as clicking beside a sheet does.
  const onBackdrop = (e: MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (!hasFineHoverPointer) return;
    const near = [articleRef.current, footRef.current].some((el) => {
      const r = el?.getBoundingClientRect();
      if (!r) return false;
      return (
        e.clientX > r.left - MISS_MARGIN_X &&
        e.clientX < r.right + MISS_MARGIN_X &&
        e.clientY > r.top - MISS_MARGIN_Y &&
        e.clientY < r.bottom + MISS_MARGIN_Y
      );
    });
    if (!near) dismiss();
  };

  // A plain link in the copy navigates; the About steps aside for it. Magic
  // links do the same through MagicLinkHost, since they may open no page —
  // or a drawer, which floats over the About instead.
  const onCopyClick = (e: MouseEvent) => {
    const anchor = (e.target as Element).closest("a");
    if (!anchor || anchor.dataset.magicLink) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    // A path on this site takes the screen; a page elsewhere opens a tab,
    // and the About is here as it was on the way back.
    if (anchor.getAttribute("href")?.startsWith("/")) close();
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
            className="fixed inset-0 flex flex-col overflow-hidden outline-none"
            style={{ ...frame, zIndex: ABOUT_Z }}
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
                  // A document over the home screen, whose selection lock
                  // (useLockTextSelection) would otherwise take its words.
                  data-text-document=""
                  lang={locale === "zh" ? "zh" : "en"}
                  // Set as an article is (`.prose-article`, globals.css):
                  // the reader's size, 1.75 lines, the article's ink, a
                  // paragraph and a half apart — so the About reads as the
                  // site's prose, not a type of its own.
                  className="about-copy relative w-full max-w-[33rem] space-y-[calc(var(--reading-size)*1.5)] text-[length:var(--reading-size)] leading-[1.75] text-foreground/85"
                  initial={{ y: 10, scale: 0.985 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: 6, scale: 0.99 }}
                  transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                  onClickCapture={onCopyClick}
                >
                  {/* The other language, on a phone: at the words' top-right
                      corner, level with the top of the greeting, a little in
                      from their right edge, scrolling away with them (the
                      foot's middle is the way out's). On a desk it is at the
                      words' bottom-right instead, in the foot's row
                      (AboutFoot). Its own layer, so the greeting it sits
                      beside never takes its press.
                      Level by the ink, not the boxes: from the same line top,
                      the switch's small glyphs start lower than the
                      greeting's capitals, and lower still than a Chinese
                      greeting's taller characters, so the switch rises by
                      the difference (measured on the page: 0.11em, 0.25em
                      in Chinese) and the tops of the two meet. */}
                  <div className="absolute right-3 top-[-0.11em] z-10 sm:hidden [&:lang(zh)]:top-[-0.25em]">
                    <AboutLanguageSwitch />
                  </div>
                  <MagicLinkHost onLaunch={close} layer={OVER_ABOUT_Z}>
                    {locale === "zh" ? zh : en}
                  </MagicLinkHost>
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
                firstTime={firstTime}
                keyboard={hasFineHoverPointer}
                onDismiss={dismiss}
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
        motion={tuning.aboutMotion}
        baseline={tuning.aboutBaseline ?? undefined}
        strength={tuning.aboutStrength}
        radius={screenRadius}
        style={{ ...frame, zIndex: ABOUT_GLOW_Z }}
        layer={bezel}
        className={cn(bezel && "overflow-hidden")}
      />
    </>
  );
}

/** The About's two layouts: a centred group on a desk (`sm` and up), the
 *  whole screen on a phone. Read at once, not after an effect: the About
 *  only ever renders on the client, once it has been opened. */
const DESK = { base: false, sm: true } as const;
function useDeskLayout(): boolean {
  return useBreakpointValue(DESK, { immediate: true });
}

function AboutFoot({
  firstTime,
  keyboard,
  onDismiss,
  ref,
}: {
  /** A newcomer's first meeting: until the About is first dismissed. */
  firstTime: boolean;
  keyboard: boolean;
  onDismiss: () => void;
  ref?: Ref<HTMLDivElement>;
}) {
  const { locale } = useLocale();
  return (
    // On a phone the way out is centred at the screen's foot. On a desk it
    // hangs from the words' left edge, as their last line (centred under a
    // ragged paragraph it would line up with nothing), and the other
    // language closes the row at their right edge: the words' bottom-right
    // corner. How to come back is the words' own last sentence, not a line
    // here.
    <div
      ref={ref}
      className="about-foot system-chrome mx-auto flex w-full max-w-[33rem] flex-col items-center sm:flex-row sm:items-center sm:justify-between"
    >
      {/* Glass, not a slab: the way out is part of the veil it sits on.
          On a first visit it is Reveal (the veil lifts off the page the
          newcomer landed on) and it breathes — the glow's pulse, blooming
          out from behind it — the one thing on the screen asking to be
          pressed. After that it is a plain Close. Where there is a
          keyboard it wears its key, Esc: the key's cap has an edge of its
          own, so the pill needs less room after it than before the word
          (16px, not 20) to look even. */}
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          "relative inline-flex items-center gap-2.5 rounded-full py-2 text-[13px] font-medium text-foreground",
          keyboard ? "pr-4 pl-5" : "px-5",
          GLASS_TRACK_FLAT,
          "active:scale-[0.97] active:duration-0",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        {t(locale, firstTime ? "aboutEnter" : "aboutClose")}
        {keyboard && (
          <kbd aria-hidden className={cn(TYPE.kbd, "px-1.5 py-0 text-[10px] leading-5")}>
            esc
          </kbd>
        )}
        <Glow active={firstTime} motion="pulse" inside={false} bleed={14} reach={3} strength={0.9} />
      </button>
      {/* The row's mirror, nearly: the way out's pill touches the words'
          left edge, and the switch's label stands just in from their right
          (4px). Its chip (painted only under a pointer) cancels its own
          padding, so the label is what is measured, and the chip, when it
          shows, reaches about as far as the pill's glass does on the left. */}
      <div className="me-1 hidden sm:block">
        <AboutLanguageSwitch />
      </div>
    </div>
  );
}
