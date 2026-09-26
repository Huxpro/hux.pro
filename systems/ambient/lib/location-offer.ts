import type { GeolocationPermission, ResolvedLocation } from "./location";

// =============================================================================
// The location offer — when the site asks, unprompted, for the real location.
//
// An IP location is a guess about the network, not the visitor: a Wi-Fi's
// provider can place it a city or a state away, and nothing on the page can
// tell (a San Jose café placed in Los Angeles is in the same timezone, so the
// timezone check in lib/location.ts sees nothing wrong). So the site offers
// once — a small notice with the button in it — to anyone on a guess whose
// browser has not been asked yet, and backs off each time it is waved away:
// a few days, then two weeks, then never.
//
// It never raises the browser's prompt by itself: the prompt comes from the
// notice's button, a tap on something that has already said what it is for.
// =============================================================================

/** Days of quiet after the first and second decline; the third is final. */
export const LOCATION_OFFER_SNOOZE_DAYS = [3, 14] as const;
export const LOCATION_OFFER_MAX_DECLINES = LOCATION_OFFER_SNOOZE_DAYS.length + 1;

export interface LocationOfferState {
  /** How many times the offer has been waved away (or ignored until it left). */
  declines: number;
  /** Epoch ms before which the offer stays quiet. */
  snoozedUntil: number;
}

export function shouldOfferLocation(params: {
  location: ResolvedLocation | null;
  permission: GeolocationPermission | null;
  offer: LocationOfferState;
  nowMs: number;
}): boolean {
  const { location, permission, offer, nowMs } = params;
  // Only a guess is worth correcting, and only an unasked browser can be asked:
  // "granted" with the IP means IP was chosen, "denied" means it was refused.
  if (location?.source !== "ip") return false;
  if (permission !== "prompt" && permission !== "unknown") return false;
  if (offer.declines >= LOCATION_OFFER_MAX_DECLINES) return false;
  // A guess the device's own clock contradicts is past a snooze: it is not a
  // maybe any more. The final decline still stands.
  if (location.timezoneMismatch) return true;
  return nowMs >= offer.snoozedUntil;
}

/** The state after one more decline. */
export function declineLocationOffer(
  offer: LocationOfferState,
  nowMs: number
): LocationOfferState {
  const declines = offer.declines + 1;
  const days = LOCATION_OFFER_SNOOZE_DAYS[declines - 1];
  return {
    declines,
    snoozedUntil: days === undefined ? Number.MAX_SAFE_INTEGER : nowMs + days * 86_400_000,
  };
}
