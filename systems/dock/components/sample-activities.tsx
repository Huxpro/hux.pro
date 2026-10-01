"use client";

import { cn } from "@/lib/utils";
import { Clapperboard, Download, Mic, Navigation, Sunset, Timer, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useBandSelect } from "../band";
import { LiveActivity } from "./live-activity";

// ---------------------------------------------------------------------------
// Sample Live Activities, for the Band Lab (/lab/band).
//
// Two of the Dock's activities cannot be summoned on demand — the sun's phase
// only appears around sunrise and sunset, theater only with a video playing —
// so the lab asks for stand-ins, and for more of them than a day would bring,
// to crowd the band. They are the real <LiveActivity> with sample
// content: the same pill, the same drawer, the same forms in the band. Nothing
// here renders unless the lab has asked for it this session (band.ts,
// `samples`), so a visitor never sees one.
// ---------------------------------------------------------------------------

interface Sample {
  id: string;
  icon: LucideIcon;
  /** The lead's ground and the icon's colour. */
  tint: string;
  /** What follows the lead: a reading, or (theater) its own marks. */
  text: ReactNode;
  title: string;
  body: string;
}

const PLAIN = "bg-muted/60 text-foreground/80";

const SAMPLES: Sample[] = [
  { id: "sample-phase", icon: Sunset, tint: PLAIN, text: "18:42", title: "Sunset", body: "A stand-in for the sun's phase activity." },
  {
    id: "sample-theater",
    icon: Clapperboard,
    tint: "bg-gradient-to-br from-zinc-700 to-zinc-900 text-white",
    text: (
      <span className="flex h-3 items-end gap-[2px] text-red-500">
        {[0.5, 1, 0.7].map((h, i) => (
          <span key={i} className="w-[3px] rounded-full bg-current" style={{ height: `${h * 100}%` }} />
        ))}
      </span>
    ),
    title: "Now watching",
    body: "A stand-in for the theater activity.",
  },
  { id: "sample-timer", icon: Timer, tint: PLAIN, text: "04:12", title: "Timer", body: "A third activity, to crowd the band." },
  {
    id: "sample-recording",
    icon: Mic,
    tint: "bg-red-500/15 text-red-500",
    text: "00:32",
    title: "Recording",
    body: "A fourth: the band past what a tray shows.",
  },
  { id: "sample-download", icon: Download, tint: PLAIN, text: "64%", title: "Download", body: "A fifth." },
  {
    id: "sample-route",
    icon: Navigation,
    tint: "bg-sky-500/15 text-sky-500",
    text: "12 min · 3.4 km",
    title: "Route",
    body: "A sixth, and a long one: a pill wider than its neighbours.",
  },
];

function SamplePill({ sample }: { sample: Sample }) {
  const Icon = sample.icon;
  return (
    <>
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", sample.tint)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      {typeof sample.text === "string" ? (
        <span className="font-mono text-xs tabular-nums text-foreground/80">{sample.text}</span>
      ) : (
        sample.text
      )}
    </>
  );
}

export function SampleActivities() {
  const samples = useBandSelect((_, band) => band.samples);
  return (
    <>
      {SAMPLES.slice(0, samples).map((sample) => (
        <LiveActivity
          key={sample.id}
          id={sample.id}
          pill={<SamplePill sample={sample} />}
          title={<span className="text-sm font-medium text-foreground">{sample.title}</span>}
          openLabel={sample.title}
          collapseLabel="Collapse"
        >
          <p className="px-5 pb-4 text-sm text-muted-foreground">{sample.body}</p>
        </LiveActivity>
      ))}
    </>
  );
}
