// =============================================================================
// The Wardrobe's parts, as the model rewrote them. What changed:
//
//   man.hat        "absurd" is gone; "towering" (a hat past any sense) is new.
//                  A person's "absurd" waits, and is back with v1.
//   man.gaze       asked of him only away from the window: at the window he
//                  faces the moon, and where he looks is no question there.
//                  The hook sits under an `if`; it is known by its label.
//   wardrobe.pace  a relation: a door flung wide opens all at once.
//
// Switching between this and parts.tsx is the program changing under a
// running doc: every decision whose path and kind remain is kept.
// =============================================================================

import { intent, part, useIntent } from "reintent-core";
import { useIntent as useHookIntent } from "reintent-core/react";
import { Man as Figure, Wardrobe as Box } from "../common/bedroom";
import { transformOf, type ManPose, type WardrobePose } from "../wardrobe/Wardrobe";
import { SHAPE } from "../wardrobe/timeline";
import { Gaze, Open, Pace, Place } from "./kinds";

const Hat = intent(
  {
    usual: { label: "寻常 · usual", words: ["寻常", "正常", "普通"], hatScale: 1 },
    big: { label: "大很多 · much bigger", words: ["大很多"], hatScale: 1.45 },
    towering: { label: "顶天 · towering", words: ["顶天", "高耸", "towering"], hatScale: 2.4 },
  },
  { ordered: true },
);

export const Man = part("man", { label: "他 · the man", aka: ["他", "男人", "黑衣人", "man", "him"] }, ({ instance, eyes, at, scale, lean, children }: ManPose) => {
  const hat = useIntent("hat", Hat, { label: "帽子有多大 · the hat", aka: ["帽子", "帽", "hat"], p: { usual: 0.04, big: 0.5, towering: 0.46 }, resolve: "ask" });
  const stand = useIntent("stand", Place, { label: "站在哪 · where he stands", aka: ["站", "站在", "走到", "站到", "stand"], p: { bedside: 0.46, foot: 0.42, window: 0.12 } });
  const gaze =
    stand.kind === "window" ? null : useIntent("gaze", Gaze, { label: "看着谁 · his gaze", aka: ["看", "眼睛", "盯", "look", "eyes"], p: { me: 0.55, away: 0.45 }, resolve: "ask" });

  const pose =
    instance === "bedside"
      ? { at: stand.data.at, scale: stand.data.scale + scale - SHAPE.stand.scale, lean: stand.data.lean + lean - SHAPE.stand.lean }
      : { at, scale, lean };
  return (
    <Figure instance={instance} hatScale={hat.data.hatScale} eyes={eyes * (gaze ? gaze.data.eyes : 0)} transform={transformOf(pose)}>
      {children}
    </Figure>
  );
});

export const Wardrobe = part("wardrobe", { label: "衣柜 · the wardrobe", aka: ["衣柜", "柜子", "柜门", "门", "wardrobe", "door"] }, ({ openLeft, openRight, waking, children }: WardrobePose) => {
  const door = useIntent("door", Open, { label: "柜门开多大 · how far the door opens", aka: ["柜门", "门", "door"], p: { ajar: 0.12, half: 0.58, wide: 0.3 } });

  return (
    <Box openLeft={openLeft} openRight={waking ? (openRight / SHAPE.doorEnd) * door.data.open : openRight}>
      {children}
    </Box>
  );
});

/** The door's pace, for the director: now a relation, a door flung wide opens all at once. */
export function usePace() {
  return useHookIntent("pace", Pace, {
    label: "开得多慢 · how slowly",
    aka: ["速度", "pace"],
    p: { sudden: 0.08, slow: 0.7, crawl: 0.22 },
    derive: (read) => (read("wardrobe.door") === "wide" ? "sudden" : undefined),
  });
}
