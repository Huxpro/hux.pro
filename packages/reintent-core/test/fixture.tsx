/** @jsxImportSource reintent-core */
// A program in TSX, type-checked by `pnpm reintent:typecheck` (tsc -p packages/reintent-core).
// It holds the typing to what the docs promise: kinds from `of`, and a wrong one is an error.

import { Intent, Scene, Thing, intent, toProgram, type DataOf, type KindOf, type Program } from "reintent-core";

export const Size = intent(
  {
    usual: { words: ["寻常"], hatScale: 1 },
    big: { words: ["大很多"], hatScale: 1.45 },
    absurd: { words: ["大得离谱"], hatScale: 1.95 },
  },
  { ordered: true },
);

export const Place = intent({
  bed: { words: ["床头"], at: [236, 872] },
  window: { words: ["窗边"], at: [118, 708] },
});

const kind: KindOf<typeof Size> = "absurd";
const data: DataOf<typeof Size> = { hatScale: 2 };
void kind;
void data;

export const PROGRAM: Program = toProgram(
  <Scene id="fixture">
    <Thing id="man" aka={["他"]}>
      <Intent name="hat" of={Size} p={{ big: 0.52, absurd: 0.44 }} resolve="ask" />
      <Intent name="where" of={Place} pick="window" />
    </Thing>
    <Thing id="cat">
      <Intent name="where" of={Place} follows="man.where" />
      <Intent name="size" of={Size} derive={(read) => (read("man.hat") === "absurd" ? "big" : undefined)} />
    </Thing>
  </Scene>,
);

export const WRONG = (
  <Scene id="wrong">
    <Thing id="man">
      {/* @ts-expect-error: "tiny" is not a kind of Size */}
      <Intent name="hat" of={Size} pick="tiny" />
      {/* @ts-expect-error: p names a kind Size does not have */}
      <Intent name="hat2" of={Size} p={{ tiny: 1 }} />
    </Thing>
  </Scene>
);
