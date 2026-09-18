"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { sizeSpec } from "@/components/ui/widget-grid";
import { useWidgetSize } from "@/components/ui/widget-size";
import promptsRaw from "@/content/prompts.json";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import type { Locale } from "@/lib/i18n";
import { RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TYPE } from "@/lib/typography";
// =============================================================================
// PromptWidget — one prompt at a time, rotating.
//
// Footprints: 1×1 is the prompt; 2×1 keeps it and spends the second cell on
// the rotation itself — the next few prompts as a queue, each a tap away.
// Height earns nothing here (a longer quote is still one quote), so the
// widget declares none.
// =============================================================================

export const PROMPT_WIDGET_SIZE = sizeSpec([1, 1], [2, 1], [1, 1]);

/** How many upcoming prompts the wide footprint lists. */
const QUEUE_LENGTH = 3;

// =============================================================================
// Types
// =============================================================================

type PromptItem =
  | { kind: "quote"; id: string; text: string; author: string; source?: string }
  | { kind: "principle"; id: string; statement: string; topic?: string }
  | { kind: "person"; id: string; name: string; context?: string };

// =============================================================================
// Data helpers
// =============================================================================

function resolveItems(locale: Locale): PromptItem[] {
  const l = locale;
  const items: PromptItem[] = [];

  for (const q of promptsRaw.quotes) {
    items.push({
      kind: "quote",
      id: q.id,
      text: q.text[l],
      author: q.author,
      source: q.source,
    });
  }
  for (const p of promptsRaw.principles) {
    items.push({
      kind: "principle",
      id: p.id,
      statement: p.statement[l],
      topic: p.topic?.[l],
    });
  }
  for (const p of promptsRaw.people) {
    items.push({
      kind: "person",
      id: p.id,
      name: p.name,
      context: p.context?.[l],
    });
  }

  return items;
}

/** The one line a prompt is known by in the queue. */
function promptLine(item: PromptItem): string {
  switch (item.kind) {
    case "quote":
      return item.text;
    case "principle":
      return item.statement;
    case "person":
      return item.name;
  }
}

/** Fisher-Yates shuffle (returns new array) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =============================================================================
// Animation
// =============================================================================

const fadeVariants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

const ROTATION_INTERVAL = 20_000; // 20 seconds

// =============================================================================
// Item renderers
// =============================================================================

function QuoteDisplay({ item }: { item: Extract<PromptItem, { kind: "quote" }> }) {
  return (
    <div>
      <blockquote className="font-serif text-base text-foreground leading-relaxed italic line-clamp-3">
        &ldquo;{item.text}&rdquo;
      </blockquote>
      <p className={cn("mt-2", TYPE.caption)}>
        {item.author}
        {item.source && (
          <span className="text-tertiary-foreground"> · {item.source}</span>
        )}
      </p>
    </div>
  );
}

function PrincipleDisplay({ item, locale }: { item: Extract<PromptItem, { kind: "principle" }>; locale: Locale }) {
  const topicLabel = locale === "zh" ? `论「${item.topic}」` : `on ${item.topic}`;
  return (
    <div>
      <p className="font-serif text-base text-foreground leading-relaxed line-clamp-3">
        {item.statement}
      </p>
      {item.topic && (
        <p className={cn("mt-2", TYPE.rowMeta)}>
          {topicLabel}
        </p>
      )}
    </div>
  );
}

function PersonDisplay({ item }: { item: Extract<PromptItem, { kind: "person" }> }) {
  return (
    <div>
      <p className="font-serif text-base text-foreground">
        {item.name}
      </p>
      {item.context && (
        <p className={cn("mt-1", TYPE.caption)}>{item.context}</p>
      )}
    </div>
  );
}

function PromptItemDisplay({ item, locale }: { item: PromptItem; locale: Locale }) {
  switch (item.kind) {
    case "quote":
      return <QuoteDisplay item={item} />;
    case "principle":
      return <PrincipleDisplay item={item} locale={locale} />;
    case "person":
      return <PersonDisplay item={item} />;
  }
}

// =============================================================================
// Widget
// =============================================================================

export function PromptWidget() {
  const { locale } = useLocale();
  const { w } = useWidgetSize(PROMPT_WIDGET_SIZE.default);

  const items = useMemo(() => resolveItems(locale), [locale]);

  // Defer shuffle to after mount to avoid hydration mismatch from Math.random()
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: Math.random after hydration
    setShuffledIds(shuffle(items.map((i) => i.id)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Map shuffled IDs back to resolved items (falls back to original order pre-mount)
  const shuffled = useMemo(() => {
    if (!shuffledIds) return items;
    const idMap = new Map(items.map((i) => [i.id, i]));
    return shuffledIds.map((id) => idMap.get(id)).filter(Boolean) as PromptItem[];
  }, [items, shuffledIds]);

  const [index, setIndex] = useState(0);
  const [, setSpinKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const current = shuffled[index % shuffled.length];

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % shuffled.length);
  }, [shuffled.length]);

  // Auto-rotation
  useEffect(() => {
    timerRef.current = setInterval(advance, ROTATION_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [advance]);

  // A manual step (next, or a pick from the queue) restarts the clock so the
  // chosen prompt gets a full interval.
  const restartTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, ROTATION_INTERVAL);
  }, [advance]);

  const handleNext = useCallback(() => {
    advance();
    setSpinKey((k) => k + 1);
    restartTimer();
  }, [advance, restartTimer]);

  const jumpTo = useCallback(
    (i: number) => {
      setIndex(i % shuffled.length);
      restartTimer();
    },
    [shuffled.length, restartTimer],
  );

  if (!current) return null;

  // The next few in rotation, in the order they will come.
  const queue =
    w >= 2 && shuffled.length > 1
      ? Array.from(
          { length: Math.min(QUEUE_LENGTH, shuffled.length - 1) },
          (_, k) => (index + 1 + k) % shuffled.length,
        )
      : [];

  return (
    <WidgetShell href="/prompt">
      <WidgetHeader>
        <div className="flex items-center gap-2">
          <WidgetTitle>{t(locale, "widgetPrompt")}</WidgetTitle>
          <button
            onClick={handleNext}
            className={cn(
              "pressable text-muted-foreground hover:text-foreground active:text-foreground text-xs",
              "transition-colors duration-200 select-none"
            )}
            aria-label="Next prompt"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        <WidgetLink href="/prompt" label="View prompts" />
      </WidgetHeader>
      <WidgetBody className={cn(queue.length > 0 && "grid grid-cols-[3fr_2fr] gap-x-6")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-w-0"
          >
            <PromptItemDisplay item={current} locale={locale} />
          </motion.div>
        </AnimatePresence>

        {queue.length > 0 && (
          <div className="min-w-0">
            <span
              className={cn(
                "block text-xs text-tertiary-foreground",
                locale === "zh" ? "font-mono" : "italic font-serif",
              )}
            >
              {t(locale, "widgetUpNext")}
            </span>
            <ul className="mt-1">
              {queue.map((i) => (
                <li key={shuffled[i].id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    className={cn(
                      "pressable -mx-2 block w-[calc(100%+1rem)] truncate rounded-md px-2 py-1 text-left",
                      "transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35",
                      TYPE.rowTitle,
                    )}
                  >
                    {promptLine(shuffled[i])}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}
