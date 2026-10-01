"use client";

import { LAB_SURFACES, LABS, LibraryFacts, type LabEntry, type LibraryLab } from "@/systems/lab";
import { PageLayout } from "@/components/ui/page-layout";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useHomeWidget } from "@/components/home/widgets";
import { HeaderAction } from "@/components/ui/controls";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Link } from "next-view-transitions";
import type { ReactNode } from "react";

/**
 * `/lab` — every lab as a card wearing its surface: the same small, live
 * view of the lab the home screen's Lab widget rotates through. A card is
 * one link; the surface inside it takes no taps of its own.
 *
 * Two sections, libraries first. A library is a lab that shipped — a
 * different promise (you can use it) to a different reader (a developer),
 * so it is not one more card with a tag: it leads, as a wide card with the
 * package's facts. The studies follow, the site laid open.
 *
 * No paragraph first: the cards say what the labs are. What sits under the
 * title is the page's one control, the way /writing hangs its language
 * filter there.
 */
export function LabIndexView() {
  const { locale } = useLocale();
  const libraries = LABS.filter((lab): lab is LibraryLab => lab.kind === "library");
  const studies = LABS.filter((lab) => lab.kind === "study");
  return (
    <PageLayout page="lab" headerActions={<HomeWidgetSwitch />}>
      <div className="space-y-10">
        {libraries.length > 0 && (
          <LabGroup title={t(locale, "labLibraries")} note={t(locale, "labLibrariesNote")}>
            <ul className="grid gap-4">
              {libraries.map((lab) => (
                <li key={lab.id} className="min-w-0">
                  <LabCard lab={lab} wide />
                </li>
              ))}
            </ul>
          </LabGroup>
        )}
        <LabGroup title={t(locale, "labStudies")} note={t(locale, "labStudiesNote")}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {studies.map((lab) => (
              <li key={lab.id} className="min-w-0">
                <LabCard lab={lab} />
              </li>
            ))}
          </ul>
        </LabGroup>
      </div>
    </PageLayout>
  );
}

function LabGroup({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex flex-wrap items-baseline gap-x-2">
        <span className={TYPE.label}>{title}</span>
        <span className={cn(TYPE.caption, "text-tertiary-foreground")}>{note}</span>
      </h2>
      {children}
    </section>
  );
}

/** A lab as one link: its surface, its name and line. Wide, the surface sits beside the words. */
function LabCard({ lab, wide }: { lab: LabEntry; wide?: boolean }) {
  const { locale } = useLocale();
  const Surface = LAB_SURFACES[lab.id];
  return (
    <Link
      href={lab.href}
      className={cn(
        "group/lab pressable block rounded-2xl border border-border/50 bg-glass p-3 backdrop-blur-xl",
        "transition-colors duration-200 hover:border-border hover:bg-glass-hover",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        wide && "sm:grid sm:grid-cols-2 sm:items-stretch sm:gap-3",
      )}
    >
      <div className="pointer-events-none h-36 sm:h-40">
        <Surface />
      </div>
      <div className={cn("flex items-start justify-between gap-3 px-2 pb-1 pt-3", wide && "sm:flex-col sm:py-2")}>
        <div className="min-w-0 space-y-0.5">
          <p className={TYPE.rowTitle}>{lab.name[locale]}</p>
          {/* Wide, the surface already says the one line; the room is for what the lab is. */}
          <p className={cn(TYPE.caption, wide ? "line-clamp-4" : "line-clamp-2")}>
            {wide ? lab.blurb[locale] : lab.hint[locale]}
          </p>
          {lab.kind === "library" && <LibraryFacts lab={lab} className="pt-1.5" />}
        </div>
        <span
          className={cn(
            TYPE.meta,
            "inline-flex shrink-0 items-center gap-1 pt-0.5 transition-colors group-hover/lab:text-foreground",
          )}
        >
          {t(locale, "labOpen")}
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

/**
 * The Lab widget is off the home screen until asked for (HOME_WIDGETS); this
 * is where someone who came for the labs asks. The home grid's edit mode
 * lists it too.
 */
function HomeWidgetSwitch() {
  const { locale } = useLocale();
  const { enabled, setEnabled } = useHomeWidget("lab");
  return (
    <span className="inline-flex items-center font-mono text-xs select-none">
      <HeaderAction variant="action" active={enabled} onClick={() => setEnabled(!enabled)}>
        <span className="inline-flex items-center gap-1">
          {enabled ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {t(locale, enabled ? "labWidgetOn" : "labWidgetAdd")}
        </span>
      </HeaderAction>
    </span>
  );
}
