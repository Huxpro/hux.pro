// =============================================================================
// Permissions — what the browser has let the sky have, as one vocabulary.
//
// Two things the sky needs are guarded: motion (WebKit's gate on
// `DeviceOrientationEvent`) and a real location (the geolocation prompt). The
// raw facts about each live in the provider — the gyroscope's access, the
// geolocation permission, the location in use — and they do not agree on what
// "granted" means: Safari reads "prompt" after an Allow, a "granted" location
// can still be running on the IP because the fix failed, and there is no query
// at all for WebKit's motion gate. So every consumer that asks "can I ask for
// this, and should I?" used to derive its own answer from a different subset
// of those facts, and they drifted — a window opening over the IP's city
// without asking was one such drift.
//
// This is the one derivation. Each kind reads as exactly one of:
//
//   ready        in effect: readings flow, or a real fix is the place in use
//   askable      not in effect, and one tap can ask the browser for it
//   refused      the browser has said no; only its site settings undo that
//   unsupported  nothing here to ask (no sensor event, no geolocation API)
//
// "ready" is read from what IS in effect, never from what is wished or what the
// permission string says. Policy — whether to offer at all, how often — is not
// here: it belongs to each feature (the tilt's once-ever, the window's
// once-a-session place). Asking, and the order it must happen in, is
// `usePermissions` (components/use-permissions.ts).
// =============================================================================

import type { GeolocationPermission, LocationSource } from "./location";

export type PermissionKind = "motion" | "location";
export type PermissionStatus = "ready" | "askable" | "refused" | "unsupported";

/** Motion, from the gyroscope's state (`GyroState` in the provider). */
export function motionStatus(gyro: {
  reachable: boolean;
  gated: boolean;
  denied: boolean;
}): PermissionStatus {
  if (gyro.reachable) return "ready";
  if (gyro.denied) return "refused";
  if (gyro.gated) return "askable";
  return "unsupported";
}

/**
 * The location, from the place in use and the browser's permission. Ready only
 * when a fix is actually behind the place — a remembered Safari Allow whose
 * fix timed out, or a "granted" whose fix failed, is still the IP's guess, and
 * still askable.
 */
export function locationStatus(facts: {
  /** The source of the place in use; null while none has resolved. */
  source: LocationSource | null;
  permission: GeolocationPermission | null;
  /** The browser has `navigator.geolocation`. */
  api: boolean;
}): PermissionStatus {
  if (facts.source === "geolocation") return "ready";
  if (!facts.api) return "unsupported";
  if (facts.permission === "denied") return "refused";
  return "askable";
}
