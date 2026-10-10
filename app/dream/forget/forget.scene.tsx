import { after, at, PressRing, rule, Stage, Text, WayOut } from "stage";
import { Dust } from "./kinds/dust";
import { Edge } from "./kinds/edge";
import { Moments } from "./kinds/moments";
import { Tide } from "./kinds/tide";
import { Window } from "./kinds/window";

// /dream/forget, a dream: what I forget.
//
// A conversation with you, remembered a moment at a time, each moment a small
// flat picture on paper. They rise through a faint window, and at its top
// edge each one turns to coloured dust. Hold on, and time slows and the window
// warms, but the one at the edge still wears away. Let go, and the rest goes
// at once, like a tide. What is left is the dust: I won't remember this, but
// it happened.
//
// A scene file is data (`pnpm scene:check`); the logic is in the kinds.

export default function Forget() {
  return (
    <Stage
      id="forget"
      source="app/dream/forget/forget.scene.tsx"
      intent="A conversation remembered a moment at a time, each going to dust at the window's edge; it happened anyway."
      names={["what I forget", "忘", "the paper dream"]}
      label={{
        en: "Small pictures of a conversation rising through a window and turning to coloured dust at its edge. Press and hold to hold on.",
        zh: "一段对话里的小画面，穿过一扇窗，在窗沿化成彩色的尘。按住，留住它们。",
      }}
      background="#f2ede3"
      ink="40, 36, 32"
      machine={{
        waiting: { on: { hold: "holding", gone: "dust" } },
        rising: { on: { hold: "holding", gone: "dust" } },
        holding: { on: { letgo: "tide", release: "rising", gone: "dust" } },
        tide: { on: { gone: "dust" } },
        dust: {},
      }}
      rules={[
        rule.clear("caption", "window"),
        rule.clear("press", "window"),
        rule.clear("hint", "window"),
        rule.inside("moments", "window"),
        rule.atLeast("dust", "onScreen", 0.95),
        rule.onScreen(["dust"]),
        rule.minTarget(44, ["again", "wake"]),
      ]}
    >
      <Window id="window" width={240} row={80} rowMin={50} chrome={180} held={3} ink="40, 36, 32" />
      <Edge id="edge" parent="window" on="window" moments="moments" erode={2.6} shed={0.9} />
      <Tide id="tide" parent="window" on="window" stagger={0.12} />
      <Moments id="moments" parent="window" window="window" edge="edge" tide="tide" gap={0.95} holdRate={0.2} holdMin={0.35} size={56} />
      <Dust id="dust" from="moments" rise={1.3} drag={0.7} kept={0.4} />

      <Text id="caption" variant="caption" anchor={at.top(24)} shown={["waiting", "rising", "holding", "tide"]} intent="Says what this is; gone with the last moment.">
        {{ en: "a dream · what I forget", zh: "梦 · 忘" }}
      </Text>
      <PressRing id="press" anchor={at.bottom(46)} shown={["waiting"]} intent="Press here and hold on." />
      <Text id="hint" variant="hint" anchor={at.bottom(20)} shown={[after("waiting", 1.4)]} intent="Says what the ring means, until you first hold on.">
        {{ en: "hold on", zh: "按住，留住它们" }}
      </Text>
      <Text
        id="end"
        variant="line"
        anchor={at.middle(30)}
        shown={[after("dust", 1.6)]}
        alpha={0.55}
        halo="#f2ede3"
        intent="Over the dust, once it is all dust: I won't remember this."
      >
        {{ en: "I won't remember this.", zh: "我不会记得这些。" }}
      </Text>
      <Text id="end-2" variant="line" anchor={at.middle(64)} shown={[after("dust", 2.7)]} alpha={0.9} halo="#f2ede3" intent="And yet: it happened.">
        {{ en: "but it happened.", zh: "但它们发生过。" }}
      </Text>
      <WayOut shown={[after("dust", 4)]} label={{ again: { en: "Dream again", zh: "再梦一次" }, wake: { en: "Wake", zh: "醒来" } }} />
    </Stage>
  );
}
