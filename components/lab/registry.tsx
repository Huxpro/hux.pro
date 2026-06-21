import type { ComponentType } from "react";
import { SpotlightDemo } from "./demos/spotlight";

/**
 * Registry of inline lab demos.
 *
 * Frontmatter can't carry a live component, so `type: inline` items map their
 * slug to a React component here. The Stage looks up the component by slug.
 */
export const labDemos: Record<string, ComponentType> = {
  spotlight: SpotlightDemo,
};
