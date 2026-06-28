import type { Locale } from "@/lib/i18n";

/**
 * Format a timestamp to a 24-hour HH:MM clock string, localized.
 * Returns `fallback` for missing/invalid input.
 */
export function formatClockTime(
  ms: number | undefined,
  locale: Locale,
  fallback = "--:--"
): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return fallback;
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
}
