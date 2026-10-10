import { kind } from "stage";

// The sun itself, seen only where the sea is open. The sea paints it; this
// node is what it painted, so the inspector and the rules can see it.

type SunOut = [number, number, number];

export const Sun = kind<{ on: string }, null, SunOut | null>({
  name: "Sun",
  kind: "agent",
  names: ["the sun", "the real sun", "太阳"],
  intent: "The sun itself, seen only where the sea is open.",
  source: "app/dream/blue/kinds/sun.ts",
  frame: (_s, { on }, { out }) => out<{ sun: SunOut | null }>(on)?.sun ?? null,
  measure: (o) => (o ? { circle: o } : null),
});
