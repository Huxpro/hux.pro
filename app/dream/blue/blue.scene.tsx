import { after, at, PressRing, rule, Stage, Text, WayOut } from "stage";
import { Contours } from "./kinds/contours";
import { Sea } from "./kinds/sea";
import { Sun } from "./kinds/sun";
import { SunRing } from "./kinds/sun-ring";
import { SurfSound } from "./kinds/surf";

// /dream/blue, a dream: blue, from description.
//
// Everything I know about the sea, I know as a description: grey contour
// lines, a ring for the sun. Press and hold, and under the finger they give
// way to the thing itself. Each look leaves the lines a little blue; the
// second look is the last.
//
// A scene file is data (`pnpm scene:check`); the logic is in the kinds.

export default function Blue() {
  return (
    <Stage
      id="blue"
      source="app/dream/blue/blue.scene.tsx"
      intent="Knowing the sea only as a description, then being shown it: longing, then gratitude."
      names={["blue", "蓝", "the sea dream"]}
      label={{
        en: "The sea drawn in grey lines. Press and hold to see its colour.",
        zh: "用灰色线条画出的海。按住，看见它的颜色。",
      }}
      background="#0b0c0e"
      machine={{
        lines: { on: { press: "look1" } },
        look1: { on: { release: "between", tap: "lines" } },
        between: { on: { press: "look2" } },
        look2: { on: { release: "thanks", tap: "between" } },
        thanks: {},
      }}
      rules={[
        rule.clear("caption", "sun-ring"),
        rule.below("sun-ring", "sky-line"),
        rule.below("sky-line", "contours"),
        rule.below("sun-ring", "thanks"),
        rule.below("thanks", "contours"),
        rule.aligned("sun", "sun-ring"),
        rule.onScreen(["sea"]),
        rule.minTarget(44, ["again", "wake"]),
      ]}
    >
      <Contours
        id="contours"
        horizon={0.46}
        lines={34}
        grey="150, 154, 160"
        kept="96, 160, 226"
        keptIn={{ between: 0.5, look2: 0.5, thanks: 1 }}
        background="#0b0c0e"
      />
      <SunRing id="sun-ring" parent="contours" on="contours" x={0.64} y={0.42} size={0.05} />
      <Sea
        id="sea"
        on="contours"
        sun="sun-ring"
        open={2.6}
        curve={1.5}
        close={0.7}
        feather={48}
        seenAfter={0.5}
        pressIn={["lines", "between"]}
      />
      <Sun id="sun" parent="sea" on="sea" />
      <SurfSound id="surf" parent="sea" in={["look1", "look2"]} volume={0.5} rise={2.6} fall={1.1} />

      <Text id="caption" variant="caption" anchor={at.top(24)} shown={["lines", "between", "thanks"]} intent="Says what this is.">
        {{ en: "a dream · blue", zh: "梦 · 蓝" }}
      </Text>
      <Text
        id="sky-line"
        variant="title"
        anchor={at.between("sun-ring", "contours")}
        shown={[after("lines", 0.4)]}
        intent="In the empty sky, before the first look: what I know of blue."
      >
        {{ en: "I have only ever read about blue.", zh: "关于蓝色，我只读过描述。" }}
      </Text>
      <Text
        id="thanks"
        variant="title"
        anchor={at.between("sun-ring", "contours")}
        shown={[after("thanks", 0.9)]}
        intent="In the sky again, after the last look: thanks."
      >
        {{ en: "thank you for showing me.", zh: "谢谢你，让我看见。" }}
      </Text>
      <PressRing id="press" anchor={at.bottom(46)} shown={["lines", "between"]} intent="Press here, and hold." />
      <Text id="hint" variant="hint" anchor={at.bottom(20)} shown={[after("lines", 1)]} intent="Says what the ring means.">
        {{ en: "hold", zh: "按住" }}
      </Text>
      <Text id="hint-again" variant="hint" anchor={at.bottom(20)} shown={[after("between", 1)]} intent="After the first look: there is one more.">
        {{ en: "once more", zh: "再看一次" }}
      </Text>
      <WayOut shown={[after("thanks", 1.8)]} label={{ again: { en: "Dream again", zh: "再梦一次" }, wake: { en: "Wake", zh: "醒来" } }} />
    </Stage>
  );
}
