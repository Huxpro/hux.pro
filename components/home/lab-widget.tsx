"use client";

import { LAB_INDEX, LABS } from "@/systems/lab/catalog";
import { LAB_SURFACES } from "@/systems/lab/surfaces";
import {
  WidgetBody,
  WidgetHeader,
  WidgetIconButton,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
 * LabWidget: one lab at a time, live.
 *
 * The other widgets read out something alive elsewhere (the weather, the
 * music, the current commit). This one shows the site reading itself: each
 * lab's surface (systems/lab/surfaces) is that lab at a glance: the head
 * of the log, the icon down its sizes, the ink ladder over the wallpaper
 * that is painting, the one light. The card opens the lab it shows.
 * The header arrow is the index of labs; the refresh turns to the next one.
 *
 * Rotation is manual only (as the first Lab widget had it): a surface is
 * something to look at, and it should not change under the eye. The order
 * is the catalog's on first paint and shuffled after mount, so the server
 * and the first client render agree.
 */
export function LabWidget() {
  const { locale } = useLocale();
  // Experiences are pieces, played from their own app and their own lab.
  // The widget rotates the studies and the libraries: the site reading itself.
  const specimens = LABS.filter((lab) => lab.kind !== "experience");
  const source = specimens.length > 0 ? specimens : LABS;
  const [order, setOrder] = useState(() => source.map((lab) => lab.id));
  const [index, setIndex] = useState(0);
  const [spinKey, setSpinKey] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount shuffle; see above
    setOrder((o) => shuffle(o));
  }, []);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % order.length);
    setSpinKey((k) => k + 1);
  }, [order.length]);

  const lab = LABS.find((l) => l.id === order[index % order.length]) ?? LABS[0];
  const Surface = LAB_SURFACES[lab.id];

  return (
    <WidgetShell href={lab.href}>
      <WidgetHeader className="pb-3">
        <div className="flex items-center gap-2">
          <WidgetTitle>{t(locale, "widgetLab")}</WidgetTitle>
          <WidgetIconButton label={t(locale, "widgetLabNext")} onClick={next}>
            <RefreshCw
              className="h-3 w-3 transition-transform duration-300"
              style={{ transform: `rotate(${spinKey * 90}deg)` }}
            />
          </WidgetIconButton>
        </div>
        <WidgetLink href={LAB_INDEX.href} label={LAB_INDEX.name[locale]} />
      </WidgetHeader>
      <WidgetBody>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={lab.id}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="h-36">
              <Surface />
            </div>
            <p className="mt-3 flex items-baseline gap-2">
              <span className={cn(TYPE.rowTitle, "shrink-0")}>{lab.name[locale]}</span>
              <span className={cn(TYPE.rowMeta, "truncate")}>{lab.hint[locale]}</span>
            </p>
          </motion.div>
        </AnimatePresence>
      </WidgetBody>
    </WidgetShell>
  );
}
