"use client";

import { cn } from "@/lib/utils";
import { SurfaceFrame } from "./frame";

/**
 * The Intent Loop at a glance: the loop itself. The tree flows one way to the
 * view; an event comes back through the recognizer, by one of two doors.
 */
export function IntentsSurface() {
  const box = (label: string, tone?: "a" | "b") => (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 font-mono text-[10px]",
        tone === "a" ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-300" : tone === "b" ? "border-violet-500/60 text-violet-700 dark:text-violet-300" : "border-border text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
  return (
    <SurfaceFrame className="flex flex-col items-center justify-center gap-2 px-3">
      <div className="flex items-center gap-1">
        {box("tree")}→{box("reintent")}→{box("view")}
      </div>
      <div className="text-[10px] text-muted-foreground">↑ event ↓</div>
      <div className="flex items-center gap-1">
        {box("① resolve", "a")}
        <span className="text-[10px] text-muted-foreground">or</span>
        {box("② infer", "b")}
      </div>
    </SurfaceFrame>
  );
}
