// =============================================================================
// The Wardrobe's intent components, as the model first wrote them: the
// semantic layer. Each reads its intents (values, not signals) and returns a
// host node that says what was decided, in kinds and paths, not pixels. No
// view here: experiences/reintent/main.tsx reads these nodes and draws them.
// =============================================================================

import { host, scope, type Child } from "reintent-core";
import { Gaze, MAN, Open, Pace, Place, Size, WARDROBE } from "../kinds";

/** What a host node carries of an intent: the kind to go on, and the path its meaning is kept under. */
const ref = (u: { kind: string; path: string }) => ({ kind: u.kind, path: u.path });

/** The dream: a scope, so its parts keep their intents when they move inside it. */
export const Dream = scope(function Dream(p: { children?: Child }) {
  return host("dream", { children: p.children });
});
Dream.displayName = "Dream";

export function Man() {
  // "大很多": much bigger, or absurdly so? Not sure: it asks.
  const hat = Size.read("hat", { thing: MAN, label: "帽子有多大 · the hat", aka: ["帽子", "帽", "hat"], default: "big", ask: true });
  const gaze = Gaze.read("gaze", { thing: MAN, label: "看着谁 · his gaze", aka: ["看", "眼睛", "盯", "look", "eyes"], default: "me" });
  const stand = Place.read("stand", { thing: MAN, label: "站在哪 · where he stands", aka: ["站", "站在", "走到", "站到", "stand"], default: "bedside" });
  return host("man", { hat: ref(hat), gaze: ref(gaze), stand: ref(stand) });
}
Man.displayName = "Man";

export function Wardrobe() {
  const door = Open.read("door", { thing: WARDROBE, label: "柜门开多大 · how far the door opens", aka: ["柜门", "门", "door"], default: "half" });
  const pace = Pace.read("pace", { thing: WARDROBE, label: "开得多慢 · how slowly", aka: ["速度", "pace"], default: "slow" });
  return host("wardrobe", { door: ref(door), pace: ref(pace) });
}
Wardrobe.displayName = "Wardrobe";
