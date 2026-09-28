"use client";

import { useCallback, useMemo } from "react";
import type { GyroAccess } from "../lib/gyroscope";
import { useLocation, useWallpaper, type LocationRequestOutcome } from "../provider";

// ---------------------------------------------------------------------------
// usePermissions — what a feature needs from the browser, and one press that
// asks for all of it.
//
// The sky window needs two things the browser guards: motion (WebKit's gate)
// and a real location (the IP's guess can be a city away, and a window turned
// true to north over the wrong city is the one thing it must not be). Asking
// for them is not two independent calls. The order is forced: WebKit opens its
// motion gate only from inside the tap's own task, so motion goes first and
// synchronously; the location prompt needs no gesture, so it follows once
// motion has had its answer — which also keeps the two dialogs from landing on
// top of each other. That sequencing lives here, once, rather than in each
// sheet that happens to need both.
//
// What is `missing` is read from what is in effect, not from what was wished:
// motion is missing while the gate stands; the location while the place in use
// is only the network's guess and the browser could still be asked
// (`locationAskable`). `refused` is what no prompt can bring back — the answer
// lives in the browser's site settings from then on.
// ---------------------------------------------------------------------------

export type PermissionKind = "motion" | "location";

export interface PermissionOutcomes {
  motion?: GyroAccess;
  location?: LocationRequestOutcome;
}

export function usePermissions(kinds: readonly PermissionKind[]) {
  const { gyro, setGyroEnabled } = useWallpaper();
  const { permission, locationAskable, requestAccurateLocation } = useLocation();

  const wantsMotion = kinds.includes("motion");
  const wantsLocation = kinds.includes("location");
  const missing = useMemo(() => {
    const out: PermissionKind[] = [];
    if (wantsMotion && !gyro.reachable && gyro.gated) out.push("motion");
    if (wantsLocation && locationAskable) out.push("location");
    return out;
  }, [wantsMotion, wantsLocation, gyro.reachable, gyro.gated, locationAskable]);
  const refused = useMemo(() => {
    const out: PermissionKind[] = [];
    if (wantsMotion && gyro.denied) out.push("motion");
    if (wantsLocation && permission === "denied") out.push("location");
    return out;
  }, [wantsMotion, wantsLocation, gyro.denied, permission]);

  /**
   * Ask for `which` (every missing one by default), in the only order that
   * works. Call it straight from the press: nothing may be awaited before it,
   * or WebKit's motion dialog never appears. Motion asked for turns the tilt's
   * wish on with it — a yes to the sky is a yes to rain along gravity too.
   */
  const request = useCallback(
    async (which: readonly PermissionKind[] = missing): Promise<PermissionOutcomes> => {
      const out: PermissionOutcomes = {};
      if (which.includes("motion")) out.motion = await setGyroEnabled(true);
      if (which.includes("location")) out.location = await requestAccurateLocation();
      return out;
    },
    [missing, setGyroEnabled, requestAccurateLocation]
  );

  return { missing, refused, request };
}
