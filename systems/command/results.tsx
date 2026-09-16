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
import { useOptionalWindows } from "@/systems/windows";
import { Command } from "cmdk";
import { Hash } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { Fragment } from "react";
import { CommandAppsStrip } from "./apps-launcher";
import {
  useCommandShell,
  useRunCommand,
  useShowKeyboardHints,
  type CommandAction,
} from "./actions";
import { useCommand } from "./provider";

// =============================================================================
// Search results and the slash list — the palette's two bodies, shared by the
// popover and the sheet. Neither knows which shell it is in; keyboard hints
// follow the input device, not the shell.
// =============================================================================

/** cmdk group headings, styled once for both shells (goes on the root). */
export const GROUP_HEADINGS =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider";

const ROW = [
  "flex items-center gap-3 px-3 py-2.5 rounded-lg",
  "text-sm cursor-pointer transition-colors",
  "text-foreground data-[selected=true]:bg-accent/40 data-[selected=true]:text-accent-foreground",
  "hover:bg-accent/25",
].join(" ");

/** The palette's sections, in order; also the i18n keys of their headings. */
const SECTIONS = ["navigation", "settings"] as const;

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
 * the close button outside it, and only while the field is empty — which is
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

/** Icon, label, letter — the same in a search row and a slash row. */
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

  const listed = actions.filter((a) => a.label);

  return (
    <Command.List className={cn("overflow-y-auto p-2", className)}>
      <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
        {t(locale, "noResults")}
      </Command.Empty>

      {/* Dual-purpose Spotlight: horizontal Apps strip (same UI for
          browse + search; cmdk hides the group when nothing matches). */}
      {windows && <CommandAppsStrip onLaunch={() => leave("navigate")} />}

      {SECTIONS.map((section) => (
        <Command.Group key={section} heading={t(locale, section)}>
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
  const listed = actions.filter((a) => a.key && a.label);

  return (
    <div className={cn("p-2", className)}>
      {SECTIONS.map((section, i) => (
        <Fragment key={section}>
          <div className={cn(i > 0 && "mt-2", "px-3 py-2", TYPE.label)}>
            {t(locale, section)}
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
