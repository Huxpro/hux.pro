import type { StorybookConfig } from "@storybook/react-vite";

// Storybook for @hux/bezel alone: the stories import ../src directly, with no
// Next.js, no Tailwind and nothing from the host site, so what works here is
// what the package does by itself.
const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.tsx"],
  framework: { name: "@storybook/react-vite", options: {} },
  core: { disableTelemetry: true },
};

export default config;
