"use client";

import { labDemos, labWidgetDemos } from "@/components/lab/registry";
import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetStatus,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "next-view-transitions";
import { useCallback, useEffect, useState } from "react";

/** Fisher-Yates shuffle (returns new array) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fadeVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

/**
 * LabWidget — "living vitrine".
 *
 * Unlike the other dashboard widgets, which read out the state of something
 * alive elsewhere (weather, music, current commit), this one *is* the live
 * thing: a real lab demo runs in place, fully interactive.
 *
 * The canvas is intentionally NOT a link, so poking the demo never navigates
 * away. Navigation lives in the header arrow (→ /lab) and the filename caption
 * (→ that demo's page). A refresh button cycles the featured demo, à la the
 * prompt widget — manual only, so rotation never interrupts interaction.
 *
 * To avoid hydration mismatch, the order is deterministic on first paint and
 * shuffled after mount.
 */
export function LabWidget() {
  const { locale } = useLocale();

  const [order, setOrder] = useState<string[]>(labWidgetDemos);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (labWidgetDemos.length > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrder(shuffle(labWidgetDemos));
    }
  }, []);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % order.length);
  }, [order.length]);

  if (order.length === 0) return null;

  const slug = order[index % order.length];
  const Demo = labDemos[slug];
  if (!Demo) return null;

  const canRotate = order.length > 1;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-3">
        <div className="flex items-center gap-2">
          <WidgetStatus />
          <WidgetTitle>{t(locale, "widgetLab")}</WidgetTitle>
          {canRotate && (
            <button
              onClick={advance}
              className={cn(
                "text-muted-foreground hover:text-foreground text-xs",
                "transition-colors duration-200 select-none"
              )}
              aria-label="Next demo"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
        <WidgetLink href="/lab" label="View lab" />
      </WidgetHeader>
      <WidgetBody>
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="h-44 overflow-hidden rounded-xl border border-border/60">
            <AnimatePresence mode="wait">
              <motion.div
                key={slug}
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full"
              >
                <Demo />
              </motion.div>
            </AnimatePresence>
          </div>
          <Link
            href={`/lab/${slug}/${locale}`}
            aria-label={`Open ${slug} in the lab`}
            className="mt-2.5 inline-block font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <TextScramble
              trigger={true}
              duration={0.4}
              speed={0.02}
              characterSet="λabcdefghijklmnopqrstuvwxyz/.~-_"
              as="span"
              className="inline-block pointer-events-none"
            >
              {hovered ? `open ${slug}.tsx` : `${slug}.tsx`}
            </TextScramble>
          </Link>
        </div>
      </WidgetBody>
    </WidgetShell>
  );
}
