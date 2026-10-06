"use client";

import {
  getLocalizedDescription,
  getLocalizedTitle,
  getPostHref,
} from "@/lib/content";
import { blogPosts } from "@/lib/data";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { isQuestionLike } from "@/systems/ask/lib/intent";
import type { AskSearch } from "@/systems/ask/lib/search";
import { askStrings } from "@/systems/ask/strings";
import { useOptionalWindows } from "@/systems/windows";
import { Command, defaultFilter, useCommandState } from "cmdk";
import { Hash, Sparkles } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { CommandAppsStrip } from "./apps-launcher";
import {
  useCommandShell,
  useRunCommand,
  useShowKeyboardHints,
  type CommandAction,
} from "./actions";
import { useCommand } from "./provider";

// =============================================================================
// Search results and the slash list: the palette's two bodies, shared by the
// popover and the sheet. Neither knows which shell it is in; keyboard hints
// follow the input device, not the shell.
// =============================================================================

/** cmdk group headings, styled once for both shells (goes on the root). */
export const GROUP_HEADINGS =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

const ROW = [
  "flex items-center gap-3 px-3 py-2.5 rounded-lg",
  "text-sm cursor-pointer transition-colors",
  "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
  "hover:bg-accent/25",
].join(" ");

/** The palette's sections, in order, and their headings. */
const SECTIONS = ["navigation", "actions", "settings"] as const;
const SECTION_HEADING = {
  navigation: "navigation",
  actions: "sectionActions",
  settings: "settings",
} as const;

// -----------------------------------------------------------------------------
// Ask in the search list, and the list's filter.
//
// Whatever is typed can also be asked. The Ask row is always there while the
// field has text; where depends on the query. One that reads as a question
// (systems/ask/lib/intent) puts Ask first, so cmdk selects it and ↵ asks;
// anything else puts it under the results, where ↓ or Tab reaches it and ↵
// still opens the best match. With nothing typed, the field's trailing Tab
// hint enters an empty conversation instead. The list places the row, not
// the filter: cmdk
// (1.1.1) sorts items within a group but never moves the groups themselves.
//
// The same filter finds posts by their text, not only their titles: once the
// site's index is loaded (systems/ask/lib/search, fetched the first time the
// field has two characters), a post whose body matches the query and whose
// title did not still shows, ranked low.
// -----------------------------------------------------------------------------

export const ASK_VALUE = "ask-ai";

/** A full-text hit on a post that the title match missed scores this. */
const FULL_TEXT_SCORE = 0.05;

