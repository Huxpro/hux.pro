// The model's beliefs, as it wrote each version of the program: kept in the
// source as the model's, by path (what reintent's settle weighs against TAU).
import type { Dist } from "reintent-core";

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
