"use client";

/**
 * WorksToolbar — the one line under the /works title.
 *
 *   ⎇ main │ ▣ Projects 8  ◔ Talks 12  ◌ Social 3  ▤ Roles 2  ⨯ │ ≡ ▤ ▦
 *   └ ref    └───────────────── pathspec ──────────────────────┘   └ form
 *
 * Three controls, one row, because the row is the budget: this sits in the
 * header zone above a sticky timeline, and anything that wraps to a second
 * line pushes the first commit off the fold on a phone. So every control is
 * icon-first and earns its width — labels appear at `sm` and up, where there
 * is room for them, and the whole bar fits a 375px viewport without.
 *
 * "Fits" is not something this component gets to assume, though: the chip row
 * is derived from the data, so a type nobody has filed anything under yet
 * would add a chip the day it does. The ref and the form control are
 * pinned and the chips take the squeeze — they scroll inside their own group
 * rather than pushing the page sideways. On any real phone it never comes up.
 *
 * The filter is multi-select with a quiet rest state. Nothing selected is
 * "everything", drawn as plain text rather than a row of filled chips, so the
 * default page is not shouting a control at you. The first tap flips the bar
 * into filtering mode: selected chips fill, unselected ones drop to the
 * quaternary rung, and a clear button appears. Tapping the last selected chip
 * off returns to rest — the way out is the same gesture as the way in.
 *
 * The form control is the page's real answer to "everything at once" vs.
 * "see the work" — see `lib/log-view.ts` for what the three stops print. It
 * replaces the old expand/collapse toggle, whose two states were exactly the
 * two extremes this is trying to sit between.
 *
 * The bar is pinned (PageLayout `pinnedActions`): it rests under the title
 * and rides up with the log until it meets the top, then stays, because a
 * filter you have to scroll back for is a filter you stop using. Pinned, it
 * takes over the chapter marker's job too. The ref slot is where `git log`
 * names where you are, so as each chapter's marker scrolls up under the
 * slot the slot wears it — `main` becomes `HEAD`, `HEAD` becomes the era
 * below — and the markers in the log are dividers that hand their pill up
 * rather than a second sticky layer. Tapping the pill goes back to where its
 * chapter starts.
 *
 *    at rest     ⎇ main │ ▣ 8  ◔ 12  ◌ 3  ▤ 2 │ ≡ ▤ ▦
 *    pinned    ╭ (HEAD) │ ▣ 8  ◔ 12  ◌ 3  ▤ 2 │ ≡ ▤ ▦ ╮
 *              ╰──────────────── glass ───────────────╯
 *
 * Off its rest the row travels over the fading title and then over the
 * log, and needs a ground to stay legible, so a capsule of glass grows in
 * behind it — the Live Activity material (docs/system-glass.md), because
 * this is the same kind of thing: a small, live summary of where you are
 * that floats over what you are doing. It grows with the scroll that lifts
 * the row, over the first few pixels, the way a large title hands over to
 * a navigation bar: dragged back to the top, it goes back to text on the
 * page. And it grows in *behind* the row rather than the row moving into
 * it, so nothing you are about to tap shifts.
 */

