// =============================================================================
// The Wardrobe's intent components, as the model rewrote them. What changed:
//
//   man.hat        "absurd" is gone; "towering" (a hat past any sense) is new.
//                  A person's "absurd" waits (it is not one of the kinds now),
//                  and applies again with v1.
//   man.gaze       read only away from the window: at the window he faces the
//                  moon, and where he looks is no question there. A guard is a
//                  branch: the intent is not read, so it is neither shown nor asked.
//   wardrobe.pace  its code default follows the door: a door flung wide opens
//                  all at once. A relation is data flowing down, from one
//                  intent's value to another's default; a person and a sure
//                  model still come first.
// =============================================================================

import { host, scope, type Child } from "reintent-core";
import { Gaze, Hat, MAN, Open, Pace, Place, WARDROBE } from "../kinds";

const ref = (u: { kind: string; path: string }) => ({ kind: u.kind, path: u.path });

export const Dream = scope(function Dream(p: { children?: Child }) {
  return host("dream", { children: p.children });
});
Dream.displayName = "Dream";

export function Man() {
  const hat = Hat.read("hat", { thing: MAN, label: "帽子有多大 · the hat", aka: ["帽子", "帽", "hat"], default: "big", ask: true });
  const stand = Place.read("stand", { thing: MAN, label: "站在哪 · where he stands", aka: ["站", "站在", "走到", "站到", "stand"], default: "bedside" });
  const gaze = stand.kind === "window" ? null : Gaze.read("gaze", { thing: MAN, label: "看着谁 · his gaze", aka: ["看", "眼睛", "盯", "look", "eyes"], default: "me", ask: true });
  return host("man", { hat: ref(hat), stand: ref(stand), gaze: gaze && ref(gaze) });
}
Man.displayName = "Man";

export function Wardrobe() {
  const door = Open.read("door", { thing: WARDROBE, label: "柜门开多大 · how far the door opens", aka: ["柜门", "门", "door"], default: "half" });
  const pace = Pace.read("pace", { thing: WARDROBE, label: "开得多慢 · how slowly", aka: ["速度", "pace"], default: door.kind === "wide" ? "sudden" : "slow" });
  return host("wardrobe", { door: ref(door), pace: ref(pace) });
}
Wardrobe.displayName = "Wardrobe";
