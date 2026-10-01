"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { LAND } from "../lib/land";
import type { Region, Stop, Tour } from "../lib/tour";

// ---------------------------------------------------------------------------
// TourMap — the tour on a dot-matrix map.
//
// Land is a dot per 0.5° cell (../lib/land.ts), drawn as one path of
// zero-length round-capped strokes: a single element however many dots, and
// the dots grow as the map zooms, the way an LED board's would. The route is
// the order the cities were first visited, as arcs; the stops sit in an HTML
// layer over the SVG so they stay crisp, round and tappable at any zoom.
//
// Three views — everything, Europe, China — and the map travels between them
// by easing its viewBox; the stop layer is placed from the same box every
// frame, so dots and stops cannot drift apart. From afar the two clusters are
// one marker each (Paris, London and Amsterdam are a few pixels apart there);
// a marker is a way in, and tapping it zooms to its region.
// ---------------------------------------------------------------------------

export type TourView = "all" | Region;

/** Longitude squeeze: an equirectangular map true to scale at 40°N. */
const K = Math.cos((40 * Math.PI) / 180);
const X = (lng: number) => (lng - LAND.lon0) * K;
const Y = (lat: number) => LAND.lat1 - lat;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const BOUNDS: Record<TourView, [number, number, number, number]> = {
  // west, east, south, north
  all: [-12, 134, 16, 60],
  europe: [-4, 21, 46.3, 54.6],
  china: [109, 126, 19, 42],
};

const ASPECT = 16 / 10;

/** The view's bounds as a box of the map's aspect, grown around its centre. */
function boxFor(view: TourView): Box {
  const [w, e, s, n] = BOUNDS[view];
  let bw = X(e) - X(w);
  let bh = Y(s) - Y(n);
  const cx = X(w) + bw / 2;
  const cy = Y(n) + bh / 2;
  if (bw / bh > ASPECT) bh = bw / ASPECT;
  else bw = bh * ASPECT;
  return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
}

function landPath(): string {
  const bytes = Uint8Array.from(atob(LAND.bits), (c) => c.charCodeAt(0));
  const out: string[] = [];
  const half = LAND.step / 2;
  for (let r = 0; r < LAND.rows; r++) {
    for (let c = 0; c < LAND.cols; c++) {
      const k = r * LAND.cols + c;
      if (!(bytes[k >> 3] & (1 << (k & 7)))) continue;
      const x = (c * LAND.step + half) * K;
      const y = r * LAND.step + half;
      out.push(`M${x.toFixed(2)} ${y.toFixed(2)}h0`);
    }
  }
  return out.join("");
}

/** The route as arcs bowing north, one per leg. */
function routePath(route: Stop[]): string {
  if (route.length < 2) return "";
  let d = `M${X(route[0].lng).toFixed(2)} ${Y(route[0].lat).toFixed(2)}`;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const ax = X(a.lng);
    const ay = Y(a.lat);
    const bx = X(b.lng);
    const by = Y(b.lat);
    const len = Math.hypot(bx - ax, by - ay);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2 - len * 0.18;
    d += `Q${mx.toFixed(2)} ${my.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}`;
  }
  return d;
}

const EASE = (t: number) => 1 - Math.pow(1 - t, 3);

