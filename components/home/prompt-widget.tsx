"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import promptsRaw from "@/content/prompts.json";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import type { Locale } from "@/lib/i18n";
import { RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TYPE } from "@/lib/typography";
// =============================================================================
// Types
// =============================================================================

type PromptItem =
  | { kind: "quote"; id: string; text: string; author: string; source?: string }
  | { kind: "principle"; id: string; statement: string; topic?: string }
  | { kind: "people"; id: string; name: string; context?: string }
  | { kind: "book"; id: string; name: string; context?: string };

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
      kind: "people",
      id: p.id,
      name: p.name,
      context: p.context?.[l],
    });
  }
  for (const b of promptsRaw.books ?? []) {
    items.push({
      kind: "book",
      id: b.id,
      name: b.name,
      context: b.context?.[l],
    });
  }

  return items;
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

function NamedDisplay({
  item,
}: {
  item: Extract<PromptItem, { kind: "people" | "book" }>;
}) {
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
    case "people":
    case "book":
      return <NamedDisplay item={item} />;
  }
}

// =============================================================================
// Widget
// =============================================================================

export function PromptWidget() {
  const { locale } = useLocale();

  const items = useMemo(() => resolveItems(locale), [locale]);

  // Defer shuffle to after mount to avoid hydration mismatch from Math.random()
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);
  useEffect(() => {
    setShuffledIds(shuffle(items.map((i) => i.id)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Map shuffled IDs back to resolved items (falls back to original order pre-mount)
  const shuffled = useMemo(() => {
    if (!shuffledIds) return items;
    const idMap = new Map(items.map((i) => [i.id, i]));
    return shuffledIds.map((id) => idMap.get(id)).filter(Boolean) as PromptItem[];
  }, [items, shuffledIds]);

  const [index, setIndex] = useState(0);
  const [spinKey, setSpinKey] = useState(0);
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

  const handleNext = useCallback(() => {
    advance();
    setSpinKey((k) => k + 1);
    // Reset timer so we get a full interval after manual advance
    clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, ROTATION_INTERVAL);
  }, [advance]);

  if (!current) return null;

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
      <WidgetBody>
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PromptItemDisplay item={current} locale={locale} />
          </motion.div>
        </AnimatePresence>
      </WidgetBody>
    </WidgetShell>
  );
}
