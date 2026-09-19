"use client";

/**
 * WorksToolbar — the one line under the /works title.
 *
 *   ⎇ main │ ▣ Projects 8  ◔ Talks 12  ◌ Social 3  ▤ Roles 2  ⨯ │ ≡ ≣ ▤ ▦
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
 * would add a chip the day it does. The ref and the density control are
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
 * "see the work" — see `lib/log-view.ts` for what the four stops print. It
 * replaces the old expand/collapse toggle, whose two states were exactly the
 * two extremes this is trying to sit between.
 */

import {
  AlignLeft,
  GalleryVertical,
  GitBranch,
  LayoutList,
  List,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/controls";
import { t, type Locale } from "@/lib/i18n";
import {
  getCommitTypePluralLabel,
  type FilterableCommitType,
} from "@/lib/log";
import { LOG_FORMS, type LogForm } from "@/lib/log-view";
import { CommitIcon } from "./icons";

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
    labelKey: "logFormIndex" | "logFormBrief" | "logFormCovers" | "logFormFeed";
  }
> = {
  // Lines only; lines of text; lines with a cover block; full panels. The
  // glyphs climb in visual weight the way the forms climb in detail.
  index: { icon: List, labelKey: "logFormIndex" },
  brief: { icon: AlignLeft, labelKey: "logFormBrief" },
  covers: { icon: LayoutList, labelKey: "logFormCovers" },
  feed: { icon: GalleryVertical, labelKey: "logFormFeed" },
};

export function WorksToolbar({
  locale,
  facets,
  active,
  onToggleType,
  onClearTypes,
  form,
  onFormChange,
}: WorksToolbarProps) {
  const filtering = active.length > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 font-mono text-xs text-tertiary-foreground",
        // PageLayout hands this an absolutely-positioned `w-max` slot, which
        // will never constrain us, so the bar bounds itself: the content
        // column's own width, i.e. the viewport less `<main>`'s px-6 gutters.
        "max-w-[calc(100vw-3rem)]",
      )}
    >
      {/* The ref we are reading. Not a control — the anchor the rest of the
          row hangs off, and the reason the page reads as a git log. */}
      <span className="inline-flex items-center gap-1.5 shrink-0">
        <GitBranch className="h-3.5 w-3.5" />
        <span>main</span>
      </span>

      <Divider />

      {/* Pathspec: what is in this reading of the log. */}
      <div
        role="group"
        aria-label={t(locale, "logFilterLabel")}
        className="flex items-center gap-0.5 min-w-0 overflow-x-auto no-scrollbar"
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

      {/* Form. Segmented rather than a cycling button: four stops is too
          many to discover by tapping, and every form stays one tap away.
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
    </div>
  );
}

/** Hairline between control groups — quaternary, because it carries nothing. */
function Divider() {
  return (
    <span aria-hidden className="h-3 w-px shrink-0 bg-border" />
  );
}
