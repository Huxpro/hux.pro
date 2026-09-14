"use client";

import { makeStore } from "@/lib/persisted-setting";

/**
 * Ruler ToC settings — a tiny persisted channel, adjustable from the
 * devtool panel. The setting applies whether or not the devtool is
 * enabled; the panel is just the UI for flipping it.
 */

export type RulerSide = "left" | "right";

const store = makeStore<RulerSide>(
  "hux_ruler_side",
  "hux:ruler-side",
  "right",
  (raw) => (raw === "left" ? "left" : "right")
);

export const getRulerSide = store.get;
export const setRulerSide = store.set;
export const useRulerSide = store.use;
