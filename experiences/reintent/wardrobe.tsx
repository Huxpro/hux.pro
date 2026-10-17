/** @jsxImportSource reintent-core */
// =============================================================================
// The Wardrobe's program, as the model first wrote it: the things, and on each
// the intents a person might want otherwise, with the model's belief. This is
// the same reading as experiences/wardrobe/intents.ts, written for Reintent
// core: TSX that evaluates to data, typed by the kinds in kinds.ts.
// =============================================================================

import { Intent, Scene, Thing, toProgram } from "reintent-core";
import { Gaze, Open, Pace, Place, Size } from "./kinds";

export const PROMPT =
  "我梦到一个穿着黑色衣服，很瘦很高的男人站在我的床头看着我。他的头上戴着那种像犹太人一样圆圆的大的帽子，但是比犹太人的帽子大很多。他一开始站在我的衣柜里面，后来把衣柜门打开，走出来站在我的床头看着我。后来我醒了，醒了之后发现我卧室的柜门确实正在打开。";

export default toProgram(
  <Scene id="wardrobe" version="v1" by="model:strong" title="衣柜 · The Wardrobe" prompt={PROMPT}>
    <Thing id="man" draws="man" label="他 · the man" aka={["他", "男人", "黑衣人", "man", "him"]}>
      {/* "大很多": much bigger, or absurdly so? Not sure: it asks. */}
      <Intent name="hat" of={Size} label="帽子有多大 · the hat" aka={["帽子", "帽", "hat"]} p={{ usual: 0.04, big: 0.52, absurd: 0.44 }} resolve="ask" view={["man.hat"]} />
      <Intent name="gaze" of={Gaze} label="看着谁 · his gaze" aka={["看", "眼睛", "盯", "look", "eyes"]} p={{ me: 0.93, away: 0.07 }} view={["man.eyes"]} />
      <Intent name="stand" of={Place} label="站在哪 · where he stands" aka={["站", "站在", "走到", "站到", "stand"]} p={{ bedside: 0.46, foot: 0.42, window: 0.12 }} view={["man[bedside]"]} />
    </Thing>
    <Thing id="wardrobe" draws="wardrobe" label="衣柜 · the wardrobe" aka={["衣柜", "柜子", "柜门", "门", "wardrobe", "door"]}>
      <Intent name="door" of={Open} label="柜门开多大 · how far the door opens" aka={["柜门", "门", "door"]} p={{ ajar: 0.12, half: 0.58, wide: 0.3 }} view={["wardrobe.door.right"]} />
      <Intent name="pace" of={Pace} label="开得多慢 · how slowly" aka={["速度", "pace"]} p={{ sudden: 0.08, slow: 0.7, crawl: 0.22 }} view={["beat.door"]} />
    </Thing>
  </Scene>,
);
