"use client";

/**
 * The switch between /works' two readings — the places and the log — and
 * the pinned bar the places wear it in.
 *
 *   places   [places] log                          ← alone: text on the page
 *   log      places [log] ⎇ main │ ▣ 11 … │ ≡ ▤ ▦   ← at the head of the
 *                                                     log's own bar
 *
 * Two words in the /writing language filter's chips (`HeaderAction`), since
 * it is the same kind of control: a page with two readings, one of them lit.
 * The log's is a bar of instruments the places have no use for, so the
 * places pin only this — and the same capsule of glass grows in behind it
 * as the page lifts it (`PINNED_PANEL`), so the two bars are one bar at two
 * widths rather than two designs.
 *
 * In the log's bar it has to share a row that was already budgeted to fit a
 * 375px phone (see WorksToolbar), so there it follows that bar's own rule:
 * icon first, the word from `sm` up — a building for the places (the
 * identity's mark elsewhere on the site), a commit for the log.
 */

import { motion, useTransform } from "motion/react";
import { Building2, GitCommitVertical } from "lucide-react";
import { HeaderAction } from "@/components/ui/controls";
import { usePageLift } from "@/components/ui/use-page-lift";
import { t, type Locale } from "@/lib/i18n";
import type { LogReading } from "@/lib/log-view";
import { PINNED_LIFT_PX, PINNED_PANEL } from "./works-toolbar";

const OPTIONS = [
  { value: "places", key: "worksReadingPlaces", icon: Building2 },
  { value: "log", key: "worksReadingLog", icon: GitCommitVertical },
] as const;

export function ReadingSwitch({
  locale,
  reading,
  onChange,
  compact = false,
}: {
  locale: Locale;
  reading: LogReading;
  onChange: (reading: LogReading) => void;
  /** Icons below `sm`, for a row that has no room for the words. */
  compact?: boolean;
}) {
  return (
    <span
      role="group"
      aria-label={t(locale, "worksReadingLabel")}
      className="inline-flex items-center gap-0.5 font-mono text-xs select-none"
    >
      {OPTIONS.map(({ value, key, icon: Icon }) => {
        const name = t(locale, key);
        return (
          <HeaderAction
            key={value}
            active={reading === value}
            onClick={() => onChange(value)}
            label={compact ? name : undefined}
            title={compact ? name : undefined}
            className={compact ? "px-1 sm:px-2" : undefined}
          >
            {compact && <Icon aria-hidden className="h-3.5 w-3.5 sm:hidden" />}
            <span className={compact ? "hidden sm:inline" : undefined}>{name}</span>
          </HeaderAction>
        );
      })}
    </span>
  );
}

/** The places' pinned bar: the switch, on the log bar's glass. */
export function PlacesBar(props: {
  locale: Locale;
  reading: LogReading;
  onChange: (reading: LogReading) => void;
}) {
  const lift = usePageLift(PINNED_LIFT_PX);
  const scale = useTransform(lift, [0, 1], [0.94, 1]);
  return (
    <div className="relative isolate w-max max-w-full">
      <motion.div
        aria-hidden
        className={PINNED_PANEL}
        style={{ opacity: lift, scale }}
      />
      <ReadingSwitch {...props} />
    </div>
  );
}