import { useRef } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { GalleryVertical, GitBranch, LayoutList, List, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/controls";
import { t, type Locale } from "@/lib/i18n";
import {
  getCommitTypePluralLabel,
  type FilterableCommitType,
} from "@/lib/log";
import { LOG_FORMS, type LogForm } from "@/lib/log-view";
import { pageScrollTop, scrollPageTo } from "vitre";
import { usePageLift } from "@/components/ui/use-page-lift";
import { useScrollEdges } from "@/components/ui/use-scroll-edges";
import { CommitIcon } from "./icons";
import { CHAPTER_PILL } from "./log-timeline";
import { useCurrentChapter } from "./use-current-chapter";

export interface TypeFacet {
  type: FilterableCommitType;
  /** How many commits of this type the current locale would show. */
  count: number;
  /**
   * The `icon` override every row of this type is wearing, when they all
   * wear the same one — so the chip carries the mark you will actually see
   * in the list. Today every visible `role` is an education entry flagged
   * `graduation-cap`, and a briefcase on that chip would be a small lie.
   * Unset the moment the rows disagree, and the type's own icon returns.
   */
  iconOverride?: string;
}

interface WorksToolbarProps {
  locale: Locale;
  /** Every selectable type with rows on the page, and its unfiltered count.
   *  Derived from the data, so a type nothing is filed under gets no chip. */
  facets: TypeFacet[];
  /** Selected types; empty is "no filter" (see lib/log-view). */
  active: FilterableCommitType[];
  onToggleType: (type: FilterableCommitType) => void;
  onClearTypes: () => void;
  form: LogForm;
  onFormChange: (form: LogForm) => void;
  /** The chapters on the page, in order, with the marker each wears. */
  chapters: readonly { id: string; label: string }[];
}

/**
 * What each form wears and what it is called. One table rather than one per
 * attribute, so a fifth form is one row here; what each form *prints* is
 * `ROW_FORM` in `lib/log-view.ts` — that module is deliberately React-free,
 * and an icon is a component.
 */
const FORM_CHIP: Record<
  LogForm,
  {
    icon: LucideIcon;
    labelKey: "logFormIndex" | "logFormCovers" | "logFormFeed";
  }
> = {
  // Lines only; lines with a cover block; full panels. The glyphs climb in
  // visual weight the way the forms climb in detail.
  index: { icon: List, labelKey: "logFormIndex" },
  covers: { icon: LayoutList, labelKey: "logFormCovers" },
  feed: { icon: GalleryVertical, labelKey: "logFormFeed" },
};

/**
 * The ground the pinned row stands on: a Dock Live Activity pill's own
 * recipe (systems/dock/components/live-activity.tsx), blur included on a
 * phone. The two float one over the other, and a capsule that is more
 * see-through than the pill above it reads as a lesser thing — measured on
 * iOS without the blur, the log's text showed through between the counts.
 */
const PANEL = cn(
  "pointer-events-none absolute -inset-x-2.5 -inset-y-1.5 -z-10 rounded-full",
  "border border-border/50 bg-glass backdrop-blur-xl shadow-raised",
);

/** How much scroll it takes the capsule to grow in: the row has left its
 *  rest by then, and is not yet over the log. */
const LIFT_PX = 32;

/** A quick, settled spring for one ref handing over to the next. */
const SETTLE = { type: "spring", duration: 0.4, bounce: 0.12 } as const;

export function WorksToolbar({
  locale,
  facets,
  active,
  onToggleType,
  onClearTypes,
  form,
  onFormChange,
  chapters,
}: WorksToolbarProps) {
  const filtering = active.length > 0;
  const reduced = useReducedMotion() ?? false;
  const slotRef = useRef<HTMLSpanElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const more = useScrollEdges(chipsRef);
  const current = useCurrentChapter(
    slotRef,
    chapters.map((c) => c.id),
  );
  const chapter = chapters.find((c) => c.id === current.id) ?? null;
  const motionOf = reduced ? { duration: 0 } : SETTLE;
  const lift = usePageLift(LIFT_PX);
  const panelScale = useTransform(lift, [0, 1], [0.94, 1]);

  /** Back to where the chapter starts: its marker lined up under the slot,
   *  the frame where the slot takes it over. */
  const toChapterStart = (id: string) => {
    const slot = slotRef.current;
    const marker = document.querySelector<HTMLElement>(
      `[data-chapter="${id}"]`,
    );
    if (!slot || !marker) return;
    const s = slot.getBoundingClientRect();
    const m = marker.getBoundingClientRect();
    const to =
      pageScrollTop() + (m.top + m.height / 2) - (s.top + s.height / 2);
    scrollPageTo(Math.max(0, to), { behavior: reduced ? "auto" : "smooth" });
  };

  return (
    // `isolate` so the panel's `-z-10` sits behind this row and not behind
    // the page. `w-max`, bounded by the column: the capsule hugs what it
    // holds rather than spanning a row that is mostly empty on a desk.
    <div className="relative isolate w-max max-w-full">
      <motion.div
        aria-hidden
        className={PANEL}
        // Grows out from the row it is catching, as far as the page has
        // lifted it.
        style={{ opacity: lift, scale: panelScale }}
      />

      <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs text-tertiary-foreground">
        {/* The ref we are reading — `main` above the first chapter, the
            chapter once its marker reaches here. Not a control at rest: the
            anchor the rest of the row hangs off, and the reason the page
            reads as a git log. */}
        {/* One grid cell that both refs share while they hand over, so the
            outgoing one leaves from exactly where the incoming one arrives
            and nothing has to be measured out of the flow first. */}
        <span
          ref={slotRef}
          className="grid shrink-0 items-center justify-items-start *:[grid-area:1/1]"
        >
          <AnimatePresence initial={false} custom={current.dir}>
            {chapter ? (
              <motion.button
                key={chapter.id}
                type="button"
                custom={current.dir}
                variants={HANDOVER}
                initial="enter"
                animate="center"
                exit="leave"
                transition={motionOf}
                onClick={() => toChapterStart(chapter.id)}
                title={t(locale, "logChapterStart")}
                aria-label={`${chapter.label} — ${t(locale, "logChapterStart")}`}
                className={cn(
                  CHAPTER_PILL,
                  "pressable border-border transition-colors hover:border-foreground/30",
                )}
              >
                {chapter.label}
              </motion.button>
            ) : (
              <motion.span
                key="main"
                custom={current.dir}
                variants={HANDOVER}
                initial="enter"
                animate="center"
                exit="leave"
                transition={motionOf}
                className="inline-flex items-center gap-1.5"
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>main</span>
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        {/* The rest of the row moves over as the ref changes width, rather
            than jumping on the frame the pill changes. */}
        <motion.div
          layout="position"
          transition={motionOf}
          className="flex min-w-0 items-center gap-2 sm:gap-3"
        >
          <Divider />

          {/* Pathspec: what is in this reading of the log. */}
          <div
            ref={chipsRef}
            role="group"
            aria-label={t(locale, "logFilterLabel")}
            className={cn(
              "flex items-center gap-0.5 min-w-0 overflow-x-auto no-scrollbar",
              // Squeezed (a long chapter in the ref slot, a narrow phone),
              // the chips scroll, and the edge they are cut at fades so a
              // chip cut in half reads as more this way, not as broken.
              more.start && more.end
                ? "[mask-image:linear-gradient(to_right,transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)]"
                : more.end
                  ? "[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)]"
                  : more.start &&
                    "[mask-image:linear-gradient(to_right,transparent,#000_1.5rem)]",
            )}
          >
            {facets.map(({ type, count, iconOverride }) => {
              const selected = active.includes(type);
              const label = getCommitTypePluralLabel(type, locale);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleType(type)}
                  aria-pressed={selected}
                  aria-label={`${label} (${count})`}
                  title={label}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1",
                    "transition-colors duration-200",
                    selected
                      ? "bg-muted text-foreground"
                      : filtering
                        ? // Filtering: unselected types recede hard, so the
                          // selection reads at a glance from across the row.
                          "text-quaternary-foreground hover:text-muted-foreground"
                        : // Rest: every type legible, nothing filled.
                          "text-tertiary-foreground hover:text-foreground",
                  )}
                >
                  {/* The same mark the rows wear, so a chip and the rows it
                  selects are never wearing different ones. */}
                  <CommitIcon
                    type={type}
                    override={iconOverride}
                    className="h-3 w-3 shrink-0"
                  />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="tabular-nums">{count}</span>
                </button>
              );
            })}

            {/* Appears only while filtering, so it costs no width at rest. */}
            {filtering && (
              <button
                type="button"
                onClick={onClearTypes}
                aria-label={t(locale, "logFilterClear")}
                title={t(locale, "logFilterClear")}
                className="ml-0.5 inline-flex shrink-0 items-center justify-center rounded p-1 text-tertiary-foreground transition-colors duration-200 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <Divider />

          {/* Form. Segmented rather than a cycling button: three stops is one
          too many to discover by tapping, and every form stays one tap away.
          Each stop resets every row to a preset (`ROW_FORM`), which is all
          a form is. */}
          <Segmented
            tone="bare"
            label={t(locale, "logFormLabel")}
            value={form}
            onChange={onFormChange}
            options={LOG_FORMS.map((f) => {
              const { icon: Icon, labelKey } = FORM_CHIP[f];
              const name = t(locale, labelKey);
              return {
                value: f,
                label: <Icon className="h-3.5 w-3.5" />,
                ariaLabel: name,
                title: name,
              };
            })}
          />
        </motion.div>
      </div>
    </div>
  );
}

/**
 * How one ref hands over to the next: the incoming one arrives from the
 * side the page is moving from — from below reading on, as the marker came
 * up from below — and the outgoing one leaves the other way.
 */
const HANDOVER = {
  enter: (dir: 1 | -1) => ({ opacity: 0, y: 8 * dir }),
  center: { opacity: 1, y: 0 },
  leave: (dir: 1 | -1) => ({ opacity: 0, y: -8 * dir }),
};

/** Hairline between control groups — quaternary, because it carries nothing. */
function Divider() {
  return <span aria-hidden className="h-3 w-px shrink-0 bg-border" />;
}
