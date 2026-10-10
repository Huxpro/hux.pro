// =============================================================================
// scene: a thin semantic layer over React for short interactive scenes.
// See docs/system-scene.md.
// =============================================================================

export { num, choice, DECLARATIONS, type Declaration, type Param, type Params, type ParamValues, type NumberParam, type ChoiceParam } from "./spec";
export { parsePath, instancePath, prefixes, isDeclared, isNode, reaches, type ParsedPath } from "./path";
export { semantic, Part, Atmosphere, useOwner, type SemanticComponent, type SemanticProps } from "./semantic";
export { timeline, beat, type TimelineSpec, type TimelineValues, type Timing, type BeatSpec, type PhaseSpec, type InputSpec } from "./timeline";
export { Stage, Draw, useTime, useNow, useFrame, useFlag, useTimeline, useRegistry, type StageProps } from "./stage";
export type { SceneApi, Snapshot, InstanceView, NodeView, Still } from "./api";
export type { Report, Issue } from "./verify";
export type { Box } from "./measure";
export type { DrawFn } from "./registry";
export type { LanguageLayer, Concept, Localized } from "./language";
