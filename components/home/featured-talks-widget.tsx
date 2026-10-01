"use client";

import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AlbumTabs, useTheater } from "@/systems/theater";
import { TourMap, type TourView } from "@/systems/theater/components/tour-map";
import {
  buildTour,
  latestStop,
  type Stop,
  type TourTalk,
} from "@/systems/theater/lib/tour";
import { ArrowUpRight, Play } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { TYPE } from "@/lib/typography";
// ---------------------------------------------------------------------------
// FeaturedTalksWidget — the tour.
//
// Every city I have given a talk in, on a dot-matrix map, with the route the
// tour took between them (systems/theater/lib/tour.ts). From afar the map
// shows two places, Europe and China; tap one, or its tab, and the map flies
// in to its cities. A city lists the talks given there: the ones that left a
// recording or a deck play on the stage, the rest open their row on /works.
// The talks the map cannot place — online, or no city in the log — are one
// chip under it.
// ---------------------------------------------------------------------------

/** Where the card's surface and its arrow go. */
const TALKS_HREF = "/works?type=talk";

const VIEWS: TourView[] = ["all", "europe", "china"];
const VIEW_TITLE: Record<TourView, Record<"en" | "zh", string>> = {
  all: { en: "All", zh: "全部" },
  europe: { en: "Europe", zh: "欧洲" },
  china: { en: "China", zh: "中国" },
};

/** The pseudo-stop for talks the map cannot place. */
const ELSEWHERE = "elsewhere";

function years(talks: TourTalk[]): string {
  const ys = talks.map((t) => t.date.slice(0, 4)).sort();
  const first = ys[0];
  const last = ys[ys.length - 1];
  return first === last ? first : `${first}–${last}`;
}

export function FeaturedTalksWidget() {
  const { locale } = useLocale();
  const { openMedia } = useTheater();
  const tour = useMemo(() => buildTour(locale), [locale]);
  const [view, setView] = useState<TourView>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => latestStop(tour)?.id ?? null,
  );

  if (tour.stops.length === 0) return null;

  const selected: Stop | null =
    tour.stops.find((s) => s.id === selectedId) ?? null;
  const talks =
    selectedId === ELSEWHERE ? tour.elsewhere : (selected?.talks ?? []);
  const heading =
    selectedId === ELSEWHERE
      ? t(locale, "theaterTourElsewhere")
      : (selected?.name ?? "");

  const selectView = (next: TourView) => {
    setView(next);
    // Up close, the selection follows the region: keep it if it is there,
    // otherwise the region's latest stop.
    if (next === "all") return;
    if (selected?.region === next) return;
    const inRegion = tour.stops.filter((s) => s.region === next);
    const latest = inRegion.reduce<Stop | null>(
      (best, s) => (!best || s.talks[0].date > best.talks[0].date ? s : best),
      null,
    );
    if (latest) setSelectedId(latest.id);
  };

  const play = (talk: TourTalk) => {
    if (!talk.media) return;
    openMedia(talk.media, { id: talk.id, title: talk.title, subtitle: talk.venue });
  };

  return (
    <WidgetShell href={TALKS_HREF}>
      <WidgetHeader className="pb-3">
        <WidgetTitle>{t(locale, "widgetFeaturedTalks")}</WidgetTitle>
        <WidgetLink href={TALKS_HREF} />
      </WidgetHeader>

      <div className="px-5 pb-3">
        <AlbumTabs
          albums={VIEWS.map((v) => ({ id: v, title: VIEW_TITLE[v][locale] }))}
          activeIndex={VIEWS.indexOf(view)}
          onSelect={(i) => selectView(VIEWS[i])}
          raised={false}
        />
      </div>

      <div className="px-5">
        <TourMap
          tour={tour}
          view={view}
          selectedId={selectedId}
          locale={locale}
          onSelectStop={(s) => setSelectedId(s.id)}
          onSelectRegion={(r) => selectView(r)}
        />
      </div>

      <div className="px-5 pb-4 pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2 pb-1">
          <span className={TYPE.rowTitle}>{heading}</span>
          {talks.length > 0 && (
            <span className={cn("whitespace-nowrap tabular-nums", TYPE.rowMeta)}>
              {years(talks)} ·{" "}
              {t(locale, "theaterTourTalks").replace("{n}", String(talks.length))}
            </span>
          )}
          {tour.elsewhere.length > 0 && selectedId !== ELSEWHERE && (
            <button
              type="button"
              onClick={() => setSelectedId(ELSEWHERE)}
              className={cn(
                "pressable -mr-2 ml-auto whitespace-nowrap rounded-full px-2 py-0.5 hover:bg-muted/30",
                TYPE.rowMeta,
              )}
            >
              {t(locale, "theaterTourElsewhere")} · {tour.elsewhere.length}
            </button>
          )}
        </div>

        {talks.map((talk) => {
          const row = cn(
            "pressable -mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
            "transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35",
            "outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
          );
          const body = (
            <>
              {talk.media ? (
                <Play className="h-3 w-3 shrink-0 fill-current text-red-500" aria-hidden />
              ) : (
                <ArrowUpRight className="h-3 w-3 shrink-0 text-tertiary-foreground" aria-hidden />
              )}
              <span className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle)}>
                {talk.title}
              </span>
              <span className={cn("shrink-0 tabular-nums", TYPE.rowMeta)}>
                {talk.date.slice(0, 4)}
              </span>
            </>
          );
          return talk.media ? (
            <button key={talk.id} type="button" onClick={() => play(talk)} className={row}>
              {body}
            </button>
          ) : (
            <Link key={talk.id} href={talk.href} className={row}>
              {body}
            </Link>
          );
        })}
      </div>
    </WidgetShell>
  );
}