/** The box eased toward the view's, frame by frame. */
function useViewBox(view: TourView): Box {
  const reduce = useReducedMotion();
  const [box, setBox] = useState<Box>(() => boxFor(view));
  // Where the map is this frame — the start of the next journey, even one
  // that begins mid-way through the last.
  const current = useRef(box);
  useEffect(() => {
    const to = boxFor(view);
    const start = current.current;
    const t0 = performance.now();
    const ms = reduce ? 0 : 650;
    let frame = 0;
    const tick = (now: number) => {
      const p = ms === 0 ? 1 : EASE(Math.min(1, (now - t0) / ms));
      const next = {
        x: start.x + (to.x - start.x) * p,
        y: start.y + (to.y - start.y) * p,
        w: start.w + (to.w - start.w) * p,
        h: start.h + (to.h - start.h) * p,
      };
      current.current = next;
      setBox(next);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [view, reduce]);
  return box;
}

/** Where a city's name sits around its tap target (the dot at its centre). */
const LABEL_AT: Record<Stop["label"], string> = {
  below: "left-1/2 top-full -translate-x-1/2 -translate-y-1",
  left: "right-full top-1/2 -translate-y-1/2 translate-x-1",
  right: "left-full top-1/2 -translate-y-1/2 -translate-x-1",
};

/**
 * Where a region's marker sits against its cities: Europe's under them;
 * China's to the west, where the map has room and the cities do not.
 */
const MARKER_AT: Record<Region, string> = {
  europe: "-translate-x-1/2 translate-y-2",
  china: "-translate-x-[calc(100%+14px)] -translate-y-1/2",
};

const REGION_NAME: Record<Region, Record<"en" | "zh", string>> = {
  europe: { en: "Europe", zh: "欧洲" },
  china: { en: "China", zh: "中国" },
};

export function TourMap({
  tour,
  view,
  selectedId,
  locale,
  onSelectStop,
  onSelectRegion,
  className,
}: {
  tour: Tour;
  view: TourView;
  selectedId: string | null;
  locale: "en" | "zh";
  onSelectStop: (stop: Stop) => void;
  onSelectRegion: (region: Region) => void;
  className?: string;
}) {
  const box = useViewBox(view);
  const land = useMemo(() => landPath(), []);
  const route = useMemo(() => routePath(tour.route), [tour.route]);
  // The dot a cell draws, and the route's weight, in map units: fixed on
  // screen for the route, growing with zoom for the land.
  const dot = LAND.step * 0.62;

  const at = (lng: number, lat: number) => ({
    left: `${((X(lng) - box.x) / box.w) * 100}%`,
    top: `${((Y(lat) - box.y) / box.h) * 100}%`,
  });

  const regions = (["europe", "china"] as Region[]).map((region) => {
    const stops = tour.stops.filter((s) => s.region === region);
    const n = stops.reduce((sum, s) => sum + s.talks.length, 0);
    const lng = stops.reduce((sum, s) => sum + s.lng, 0) / (stops.length || 1);
    const lat = stops.reduce((sum, s) => sum + s.lat, 0) / (stops.length || 1);
    return { region, n, lng, lat, stops };
  });

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg border border-border/40 bg-muted/15",
        className,
      )}
      style={{ aspectRatio: String(ASPECT) }}
    >
      <svg
        viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path
          d={land}
          fill="none"
          stroke="currentColor"
          strokeWidth={dot}
          strokeLinecap="round"
          className="text-quaternary-foreground"
        />
        <path
          d={route}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
          className="text-red-500/70"
        />
      </svg>

      {/* Stops: cities up close, a marker per region from afar. */}
      {view === "all"
        ? regions.map(({ region, n, lng, lat, stops }) => (
            <div key={region}>
              {stops.map((s) => (
                <span
                  key={s.id}
                  aria-hidden
                  className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
                  style={at(s.lng, s.lat)}
                />
              ))}
              <button
                type="button"
                onClick={() => onSelectRegion(region)}
                className={cn(
                  "pressable absolute whitespace-nowrap rounded-full px-2 py-0.5",
                  MARKER_AT[region],
                  "bg-background/80 font-mono text-[10px] text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur",
                  "outline-none focus-visible:ring-foreground/40",
                )}
                style={at(lng, lat)}
              >
                {REGION_NAME[region][locale]} · {n}
              </button>
            </div>
          ))
        : tour.stops
            .filter((s) => s.region === view)
            .map((s) => {
              const selected = s.id === selectedId;
              const playable = s.talks.some((t) => t.media);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectStop(s)}
                  className="pressable group/stop absolute -translate-x-1/2 -translate-y-1/2 p-2 outline-none"
                  style={at(s.lng, s.lat)}
                  aria-pressed={selected}
                >
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    {selected && (
                      <span className="absolute inset-[-4px] animate-ping rounded-full bg-red-500/30 motion-reduce:hidden" />
                    )}
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full ring-2 ring-background",
                        // A stop that left something to play is solid; one
                        // that left only a page is a ring.
                        playable ? "bg-red-500" : "bg-background ring-red-500/80",
                        selected && "scale-125",
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      // Backed, so a name stays legible over the dots.
                      "absolute whitespace-nowrap rounded bg-background/75 px-1 font-mono text-[10px] leading-tight",
                      LABEL_AT[s.label],
                      selected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.name}
                  </span>
                </button>
              );
            })}
    </div>
  );
}
