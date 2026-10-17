// =============================================================================
// The Wardrobe's parts, as the model first wrote them. Each is a thing:
// its intents in (useIntent, typed by kinds.ts), its drawing out. The stage
// (experiences/wardrobe) poses them over time; what they look like, and
// where he stands at the bed, is theirs.
//
// The pace is the wardrobe's, but it is time, not a drawing: the stage's
// director reads it sideways (main.tsx).
// =============================================================================

import { part, useIntent } from "reintent-core";
import { Man as Figure, Wardrobe as Box } from "../common/bedroom";
import { transformOf, type ManPose, type WardrobePose } from "../wardrobe/Wardrobe";
import { SHAPE } from "../wardrobe/timeline";
import { Gaze, Open, Pace, Place, Size } from "./kinds";

export const Man = part("man", { label: "他 · the man", aka: ["他", "男人", "黑衣人", "man", "him"] }, ({ instance, eyes, at, scale, lean, children }: ManPose) => {
  // "大很多": much bigger, or absurdly so? Not sure: it asks.
  const hat = useIntent("hat", Size, { label: "帽子有多大 · the hat", aka: ["帽子", "帽", "hat"], p: { usual: 0.04, big: 0.52, absurd: 0.44 }, resolve: "ask" });
  const gaze = useIntent("gaze", Gaze, { label: "看着谁 · his gaze", aka: ["看", "眼睛", "盯", "look", "eyes"], p: { me: 0.93, away: 0.07 } });
  const stand = useIntent("stand", Place, { label: "站在哪 · where he stands", aka: ["站", "站在", "走到", "站到", "stand"], p: { bedside: 0.46, foot: 0.42, window: 0.12 } });

  // At the bed he stands where his intent says, the timeline's drift on top of it.
  const pose =
    instance === "bedside"
      ? { at: stand.data.at, scale: stand.data.scale + scale - SHAPE.stand.scale, lean: stand.data.lean + lean - SHAPE.stand.lean }
      : { at, scale, lean };
  return (
    <Figure instance={instance} hatScale={hat.data.hatScale} eyes={eyes * gaze.data.eyes} transform={transformOf(pose)}>
      {children}
    </Figure>
  );
});

export const Wardrobe = part("wardrobe", { label: "衣柜 · the wardrobe", aka: ["衣柜", "柜子", "柜门", "门", "wardrobe", "door"] }, ({ openLeft, openRight, waking, children }: WardrobePose) => {
  const door = useIntent("door", Open, { label: "柜门开多大 · how far the door opens", aka: ["柜门", "门", "door"], p: { ajar: 0.12, half: 0.58, wide: 0.3 } });
  useIntent("pace", Pace, { label: "开得多慢 · how slowly", aka: ["速度", "pace"], p: { sudden: 0.08, slow: 0.7, crawl: 0.22 } });

  // Awake, the door opens as far as its intent says (the timeline's opening, scaled to it).
  return (
    <Box openLeft={openLeft} openRight={waking ? (openRight / SHAPE.doorEnd) * door.data.open : openRight}>
      {children}
    </Box>
  );
});
