import type { AmbientPhase } from "./phase";
import type { TranslationKey } from "@/services/locale";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export function getTimeOfDay(nowMs: number): TimeOfDay {
  const hour = new Date(nowMs).getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function getAmbientGreetingKeyFromPhase(phase: AmbientPhase): TranslationKey {
  switch (phase) {
    case "sunrise":
      return "greetingSunrise";
    case "sunset":
      return "greetingSunset";
    case "morning":
      return "greetingMorning";
    case "afternoon":
      return "greetingAfternoon";
    case "evening":
      return "greetingEvening";
    case "night":
      return "greetingNight";
  }
}
