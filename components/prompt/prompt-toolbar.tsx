"use client";

/**
 * PromptToolbar — the one line under the /prompt title.
 *
 *   λ system │ ◆ Convictions 20  ◇ Influences 5 │ architecture 3  craft 3 … ⨯
 *   └ ref      └──────────── kind ─────────────┘   └────────── topics ──────┘
 *
 * The same instrument as the /works toolbar (components/log/works-toolbar),
 * and deliberately so: both pages are a long single column of small records,
 * and a reader who has learned the bar on one should not have to learn it
 * again on the other. What differs is what the two axes are. /works filters
 * by the type of a commit and picks a density; here the page carries no
 * density (an entry is a sentence, and it either prints or it doesn't), so
 * the second group is the other axis the data actually has — the topic each
 * entry sits `on`.
 *
 * The ref slot holds `system`, because that is the element this whole page
 * is the body of, and because the slot is what makes the row read as a
 * header rather than as a widget. It stays static: /works animates a
 * chapter into its slot as the log scrolls, but the chapters of this page
 * are already on the bar. The topics are its reading order (`lib/prompt-
 * view`) — 天行, then 修身, then 行事, and then the people behind them — so
 * the chip for the one you are in is the place to say where you are.
 *
 *   <system> │ ◆ 13  ◇ 8 │ 天行 4  修身 4  行事 5
 *                                  ‾‾‾‾‾‾
 *
 * It goes to full ink and wears a hairline under it, and the hairline
 * travels to the next chip as the next chapter reaches the middle of the
 * view, where the spotlight is (`useReadingChapter`). Past the last shelf it
 * travels on to ◇, because the influences are the page's fourth run even
 * though they sit on no shelf. The mark is not the filter's: a selected
 * chip fills, a read one is underlined, and a chip can be both.
 *
 * Rest state is quiet, the way it is on /works: nothing selected is
 * "everything", drawn as plain text rather than a row of filled chips. The
 * first tap flips the bar into filtering — selected chips fill, unselected
 * ones drop to the quaternary rung, and a clear button appears. Tapping the
 * last one off returns to rest.
 *
 * Pinned (PageLayout `pinnedActions`), the row rides up with the page until
 * it meets the top and stays, and a capsule of glass grows in behind it over
 * the first 32px of lift — the Live Activity material, same as /works, for
 * the same reason: off its rest the row travels over the text and needs a
 * ground to stay legible.
 */

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, useTransform } from "motion/react";
import { Diamond, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import {
  PROMPT_KINDS,
  topicLabel,
  type PromptKind,
  type PromptTopic,
} from "@/lib/prompt-view";
import { usePageLift } from "@/components/ui/use-page-lift";
import { useScrollEdges } from "@/components/ui/use-scroll-edges";
import { useReadingChapter, type PromptChapter } from "./use-reading-chapter";

export interface KindFacet {
  kind: PromptKind;
  /** How many entries of this kind the page holds, unfiltered. */
  count: number;
}

export interface TopicFacet {
  topic: PromptTopic;
  count: number;
}

interface PromptToolbarProps {
  locale: Locale;
  kindFacets: KindFacet[];
  topicFacets: TopicFacet[];
  activeKinds: PromptKind[];
  activeTopics: PromptTopic[];
  onToggleKind: (kind: PromptKind) => void;
  onToggleTopic: (topic: PromptTopic) => void;
  onClear: () => void;
}

/** The ground the pinned row stands on — the /works capsule, unchanged. */
const PANEL = cn(
  "pointer-events-none absolute -inset-x-2.5 -inset-y-1.5 -z-10 rounded-full",
  "border border-border/50 bg-glass backdrop-blur-xl shadow-raised",
);

/** How much scroll it takes the capsule to grow in. */
const LIFT_PX = 32;

/** The reading mark moving from one chip to the next — the /works ref's
 *  handover spring, so the two bars settle the same way. */
const SETTLE = { type: "spring", duration: 0.4, bounce: 0.12 } as const;

/**
 * A conviction is filled, an influence is hollow: the same mark at two
 * weights, because the two are the same kind of thing seen from either end
 * — what I hold, and who handed it to me.
 */
const KIND_MARK: Record<PromptKind, string> = {
  conviction: "fill-current",
  influence: "fill-none",
};

const KIND_LABEL: Record<PromptKind, "promptKindConvictions" | "promptKindInfluences"> = {
  conviction: "promptKindConvictions",
  influence: "promptKindInfluences",
};

export function PromptToolbar({
  locale,
  kindFacets,
  topicFacets,
  activeKinds,
  activeTopics,
  onToggleKind,
  onToggleTopic,
  onClear,
}: PromptToolbarProps) {
  const filtering = activeKinds.length > 0 || activeTopics.length > 0;
  const topicsRef = useRef<HTMLDivElement>(null);
  const more = useScrollEdges(topicsRef);
  const lift = usePageLift(LIFT_PX);
  const panelScale = useTransform(lift, [0, 1], [0.94, 1]);
  const reduced = useReducedMotion() ?? false;
  const reading = useReadingChapter();

  // Squeezed on a phone, the topics scroll inside their group, and the one
  // being read may be the one cut off at the edge. Bring it in — the group
  // only, by hand, since `scrollIntoView` would also move the page.
  useEffect(() => {
    const group = topicsRef.current;
    const chip = group?.querySelector<HTMLElement>("[aria-current]");
    if (!group || !chip) return;
    const start = chip.offsetLeft - group.offsetLeft;
    const end = start + chip.offsetWidth;
    const fade = 24; // the mask's width: a chip under it reads as cut
    const left =
      start - fade < group.scrollLeft
        ? start - fade
        : end + fade > group.scrollLeft + group.clientWidth
          ? end + fade - group.clientWidth
          : null;
    if (left !== null)
      group.scrollTo({
        left: Math.max(0, left),
        behavior: reduced ? "auto" : "smooth",
      });
  }, [reading, reduced]);

  /** One chip, at the states the row has: selected, receding while
   *  something else is selected, at rest — and, on top of any of them,
   *  being read. */
  const chipClass = (selected: boolean, current: boolean) =>
    cn(
      "relative inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1",
      "transition-colors duration-200",
      selected
        ? "bg-muted text-foreground"
        : current
          ? "text-foreground"
          : filtering
            ? "text-quaternary-foreground hover:text-muted-foreground"
            : "text-tertiary-foreground hover:text-foreground",
    );

  /** Where the reader is: one hairline under one chip, travelling. */
  const readingMark = (chapter: PromptChapter) =>
    reading === chapter && (
      <motion.span
        aria-hidden
        layoutId="prompt-reading"
        transition={reduced ? { duration: 0 } : SETTLE}
        className="absolute inset-x-1.5 bottom-0 h-px rounded-full bg-foreground"
      />
    );

  return (
    <div className="relative isolate w-max max-w-full">
      <motion.div
        aria-hidden
        className={PANEL}
        style={{ opacity: lift, scale: panelScale }}
      />

      <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs text-tertiary-foreground">
        {/* The element this page is the body of. Not a control. */}
        <span className="shrink-0 select-none">&lt;system&gt;</span>

        <Divider />

        {/* Kind: what I hold vs. who trained it. */}
        <div
          role="group"
          aria-label={t(locale, "promptKindLabel")}
          className="flex shrink-0 items-center gap-0.5"
        >
          {PROMPT_KINDS.map((kind) => {
            const facet = kindFacets.find((f) => f.kind === kind);
            if (!facet) return null;
            const selected = activeKinds.includes(kind);
            // Only the influences are a chapter; the convictions are read
            // through their topics, one group over.
            const current = kind === "influence" && reading === "influence";
            const label = t(locale, KIND_LABEL[kind]);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => onToggleKind(kind)}
                aria-pressed={selected}
                aria-current={current ? "location" : undefined}
                aria-label={`${label} (${facet.count})`}
                title={label}
                className={chipClass(selected, current)}
              >
                <Diamond className={cn("h-3 w-3 shrink-0", KIND_MARK[kind])} />
                <span className="hidden sm:inline">{label}</span>
                <span className="tabular-nums">{facet.count}</span>
                {kind === "influence" && readingMark("influence")}
              </button>
            );
          })}
        </div>

        <Divider />

        {/* Topics. Wordmarks rather than icons — six shelves would need six
            glyphs nobody has learned, and the words are the point. */}
        <motion.div
          ref={topicsRef}
          // The mark travels in and out of a group that scrolls sideways;
          // this is what lets it measure through that scroll.
          layoutScroll
          role="group"
          aria-label={t(locale, "promptTopicLabel")}
          className={cn(
            "flex items-center gap-0.5 min-w-0 overflow-x-auto no-scrollbar",
            // Squeezed on a phone the topics scroll, and the edge they are
            // cut at fades, so a half-cut chip reads as more this way.
            more.start && more.end
              ? "[mask-image:linear-gradient(to_right,transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)]"
              : more.end
                ? "[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)]"
                : more.start &&
                  "[mask-image:linear-gradient(to_right,transparent,#000_1.5rem)]",
          )}
        >
          {topicFacets.map(({ topic, count }) => {
            const selected = activeTopics.includes(topic);
            const current = reading === topic;
            const label = topicLabel(topic, locale);
            return (
              <button
                key={topic}
                type="button"
                onClick={() => onToggleTopic(topic)}
                aria-pressed={selected}
                aria-current={current ? "location" : undefined}
                aria-label={`${label} (${count})`}
                title={label}
                className={chipClass(selected, current)}
              >
                <span>{label}</span>
                <span className="tabular-nums">{count}</span>
                {readingMark(topic)}
              </button>
            );
          })}

          {/* Costs no width at rest. */}
          {filtering && (
            <button
              type="button"
              onClick={onClear}
              aria-label={t(locale, "promptFilterClear")}
              title={t(locale, "promptFilterClear")}
              className="ml-0.5 inline-flex shrink-0 items-center justify-center rounded p-1 text-tertiary-foreground transition-colors duration-200 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/** Hairline between control groups — quaternary, because it carries nothing. */
function Divider() {
  return <span aria-hidden className="h-3 w-px shrink-0 bg-border" />;
}
