import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  // The bezel owns the whole viewport, so stories render edge to edge.
  parameters: { layout: "fullscreen" },
};

export default preview;
