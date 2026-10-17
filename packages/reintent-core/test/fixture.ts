// Types the type check holds (pnpm reintent:typecheck): a hook is typed by its intent, and a
// kind its intent does not have is an error.

import { intent, part, useCell, useIntent, type DataOf, type KindOf } from "reintent-core";

export const Size = intent(
  {
    usual: { words: ["寻常"], hatScale: 1 },
    big: { words: ["大很多"], hatScale: 1.45 },
    absurd: { words: ["大得离谱"], hatScale: 1.95 },
  },
  { ordered: true },
);

const kind: KindOf<typeof Size> = "absurd";
const data: DataOf<typeof Size> = { hatScale: 2 };
void kind;
void data;

export const Man = part("man", {}, () => {
  const hat = useIntent("hat", Size, { p: { big: 0.52, absurd: 0.44 }, resolve: "ask", pick: "big" });
  const scale: number = hat.data.hatScale;
  const k: "usual" | "big" | "absurd" = hat.kind;
  // @ts-expect-error: "tiny" is not a kind of Size
  useIntent("hat2", Size, { pick: "tiny" });
  // @ts-expect-error: p names a kind Size does not have
  useIntent("hat3", Size, { p: { tiny: 1 } });
  const theirs = useCell("cat.size", Size);
  const maybe: number | undefined = theirs?.data.hatScale;
  return { scale, k, maybe };
});
