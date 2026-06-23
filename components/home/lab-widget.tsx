"use client";

import { labDemos, labWidgetDemos } from "@/components/lab/registry";
import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetStatus,
  WidgetTitle,
} from "@/components/ui/widget";
import { t, useLocale } from "@/services";
import { Link } from "next-view-transitions";
import { useEffect, useState } from "react";

/**
 * LabWidget — "living vitrine".
 *
 * Unlike the other dashboard widgets, which read out the state of something
 * alive elsewhere (weather, music, current commit), this one *is* the live
 * thing: a real lab demo runs in place. A different demo is featured on each
 * visit, so the homepage itself feels like an experiment that keeps changing.
 *
 * To avoid hydration mismatch, the first paint is deterministic (index 0);
 * the random pick happens after mount.
 */
export function LabWidget() {
  const { locale } = useLocale();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (labWidgetDemos.length > 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(Math.floor(Math.random() * labWidgetDemos.length));
    }
  }, []);

  if (labWidgetDemos.length === 0) return null;

  const slug = labWidgetDemos[index] ?? labWidgetDemos[0];
  const Demo = labDemos[slug];
  if (!Demo) return null;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-3">
        <div className="flex items-center gap-2">
          <WidgetStatus />
          <WidgetTitle>{t(locale, "widgetLab")}</WidgetTitle>
        </div>
        <WidgetLink href="/lab" label="View lab" />
      </WidgetHeader>
      <WidgetBody>
        <Link
          href={`/lab/${slug}/${locale}`}
          aria-label={`Open ${slug} in the lab`}
          className="block group/stage"
        >
          <div className="h-44 overflow-hidden rounded-xl border border-border/60">
            <Demo />
          </div>
          <div className="mt-2.5 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>{slug}.tsx</span>
            <span className="opacity-0 group-hover/stage:opacity-100 transition-opacity">
              open →
            </span>
          </div>
        </Link>
      </WidgetBody>
    </WidgetShell>
  );
}
