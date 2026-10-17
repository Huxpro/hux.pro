/** @jsxImportSource reintent-core */
// =============================================================================
// The Wardrobe's program, rewritten by the model (say, after "make the hat a
// thing of its own, and let the door decide its own pace"). What changed:
//
//   man.hat      "absurd" is gone; "towering" (a hat past any sense) replaces it.
//                A person's "absurd" is parked, not lost: back to v1, it is back.
//   man.gaze     now unsure (a dream that looks away is as likely): it asks.
//   wardrobe.pace  a relation: a door flung wide opens all at once.
//
// Switching between this and wardrobe.tsx is the program changing under a
// running doc: reconcile keeps every decision whose path and kind remain.
// =============================================================================

import { Intent, Scene, Thing, intent, toProgram } from "reintent-core";
import { Gaze, Open, Pace, Place } from "./kinds";
import { PROMPT } from "./wardrobe";

const Hat = intent(
  {
    usual: { label: "寻常 · usual", words: ["寻常", "正常", "普通"], hatScale: 1 },
    big: { label: "大很多 · much bigger", words: ["大很多"], hatScale: 1.45 },
    towering: { label: "顶天 · towering", words: ["顶天", "高耸", "towering"], hatScale: 2.4 },
  },
  { ordered: true },
);

export default toProgram(
  <Scene id="wardrobe" version="v2" by="model:strong" title="衣柜 · The Wardrobe" prompt={PROMPT}>
    <Thing id="man" draws="man" label="他 · the man" aka={["他", "男人", "黑衣人", "man", "him"]}>
      <Intent name="hat" of={Hat} label="帽子有多大 · the hat" aka={["帽子", "帽", "hat"]} p={{ usual: 0.04, big: 0.5, towering: 0.46 }} resolve="ask" view={["man.hat"]} />
      <Intent name="gaze" of={Gaze} label="看着谁 · his gaze" aka={["看", "眼睛", "盯", "look", "eyes"]} p={{ me: 0.55, away: 0.45 }} resolve="ask" view={["man.eyes"]} />
      <Intent name="stand" of={Place} label="站在哪 · where he stands" aka={["站", "站在", "走到", "站到", "stand"]} p={{ bedside: 0.46, foot: 0.42, window: 0.12 }} view={["man[bedside]"]} />
    </Thing>
    <Thing id="wardrobe" draws="wardrobe" label="衣柜 · the wardrobe" aka={["衣柜", "柜子", "柜门", "门", "wardrobe", "door"]}>
      <Intent name="door" of={Open} label="柜门开多大 · how far the door opens" aka={["柜门", "门", "door"]} p={{ ajar: 0.12, half: 0.58, wide: 0.3 }} view={["wardrobe.door.right"]} />
      <Intent
        name="pace"
        of={Pace}
        label="开得多慢 · how slowly"
        aka={["速度", "pace"]}
        p={{ sudden: 0.08, slow: 0.7, crawl: 0.22 }}
        derive={(read) => (read("wardrobe.door") === "wide" ? "sudden" : undefined)}
        view={["beat.door"]}
      />
    </Thing>
  </Scene>,
);
