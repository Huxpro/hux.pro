import { getTimeOfDay } from "@/lib/ambient/greeting";
import { getSunEventInVisibleWindow } from "@/lib/ambient/sun";

export type AmbientPhase =
  | "sunrise"
  | "morning"
  | "afternoon"
  | "evening"
  | "sunset"
  | "night";

export function deriveAmbientPhase(params: {
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
}): AmbientPhase {
  const sunEvent = getSunEventInVisibleWindow({
    nowMs: params.nowMs,
    sunriseMs: params.sunriseMs,
    sunsetMs: params.sunsetMs,
  });
  if (sunEvent === "sunrise") return "sunrise";
  if (sunEvent === "sunset") return "sunset";

  const tod = getTimeOfDay(params.nowMs);
  switch (tod) {
    case "morning":
      return "morning";
    case "afternoon":
      return "afternoon";
    case "evening":
      return "evening";
    case "night":
      return "night";
  }
}
