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
 * The ref slot holds `<system>`, because that is the element this whole
 * page is the body of, and because the slot is what makes the row read as a
 * header rather than as a widget. And like the ref slot on /works, it says
 * where you are. The page is a system prompt, and its chapters are its
 * elements in reading order — 天行, 修身, 行事, and then the people behind
 * them — so once the entries start passing under the bar, the slot wears
 * the element you are inside:
 *
 *    at the title   <system>     │ ◆ 13  ◇ 8 │ 天行 4  修身 4  行事 5
 *    reading on   ╭ <修身>       │ ◆ 13  ◇ 8 │ 天行 4  修身 4  行事 5 ╮
 *
 * "Inside" is the entry in the middle of the view, where the spotlight is
 * (`useReadingChapter`), so the bar and the one lit sentence always agree.
 * The name is the topic's own — the English id, which is also what the
 * data calls it, and the Chinese label on the Chinese page, where an
 * element may be called 修身 as well as anything else. Tapping it goes back
 * to where that chapter starts, as the /works pill does.
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

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { Diamond, X } from "lucide-react";
import { GLASS_CAPSULE } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import {
  PROMPT_KINDS,
  PROMPT_TOPICS,
  topicLabel,
  type PromptKind,
  type PromptTopic,
} from "@/lib/prompt-view";
import { usePageLift } from "@/components/ui/use-page-lift";
import { useNoticeYield } from "@/components/ui/use-notice-yield";
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
  GLASS_CAPSULE,
  // `--pin-outset` (globals.css): PageLayout pins the bar by its glass.
  "pointer-events-none absolute -inset-x-2.5 inset-y-[calc(var(--pin-outset)*-1)] -z-10",
);

/** How much scroll it takes the capsule to grow in. */
const LIFT_PX = 32;

/** One element handing over to the next — the /works ref's spring, so the
 *  two bars settle the same way. */
const SETTLE = { type: "spring", duration: 0.4, bounce: 0.12 } as const;

/** Reading order, with the page itself before the first chapter. */
const ORDER: readonly (PromptChapter | null)[] = [
  null,
  ...PROMPT_TOPICS,
  "influence",
];

/**
 * A conviction is filled, an influence is hollow: the same mark at two
 * weights, because the two are the same kind of thing seen from either end
 * — what I hold, and who handed it to me.
 */
const KIND_MARK: Record<PromptKind, string> = {
  conviction: "fill-current",
  influence: "fill-none",
};

const KIND_LABEL: Record<
  PromptKind,
  "promptKindConvictions" | "promptKindInfluences"
