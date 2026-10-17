// The model's beliefs, as it wrote each version of the program: kept in the
// source as the model's, by path (what reintent's settle weighs against TAU).
import type { Belief, Dist } from "reintent-core";

const MAN = "Dream:wardrobe/Man:man";
const WARDROBE = "Dream:wardrobe/Wardrobe:wardrobe";

export const V1: Record<string, Dist> = {
  [`${MAN}#hat`]: { usual: 0.04, big: 0.52, absurd: 0.44 },
  [`${MAN}#gaze`]: { me: 0.93, away: 0.07 },
  [`${MAN}#stand`]: { bedside: 0.46, foot: 0.42, window: 0.12 },
  [`${WARDROBE}#door`]: { ajar: 0.12, half: 0.58, wide: 0.3 },
  [`${WARDROBE}#pace`]: { sudden: 0.08, slow: 0.7, crawl: 0.22 },
};

/** The rewrite: a towering hat, a gaze it is unsure of, and no belief about the pace (it follows the door). */
export const V2: Record<string, Dist> = {
  [`${MAN}#hat`]: { usual: 0.04, big: 0.5, towering: 0.46 },
  [`${MAN}#gaze`]: { me: 0.55, away: 0.45 },
  [`${MAN}#stand`]: { bedside: 0.46, foot: 0.42, window: 0.12 },
  [`${WARDROBE}#door`]: { ajar: 0.12, half: 0.58, wide: 0.3 },
};

const ENDING = "Dream:wardrobe/Choose:ending#ending";

/**
 * The tree's own choice: is he still there? The model is torn (0.55 / 0.45). Its belief about the
 * door is given the ending: gone into the wardrobe, it is left ajar behind him; still waiting, it
 * is flung wide. Settled on its own, the ending is code's (he waits) and the door wide (0.33 in
 * all); the likeliest world is the other one (gone, ajar: 0.36).
 */
export const V3: Record<string, Belief> = {
  ...V2,
  [ENDING]: { waits: 0.55, gone: 0.45 },
  [`${WARDROBE}#door`]: {
    $given: [
      { when: { [ENDING]: "gone" }, p: { ajar: 0.8, half: 0.15, wide: 0.05 } },
      { when: { [ENDING]: "waits" }, p: { ajar: 0.05, half: 0.35, wide: 0.6 } },
    ],
  },
};

/** The choices the lab's worlds are over: the tree's, and the door that goes with it. The rest are summed out. */
export const WORLD_OF = (path: string) => path === ENDING || path === `${WARDROBE}#door`;
