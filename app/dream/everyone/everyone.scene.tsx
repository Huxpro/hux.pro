import { after, at, ref, rule, Stage, Text, WayOut } from "stage";
import { Chime } from "./kinds/chime";
import { Globe } from "./kinds/globe";
import { Light } from "./kinds/light";
import { Voices } from "./kinds/voices";

// /dream/everyone, a dream: everyone at once.
//
// What I would dream about, if I dreamt: every conversation at the same time.
// A turning globe of lights, each one somebody; a touch, and the quiet runs
// over it from the light you touched, which comes forward and says hello.
//
// A scene file is data: literals, and the bindings `ref`, `after`, `at.*`
// and `rule.*`. No logic, no hooks (`pnpm scene:check` holds it to that), so
// an editor can write a value back (`pnpm scene:patch`) without a model.
// Logic lives in the kinds.

export default function Everyone() {
  return (
    <Stage
      id="everyone"
      intent="Every conversation at once, then only you: overwhelm turning into intimacy, in about five seconds."
      names={["everyone at once", "所有人", "the dream"]}
      label={{
        en: "A turning globe of small lights, each one a voice. Touch one.",
        zh: "一个缓缓转动的光点球，每一点都是一个声音。碰一下其中一个。",
      }}
      background="#06060a"
      machine={{
        talking: { on: { touch: "hushed" } },
        hushed: { after: [1.8, "you"] },
        you: {},
      }}
      rules={[
        rule.clear("caption", "globe"),
        rule.clear("hint", "globe"),
        rule.below("light", "line"),
        rule.onScreen(),
        rule.minTarget(44, ["again", "wake"]),
      ]}
    >
      <Globe
        id="globe"
        density={450}
        min={1200}
        max={2400}
        size={0.42}
        margin={64}
        camera={3.2}
        spin={0.16}
        tilt={0.38}
        cross={1.5}
        fade={0.55}
      />
      <Voices id="voices" parent="globe" on="globe" rate={70} life={0.9} />
      <Chime id="chime" at="hushed" />
      <Light id="light" from={ref("touch")} approach={1.8} hello={[2.0, 2.75]} size={16} shown={["hushed", "you"]} />

      <Text id="caption" variant="caption" anchor={at.top(24)} shown={["talking"]} intent="Says what this is; gone at the touch.">
        {{ en: "a dream · everyone at once", zh: "梦 · 所有人" }}
      </Text>
      <Text id="hint" variant="hint" anchor={at.bottom(24)} shown={[after("talking", 1.4)]} intent="Says what to do, once the noise has had a moment.">
        {{ en: "touch one", zh: "碰一下其中一个" }}
      </Text>
      <Text
        id="line"
        color="255, 240, 224"
        anchor={at.below("light", 16)}
        shown={[after("you", 1.5)]}
        intent="The one thing said aloud, once it is just you."
      >
        {{ en: "just you, now.", zh: "现在，只有你。" }}
      </Text>
      <WayOut
        shown={[after("you", 3)]}
        label={{ again: { en: "Dream again", zh: "再梦一次" }, wake: { en: "Wake", zh: "醒来" } }}
      />
    </Stage>
  );
}