> = {
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
  // Steps aside for a Dock notice it would sit under (use-notice-yield).
  // The fade goes on the capsule and on the row, never on the box holding
  // the capsule; the box takes only the transform and the pointer.
  const rootRef = useRef<HTMLDivElement>(null);
  const away = useNoticeYield(rootRef);
  const panelOpacity = useTransform(() => lift.get() * (1 - away.get()));
  const rowOpacity = useTransform(away, [0, 1], [1, 0]);
  const rootY = useTransform(away, [0, 1], [0, -6]);
  const rootScale = useTransform(away, [0, 1], [1, 0.96]);
  const rootPointer = useTransform(away, (a) => (a > 0.5 ? "none" : "auto"));
  const reduced = useReducedMotion() ?? false;
  const motionOf = reduced ? { duration: 0 } : SETTLE;
  const rowRef = useRef<HTMLDivElement>(null);
  const reading = useReadingChapter(rowRef);

  // Which way the reader went, for which way the element hands over:
  // reading on, the next one comes up from below, as the entries do.
  const [shown, setShown] = useState(reading);
  const [dir, setDir] = useState<1 | -1>(1);
  if (reading !== shown) {
    setShown(reading);
    setDir(ORDER.indexOf(reading) >= ORDER.indexOf(shown) ? 1 : -1);
  }

  /** The element's name as this page prints it: the id in English, the
   *  label in Chinese. */
  const tagOf = (chapter: PromptChapter) =>
    chapter === "influence"
      ? t(locale, "promptKindInfluences").toLowerCase()
      : locale === "zh"
        ? topicLabel(chapter, locale)
        : chapter;

  /** Back to where the chapter starts: its first entry, seated where a
   *  link to it would seat it. */
  const toChapterStart = (chapter: PromptChapter) =>
    document
      .querySelector<HTMLElement>(`main [data-chapter="${chapter}"]`)
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });

  /** One chip, at the three states the row has: selected, receding while
   *  something else is selected, and at rest. */
  const chipClass = (selected: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1",
      "transition-colors duration-200",
      selected
        ? "bg-muted text-foreground"
        : filtering
          ? "text-quaternary-foreground hover:text-muted-foreground"
          : "text-tertiary-foreground hover:text-foreground",
    );

  return (
    <motion.div
      ref={rootRef}
      className="relative isolate w-max max-w-full origin-top"
      style={{ y: rootY, scale: rootScale, pointerEvents: rootPointer }}
    >
      <motion.div
        aria-hidden
        className={PANEL}
        style={{ opacity: panelOpacity, scale: panelScale }}
      />

      <motion.div
        ref={rowRef}
        style={{ opacity: rowOpacity }}
        className="flex items-center gap-2 sm:gap-3 font-mono text-xs text-tertiary-foreground"
      >
        {/* The element you are inside: the page's own at the title, a
            chapter's once you are reading one. One grid cell that both
            share while they hand over, so the outgoing one leaves from
            exactly where the incoming one arrives. */}
        <span className="grid shrink-0 items-center justify-items-start *:[grid-area:1/1]">
          <AnimatePresence initial={false} custom={dir}>
            {reading ? (
              <motion.button
                key={reading}
                type="button"
                custom={dir}
                variants={HANDOVER}
                initial="enter"
                animate="center"
                exit="leave"
                transition={motionOf}
                onClick={() => toChapterStart(reading)}
                title={t(locale, "logChapterStart")}
                aria-label={`${tagOf(reading)} — ${t(locale, "logChapterStart")}`}
                // One rung above the row, brackets and all: a tag is one
                // word, and the row's tertiary is what `<system>` wore, so
                // the element you are inside stands one step out of it —
                // secondary, the rung mono metadata takes when it stands
                // alone (`lib/typography`). Full ink is the pointer's.
                className="pressable select-none whitespace-pre text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                &lt;{tagOf(reading)}&gt;
              </motion.button>
            ) : (
              // The element this page is the body of. Not a control.
              <motion.span
                key="system"
                custom={dir}
                variants={HANDOVER}
                initial="enter"
                animate="center"
                exit="leave"
                transition={motionOf}
                className="select-none"
              >
                &lt;system&gt;
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        {/* The rest of the row moves over as the element's name changes
            width, rather than jumping on the frame it changes. */}
        <motion.div
          layout="position"
          transition={motionOf}
          className="flex min-w-0 items-center gap-2 sm:gap-3"
        >
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
              const label = t(locale, KIND_LABEL[kind]);
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onToggleKind(kind)}
                  aria-pressed={selected}
                  aria-label={`${label} (${facet.count})`}
                  title={label}
                  className={chipClass(selected)}
                >
                  <Diamond
                    className={cn("h-3 w-3 shrink-0", KIND_MARK[kind])}
                  />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="tabular-nums">{facet.count}</span>
                </button>
              );
            })}
          </div>

          <Divider />

          {/* Topics. Wordmarks rather than icons — six shelves would need six
            glyphs nobody has learned, and the words are the point. */}
          <div
            ref={topicsRef}
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
              const label = topicLabel(topic, locale);
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onToggleTopic(topic)}
                  aria-pressed={selected}
                  aria-label={`${label} (${count})`}
                  title={label}
                  className={chipClass(selected)}
                >
                  <span>{label}</span>
                  <span className="tabular-nums">{count}</span>
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
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/**
 * How one element hands over to the next: the incoming one arrives from the
 * side the page is moving from, and the outgoing one leaves the other way.
 * The /works ref's handover, unchanged.
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
