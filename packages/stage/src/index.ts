// stage: React on top, the original drawing underneath. A scene is a tree of
// placed kinds (and DOM words) with its phases and rules, written as data; a
// kind is where the logic lives (init, step, frame, draw, measure); the host
// runs the frame and tells sem what it drew.

export { after, at, isRef, ref, rule, type Anchor, type Ref, type Rule, type When, type Words } from "./bind";
export type { Ctx, KindDef, Layout, ParamSpec, Point, Rng, Time } from "./kind";
export { createMachine, type Machine, type MachineConfig } from "./machine";
export { Stage as StageHost, isShown, seeded, type NodeProps } from "./store";
export { kind, Stage, StageProvider, Text, WayOut, type Bound, type StageProps } from "./react";
