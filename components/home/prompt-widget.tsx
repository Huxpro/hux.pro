"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetIconButton,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { sizeSpec } from "@/components/ui/widget-grid";
import { useWidgetSize } from "@/components/ui/widget-size";
import promptsRaw from "@/content/prompts.json";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { topicLabel, type PromptTopic } from "@/lib/prompt-view";
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

/**
 * `id` keys the rotation; `anchor` is where the entry lives on /prompt in
 * this language (`#流变` / `#flux`), so tapping the card lands on the line
 * it was showing rather than at the top of the page.
 */
type PromptItem = { id: string; anchor: string } & (
  | { kind: "quote"; text: string; author: string; source?: string }
  | { kind: "belief"; statement: string; topic: PromptTopic }
  | { kind: "influence"; name: string; context?: string }
);

/** Names are locale-neutral ("Dan Abramov") unless they're a phrase. */
function resolveName(name: string | { en: string; zh: string }, l: Locale) {
  return typeof name === "string" ? name : name[l];
}

// =============================================================================
// Data helpers
// =============================================================================

function resolveItems(locale: Locale): PromptItem[] {
  const l = locale;
  const items: PromptItem[] = [];

  // A conviction quoted from someone keeps their voice; one in my own words
  // reads as a statement. Same split as the /prompt page.
  //
  // A conviction can hold a chorus — the same belief as several traditions
  // say it — and the card shows the head of it. The other voices are worth
  // rotating through too, but a card that changed its mind mid-belief would
  // just read as two cards.
  for (const c of promptsRaw.convictions) {
    const head = c.statements[0];
    const quoted = "quotedFrom" in head ? head.quotedFrom : undefined;
    if (quoted) {
      items.push({
        kind: "quote",
        id: c.id,
        anchor: c.anchor?.[l] ?? c.id,
        text: head.text[l],
        author: resolveName(quoted.name, l),
        // A saying can carry a different source in each language.
        source: quoted.source ? resolveName(quoted.source, l) : undefined,
      });
    } else {
      items.push({
        kind: "belief",
        id: c.id,
        anchor: c.anchor?.[l] ?? c.id,
        statement: head.text[l],
        topic: (c.topics as PromptTopic[])[0],
      });
    }
  }
  for (const i of promptsRaw.influences) {
    items.push({
      kind: "influence",
      id: i.id,
      anchor: i.anchor?.[l] ?? i.id,
      name: resolveName(i.name, l),
      context: i.context?.[l],
    });
  }

  return items;
}

/** The one line a prompt is known by in the queue. */
function promptLine(item: PromptItem): string {
  switch (item.kind) {
    case "quote":
      return plain(item.text);
    case "belief":
      return plain(item.statement);
    case "influence":
      return plain(item.name);
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

/**
 * The prompts' one inline mark, `*…*` — a work's title (`*Principles*`),
 * the way /prompt renders it (app/prompt/view.tsx, `Marks`): italic in
 * Latin, and the same string carries 《》 in Chinese instead. The card used
 * to print the asterisks.
 */
const TITLE_MARK = /(\*[^*]+\*)/g;

function Marks({ text }: { text: string }) {
  return (
    <>
      {text.split(TITLE_MARK).map((part, i) =>
        part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
          <em key={i} className="[font-synthesis-style:none]">
            {part.slice(1, -1)}
          </em>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** The same string with its marks taken off, for a one-line label. */
function plain(text: string): string {
  return text.replace(TITLE_MARK, (m) => m.slice(1, -1));
}

function QuoteDisplay({
  item,
}: {
  item: Extract<PromptItem, { kind: "quote" }>;
}) {
  return (
    <div>
      <blockquote className="font-serif text-base text-foreground leading-relaxed line-clamp-3">
        &ldquo;{item.text}&rdquo;
      </blockquote>
      <p className={cn("mt-2", TYPE.caption)}>
        {item.author}
        {item.source && (
          <span className="text-tertiary-foreground">
            {" · "}
            <Marks text={item.source} />
          </span>
        )}
      </p>
    </div>
  );
}

function BeliefDisplay({
  item,
  locale,
}: {
  item: Extract<PromptItem, { kind: "belief" }>;
  locale: Locale;
}) {
  const name = topicLabel(item.topic, locale);
  const label = locale === "zh" ? `论「${name}」` : `on ${name}`;
  return (
    <div>
      <p className="font-serif text-base text-foreground leading-relaxed line-clamp-3">
        {item.statement}
      </p>
      {item.topic && <p className={cn("mt-2", TYPE.rowMeta)}>{label}</p>}
    </div>
  );
}

function InfluenceDisplay({
  item,
}: {
  item: Extract<PromptItem, { kind: "influence" }>;
}) {
  return (
    <div>
      <p className="font-serif text-base text-foreground">
        <Marks text={item.name} />
      </p>
      {item.context && (
        <p className={cn("mt-1", TYPE.caption)}>{item.context}</p>
      )}
    </div>
  );
}

function PromptItemDisplay({
  item,
  locale,
}: {
  item: PromptItem;
  locale: Locale;
}) {
  switch (item.kind) {
    case "quote":
      return <QuoteDisplay item={item} />;
    case "belief":
      return <BeliefDisplay item={item} locale={locale} />;
    case "influence":
      return <InfluenceDisplay item={item} />;
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
    return shuffledIds
      .map((id) => idMap.get(id))
      .filter(Boolean) as PromptItem[];
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
    // The card is a pointer at one entry, so the surface opens that entry.
    // "View prompts" in the header stays the whole page.
    <WidgetShell href={`/prompt#${current.anchor}`}>
      <WidgetHeader>
        <div className="flex items-center gap-2">
          <WidgetTitle>{t(locale, "widgetPrompt")}</WidgetTitle>
          <WidgetIconButton
            label={t(locale, "widgetPromptNext")}
            onClick={handleNext}
          >
            <RefreshCw
              className="h-3 w-3 transition-transform duration-300"
              style={{ transform: `rotate(${spinKey * 90}deg)` }}
            />
          </WidgetIconButton>
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
