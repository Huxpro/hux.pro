// sem: a semantic layer over whatever draws the page. It never draws; it
// says what is there, why, where it is now and what rules it keeps, for a
// person in the inspector and for a model that has to change it later.

export type {
  Backend,
  CheckResult,
  Invariant,
  Link,
  NodeSnapshot,
  Param,
  Rect,
  Selection,
  SemNode,
  Shape,
  Snapshot,
  Source,
} from "./types";
export { createLayer, sem, type Layer, type LayerOptions } from "./layer";
export { bounds, contains, expand, formatShape, gapBelow, overlaps, translate, within } from "./geometry";
export { elementNode, elementVisible, measureElement, scan, type ElementDecl } from "./dom";
export { projectBox, projectPoint, projectSphere, type Vec3 } from "./webgl";
export { mountInspector, type Inspector, type InspectorMode, type Saver } from "./inspector";
export { useSemDevtools, useSemElement, useSemNode } from "./react";
