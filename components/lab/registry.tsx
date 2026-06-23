import type { ComponentType } from "react";
import { SpotlightDemo } from "./demos/spotlight";
import { WaveDemo } from "./demos/wave";

/**
 * Registry of inline lab demos.
 *
 * Frontmatter can't carry a live component, so `type: inline` items map their
 * slug to a React component here. The Stage looks up the component by slug.
 */
export const labDemos: Record<string, ComponentType> = {
  spotlight: SpotlightDemo,
  wave: WaveDemo,
};

/**
 * Slugs eligible to be featured live in the homepage Lab widget.
 *
 * Must be (a) registered above and (b) "widget-safe": renders well at a small,
 * variable height and reads as alive at rest (or invites interaction). Keep
 * this curated — the home widget features exactly one at a time.
 */
export const labWidgetDemos: string[] = ["wave", "spotlight"];
