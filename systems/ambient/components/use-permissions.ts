"use client";

import { useCallback, useMemo } from "react";
import type { GyroAccess } from "../lib/gyroscope";
import {
  locationStatus,
  motionStatus,
  type PermissionKind,
  type PermissionStatus,
} from "../lib/permissions";
import { useLocation, useWallpaper, type LocationRequestOutcome } from "../provider";

// ---------------------------------------------------------------------------
// usePermissions — where each permission stands, and one press that asks.
//
// The status is lib/permissions.ts's single derivation, read from the
// provider's live facts; every sheet, the pull and the tilt's offer read it
// here rather than deriving their own. `request` asks, in the only order that
// works: WebKit opens its motion gate only from inside the tap's own task, so
// motion goes first and synchronously; the location prompt needs no gesture,
// so it follows once motion has had its answer — which also keeps the two
// dialogs from landing on top of each other.
//
// The pipeline, end to end (docs/system-ambient.md, "Permissions"):
//
//   provider facts → lib/permissions (status) → usePermissions (status + ask)
//     → the feature's own policy (offer? how often?) → PermissionSheet (UI)
// ---------------------------------------------------------------------------

export interface PermissionOutcomes {
  motion?: GyroAccess;
  location?: LocationRequestOutcome;
}

/**
 * `kinds` is what the caller needs; `askable` is the part of it one tap could
 * still get, and what `request()` asks for when given nothing.
 */
export function usePermissions(kinds: readonly PermissionKind[]) {
  const { gyro, setGyroEnabled } = useWallpaper();
  const { location, permission, requestAccurateLocation } = useLocation();

  const motion = motionStatus(gyro);
  const place = locationStatus({
    source: location?.source ?? null,
    permission,
    api: typeof navigator !== "undefined" && "geolocation" in navigator,
  });
  const status = useMemo<Record<PermissionKind, PermissionStatus>>(
    () => ({ motion, location: place }),
    [motion, place]
  );
  const key = kinds.join();
  const askable = useMemo(
    () => kinds.filter((k) => status[k] === "askable"),
    // `kinds` is usually a literal; its contents, not its identity, matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, status]
  );

  /**
   * Ask for `which` (every askable one by default), in order. Call it straight
   * from the press: nothing may be awaited before it, or WebKit's motion dialog
   * never appears. Motion asked for turns the tilt's wish on with it — a yes to
   * the sky is a yes to rain along gravity too — and asking for one already
   * ready is a harmless no-op answer.
   */
  const request = useCallback(
    async (which: readonly PermissionKind[] = askable): Promise<PermissionOutcomes> => {
      const out: PermissionOutcomes = {};
      if (which.includes("motion")) out.motion = await setGyroEnabled(true);
      if (which.includes("location")) out.location = await requestAccurateLocation();
      return out;
    },
    [askable, setGyroEnabled, requestAccurateLocation]
  );

  return { status, askable, request };
}
