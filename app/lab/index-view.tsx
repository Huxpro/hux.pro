"use client";

import { LAB_SURFACES } from "@/components/lab/surfaces";
import { PageLayout } from "@/components/ui/page-layout";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useHomeWidget } from "@/components/home/widgets";
import { HeaderAction } from "@/components/ui/controls";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Link } from "next-view-transitions";
import { LABS } from "./catalog";
import { LibraryTag } from "./nav";

/**
 * `/lab` — every lab as a card wearing its surface: the same small, live
 * view of the lab the home screen's Lab widget rotates through. A card is
 * one link; the surface inside it takes no taps of its own.
 *
 * No paragraph first: the cards say what the labs are. What sits under the
 * title is the page's one control, the way /writing hangs its language
 * filter there.
 */
export function LabIndexView() {
  const { locale } = useLocale();
  return (
    <PageLayout page="lab" headerActions={<HomeWidgetSwitch />}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {LABS.map((lab) => {
          const Surface = LAB_SURFACES[lab.id];
          return (
            <li key={lab.id} className="min-w-0">
              <Link
                href={lab.href}
                className={cn(
                  "group/lab pressable block rounded-2xl border border-border/50 bg-glass p-3 backdrop-blur-xl",
                  "transition-colors duration-200 hover:border-border hover:bg-glass-hover",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                )}
              >
                <div className="pointer-events-none h-36">
                  <Surface />
                </div>
                <div className="flex items-start justify-between gap-3 px-2 pb-1 pt-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className={cn(TYPE.rowTitle, "flex items-center gap-2")}>
                      {lab.name[locale]}
                      {lab.library && <LibraryTag />}
                    </p>
                    <p className={cn(TYPE.caption, "line-clamp-2")}>{lab.hint[locale]}</p>
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
            </li>
          );
        })}
      </ul>
    </PageLayout>
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
