import { DEFAULT_SUN_EVENT_WINDOW_MINUTES, type SunEvent } from "./sun";

// =============================================================================
// Phase-change notifications
//
// The ambient phase notification gives the user a heads-up that a sun event
// (sunrise/sunset) is approaching, then stays through the actual event window
// before handing off to the gradient + greeting.
//
// Timeline for an event at T (with window W = ±45min, lead L = 90min):
//
//   T-W-L ........... T-W ........... T ........... T+W
//   └─ heads-up ──────┴─ in window (phase IS sunrise/sunset) ─┘
//   └──────────────── notification visible ──────────────────┘
// =============================================================================

export const DEFAULT_NOTIFICATION_LEAD_MINUTES = 90;

export interface UpcomingSunEvent {
  event: SunEvent;
  /** Timestamp of the actual sun event (sunrise or sunset). */
  eventMs: number;
}

export function getUpcomingSunEvent(params: {
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
  leadMinutes?: number;
  windowMinutes?: number;
}): UpcomingSunEvent | null {
  const { nowMs } = params;
  if (!Number.isFinite(nowMs)) return null;

  const windowMs =
    (params.windowMinutes ?? DEFAULT_SUN_EVENT_WINDOW_MINUTES) * 60_000;
  const leadMs =
    (params.leadMinutes ?? DEFAULT_NOTIFICATION_LEAD_MINUTES) * 60_000;

  const candidates: UpcomingSunEvent[] = [];
  if (Number.isFinite(params.sunriseMs)) {
    candidates.push({ event: "sunrise", eventMs: params.sunriseMs as number });
  }
  if (Number.isFinite(params.sunsetMs)) {
    candidates.push({ event: "sunset", eventMs: params.sunsetMs as number });
  }

  const active = candidates.filter(({ eventMs }) => {
    const start = eventMs - windowMs - leadMs;
    const end = eventMs + windowMs;
    return nowMs >= start && nowMs <= end;
  });

  if (active.length === 0) return null;

  // Sunrise and sunset are ~12h apart, so overlap is effectively impossible.
  // If it ever happens (extreme latitudes / bad data), prefer the nearer event.
  active.sort(
    (a, b) => Math.abs(nowMs - a.eventMs) - Math.abs(nowMs - b.eventMs)
  );
  return active[0];
}
