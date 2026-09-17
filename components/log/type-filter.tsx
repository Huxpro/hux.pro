"use client";

import { commitIcons } from "./icons";
import { getCommitTypeLabel, type CommitType } from "@/lib/log";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";

interface CommitTypeFilterProps {
  types: CommitType[];
  /** `null` means every type is visible (the default, unfiltered log). */
  selected: Set<CommitType> | null;
  onChange: (next: Set<CommitType> | null) => void;
}

/**
 * Compact icon multi-select for commit types.
 *
 * Sits on the `/works` `main` row: same glyphs as the timeline, so it
 * doubles as a legend. Empty selection = show all. First tap isolates
 * that type; further taps add/remove. Clearing the last chip returns
 * to the full log.
 */
export function CommitTypeFilter({
  types,
  selected,
  onChange,
}: CommitTypeFilterProps) {
  const { locale } = useLocale();

  if (types.length === 0) return null;

  const toggle = (type: CommitType) => {
    if (selected === null) {
      onChange(new Set([type]));
      return;
    }
    const next = new Set(selected);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    if (
      next.size === 0 ||
      (next.size === types.length && types.every((t) => next.has(t)))
    ) {
      onChange(null);
      return;
    }
    onChange(next);
  };

  return (
    <span
      role="group"
      aria-label={t(locale, "logFilterTypes")}
      className="inline-flex items-center gap-0.5 select-none"
    >
      {types.map((type) => {
        const active = selected === null ? false : selected.has(type);
        const label = getCommitTypeLabel(type, locale);
        const Icon = commitIcons[type];
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            aria-label={label}
            title={label}
            onClick={() => toggle(type)}
            className={cn(
              "inline-flex items-center justify-center size-6 rounded transition-colors duration-200",
              active
                ? "bg-muted text-foreground"
                : "text-tertiary-foreground hover:text-foreground",
            )}
          >
            {type === "event" ? (
              <span
                aria-hidden
                className="block size-1.5 rounded-full bg-current"
              />
            ) : (
              <Icon aria-hidden className="size-3.5" />
            )}
          </button>
        );
      })}
    </span>
  );
}
