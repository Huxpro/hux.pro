import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Bezel,
  BEZEL_BAND_MAX,
  BEZEL_INSET,
  BEZEL_LAYER_ATTRIBUTE,
  BEZEL_RADIUS_MAX,
  pageScrollTop,
  useBezel,
  usePageScroll,
  type BezelProps,
} from "../src";
import { useState } from "react";
import { Backdrop, Page } from "./page";

function Readout() {
  const bezel = useBezel();
  const [top, setTop] = useState(0);
  usePageScroll(() => setTop(Math.round(pageScrollTop())));
  return (
    <pre
      style={{
        position: "sticky",
        top: 12,
        margin: "0 0 24px",
        padding: 12,
        borderRadius: 12,
        background: "rgba(255,255,255,0.8)",
        fontSize: 12,
      }}
    >
      {JSON.stringify({ ...bezel, pageScrollTop: top }, null, 2)}
    </pre>
  );
}

const meta = {
  title: "Bezel",
  component: Bezel,
  args: {
    enabled: true,
    color: "#000000",
    band: 0,
    radius: 16,
    scroll: "container",
    ground: "#ffffff",
  },
  argTypes: {
    color: { control: "color" },
    ground: { control: "color" },
    band: { control: { type: "range", min: 0, max: BEZEL_BAND_MAX, step: 1 } },
    radius: { control: { type: "range", min: 0, max: BEZEL_RADIUS_MAX, step: 2 } },
    scroll: { control: "inline-radio", options: ["window", "container"] },
    enabled: { control: "boolean" },
  },
  render: (args: BezelProps) => (
    <Bezel
      {...args}
      backdrop={<Backdrop layerProps={{ [BEZEL_LAYER_ATTRIBUTE]: "" }} style={BEZEL_INSET} />}
    >
      <Page>
        <Readout />
      </Page>
    </Bezel>
  ),
} satisfies Meta<typeof Bezel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop is live: change a control and the bezel, the scroll mode and the chrome follow. */
export const Playground: Story = {};

/** A thick band and large corners, to see the geometry. */
export const ThickBand: Story = { args: { band: 24, radius: 32 } };

/** Off: nothing drawn, the window scrolls, the chrome takes the ground. */
export const Off: Story = { args: { enabled: false, scroll: "window" } };

/** A custom colour. On iOS the chrome should follow it without a reload. */
export const Coloured: Story = { args: { color: "#c1440e" } };