export function usePaletteFilter(query: string) {
  const [index, setIndex] = useState<AskSearch | null>(null);
  const wanted = query.trim().length >= 2;
  useEffect(() => {
    if (!wanted || index) return;
    let live = true;
    // Loaded with the index, the first time a search is long enough.
    import("@/systems/ask/lib/search")
      .then((m) => m.loadAskSearch())
      .then((loaded) => live && setIndex(loaded))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [wanted, index]);

  // Posts matching the current search, by slug; one search per keystroke,
  // not one per row.
  const hits = useRef<{ search: string; slugs: Set<string> }>({ search: "", slugs: new Set() });

  return useCallback(
    (value: string, search: string, keywords?: string[]) => {
      if (value === ASK_VALUE) return search.trim() ? 1 : 0;
      const score = defaultFilter(value, search, keywords);
      if (score > 0 || !index || !value.startsWith("blog-")) return score;
      if (hits.current.search !== search) {
        const slugs = new Set(
          index
            .search({ query: search, limit: 10 })
            .filter((h) => h.kind === "post")
            .map((h) => h.doc.split(":")[1]),
        );
        hits.current = { search, slugs };
      }
      return hits.current.slugs.has(value.slice("blog-".length)) ? FULL_TEXT_SCORE : 0;
    },
    [index],
  );
}

/**
 * The list's selection, held by the shell (spread on <Command>): cmdk picks
 * the first row as the query changes, but a row that has just mounted (the
 * Ask row, moving to the top for a question) is not in the list until a
 * render later, after the pick. So a question selects Ask itself, a frame on.
 */
export function usePaletteSelection(query: string) {
  const [value, setValue] = useState("");
  useEffect(() => {
    if (!isQuestionLike(query)) return;
    const frame = requestAnimationFrame(() => setValue(ASK_VALUE));
    return () => cancelAnimationFrame(frame);
  }, [query]);
  return { value, onValueChange: setValue };
}

/** Ask what was typed. */
function AskRow({ query }: { query: string }) {
  const { locale } = useLocale();
  const { openAsk } = useCommand();
  const s = askStrings(locale);
  return (
    <Command.Item value={ASK_VALUE} onSelect={() => openAsk(query, "search")} className={ROW}>
      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-left">
        <span className="text-muted-foreground">{s.askRow}: </span>
        {query}
      </span>
    </Command.Item>
  );
}

/**
 * The field's quiet hand-off into Ask. It keeps its place as the visitor
 * types, and carries the query into the conversation. On a narrower keyboard
 * viewport the label contracts to AI; the trailing key is the part that
 * teaches.
 */
export function AskTabHint({
  query,
  className,
}: {
  query: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const { openAsk } = useCommand();
  const s = askStrings(locale);

  return (
    <button
      type="button"
      onClick={() => openAsk(query || undefined, "search")}
      aria-label={s.askRow}
      className={cn(
        "pressable flex h-7 shrink-0 items-center gap-1 rounded-md pl-1 pr-1.5",
        "text-xs text-tertiary-foreground transition-colors",
        "hover:bg-accent/25 hover:text-muted-foreground active:bg-accent/40",
        className,
      )}
    >
      <span className="hidden md:inline">{s.askRow}</span>
      <span className="md:hidden">AI</span>
      <kbd className={TYPE.kbd}>tab</kbd>
    </button>
  );
}

/** The slash letter beside a row. Only where a keyboard can press it. */
function Letter({ letter }: { letter?: string }) {
  const showHints = useShowKeyboardHints();
  if (!letter || !showHints) return null;
  return <kbd className={cn("shrink-0", TYPE.kbd)}>{letter.toUpperCase()}</kbd>;
}

/**
 * The way into slash mode where there is no keyboard to type "/" on: the
 * hint, made pressable. It sits where a search field keeps its trailing
 * accessory on iOS (the dictation mic, a filter), inside the field and before
 * the close button outside it, and only while the field is empty, which is
 * exactly when typing "/" would have worked. The same kbd chip the hints are
 * made of, with a rim, a touch-sized hit area and press feedback, so it reads
 * as the palette's own vocabulary and not as a foreign control.
 */
export function SlashEntry({ className }: { className?: string }) {
  const { locale } = useLocale();
  const { setSlashCommandsMode } = useCommand();
  return (
    <button
      type="button"
      onClick={() => setSlashCommandsMode(true)}
      aria-label={t(locale, "slashCommands")}
      className={cn(
        "pressable flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-2",
        "border border-border/50 bg-muted/50 font-mono text-xs text-muted-foreground",
        "transition-colors active:bg-accent active:text-foreground",
        className
      )}
    >
      /
    </button>
  );
}

/** Icon, label, letter: the same in a search row and a slash row. */
function RowBody({ action }: { action: CommandAction }) {
  return (
    <>
      {/* A flex box, not an inline span: an icon that sizes itself (the tint
          swatch) needs to be a flex item to have a size at all. */}
      <span className="flex shrink-0 text-muted-foreground">{action.icon}</span>
      <span className="flex-1 text-left">{action.label}</span>
      <Letter letter={action.key} />
    </>
  );
}

function ResultRow({ action }: { action: CommandAction }) {
  const run = useRunCommand();
  return (
    <Command.Item
      value={action.id}
      keywords={action.keywords}
      onSelect={() => void run(action, "search")}
      className={ROW}
    >
      <RowBody action={action} />
    </Command.Item>
  );
}

/** cmdk's list: apps, navigation, settings, then writing. */
export function CommandResults({
  actions,
  className,
}: {
  actions: CommandAction[];
  className?: string;
}) {
  const { locale } = useLocale();
  const { leave } = useCommandShell();
  const router = useTransitionRouter();
  const windows = useOptionalWindows();

  // What the palette opens on leaves out what is only found (searchOnly);
  // a query brings it in.
  const search = useCommandState((state) => state.search);
  const searching = search.trim().length > 0;
  const askFirst = isQuestionLike(search);
  const askGroup = (
    <Command.Group value="ask">
      <AskRow query={search.trim()} />
    </Command.Group>
  );
  const listed = actions.filter(
    (a) => a.label && !a.slashOnly && (searching || !a.searchOnly),
  );

  return (
    <Command.List className={cn("overflow-y-auto p-2", className)}>
      <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
        {t(locale, "noResults")}
      </Command.Empty>

      {searching && askFirst && askGroup}

      {/* Dual-purpose Spotlight: horizontal Apps strip (same UI for
          browse + search; cmdk hides the group when nothing matches). */}
      {windows && <CommandAppsStrip onLaunch={() => leave("navigate")} />}

      {SECTIONS.map((section) => (
        <Command.Group key={section} heading={t(locale, SECTION_HEADING[section])}>
          {listed
            .filter((a) => a.section === section)
            .map((a) => (
              <ResultRow key={a.id} action={a} />
            ))}
        </Command.Group>
      ))}

      <Command.Group heading={t(locale, "writingTitle")}>
        {blogPosts.map((post) => (
          <Command.Item
            key={`blog-${post.slug}`}
            value={`blog-${post.slug}`}
            keywords={[
              post.title,
              post.titleZh || "",
              post.description,
              post.descriptionZh || "",
              ...(post.tags || []),
              "prose",
              "blog",
              "post",
              "article",
              "文章",
            ].filter(Boolean)}
            onSelect={() => {
              router.push(getPostHref(post, locale, "/writing"));
              leave("navigate");
            }}
            className={ROW}
          >
            <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate">{getLocalizedTitle(post, locale)}</div>
              <div className="truncate text-xs text-muted-foreground">
                {getLocalizedDescription(post, locale)}
              </div>
            </div>
          </Command.Item>
        ))}
      </Command.Group>

      {searching && !askFirst && askGroup}
    </Command.List>
  );
}

function SlashRow({ action }: { action: CommandAction }) {
  const run = useRunCommand();
  return (
    <button
      onClick={() => void run(action, "slash")}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5",
        "cursor-pointer text-sm transition-colors",
        "text-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent"
      )}
    >
      <RowBody action={action} />
    </button>
  );
}

/** The slash list: every lettered command with a label, as plain rows. */
export function CommandSlashList({
  actions,
  className,
}: {
  actions: CommandAction[];
  className?: string;
}) {
  const { locale } = useLocale();
  const listed = actions.filter((a) => a.key && a.label && !a.searchOnly);

  return (
    <div className={cn("p-2", className)}>
      {SECTIONS.map((section, i) => (
        <Fragment key={section}>
          <div className={cn(i > 0 && "mt-2", "px-3 py-2", TYPE.label)}>
            {t(locale, SECTION_HEADING[section])}
          </div>
          {listed
            .filter((a) => a.section === section)
            .map((a) => (
              <SlashRow key={a.id} action={a} />
            ))}
        </Fragment>
      ))}
    </div>
  );
}
