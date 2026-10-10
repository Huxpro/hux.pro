// =============================================================================
// window.__scene: a running scene, open to an inspector (and to an agent).
//
// Same origin is enough: the lab frames the experience and calls this on the
// frame's window. A script can call it through a headless browser. Everything
// it returns is plain data in scene units, plus one matrix to the screen.
// =============================================================================

import type { Clock } from "./clock";
import { measureGeometry, measureVisible, sceneToClient, type Box, type Pick } from "./measure";
import { isNode, parsePath } from "./path";
import type { Registry } from "./registry";
import { DECLARATIONS, type Declaration } from "./spec";
import { verify, type Report } from "./verify";

export interface Still {
  name: string;
  /** What a person would call this moment. */
  label?: string;
  /** Paths that must be visible here (the verifier checks). */
  expect?: readonly string[];
}

export interface NodeView {
  path: string;
  host: "svg" | "canvas";
  geometry: Box | null;
  visible: Box | null;
}

export interface InstanceView extends NodeView {
  entity: string;
  instance: string | null;
  props: Record<string, unknown>;
  parts: NodeView[];
}

export interface Snapshot {
  t: number;
  frozen: boolean;
  still: string | null;
  frame: { x: number; y: number; width: number; height: number };
  /** Scene units → the stage's client pixels: [a, b, c, d, e, f]. */
  toClient: [number, number, number, number, number, number];
  instances: InstanceView[];
  coverage: number;
  unclaimed: Box | null;
}

export interface SceneApi {
  version: 1;
  manifest(): Declaration[];
  stills(): readonly Still[];
  goto(name: string): void;
  play(): void;
  snapshot(): Promise<Snapshot>;
  /** Client pixels within the stage → the path drawn there (from the last snapshot). */
  hitTest(x: number, y: number): string | null;
  setOverride(key: string, prop: string, value: unknown): void;
  clearOverrides(): void;
  overrides(): Record<string, Record<string, unknown>>;
  setFlag(name: string, on: boolean): void;
  flags(): string[];
  verify(): Promise<Report>;
}

declare global {
  interface Window {
    __scene?: SceneApi;
  }
}

export interface ApiDeps {
  svg: () => SVGSVGElement | null;
  registry: Registry;
  clock: Clock;
  stills: () => readonly Still[];
  onStill: (name: string | null, t: number) => void;
}

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export function installApi(deps: ApiDeps): () => void {
  const { registry, clock } = deps;
  let still: string | null = null;
  let lastPick: Pick | null = null;

  const goto = (name: string) => {
    const t = clock.now();
    clock.freeze(t);
    still = name;
    deps.onStill(name, t);
  };
  const play = () => {
    still = null;
    clock.resume();
    deps.onStill(null, clock.now());
  };

  const snapshot = async (): Promise<Snapshot> => {
    const svg = deps.svg();
    if (!svg) throw new Error("scene: not mounted");
    const geometry = measureGeometry(svg);
    const pick = await measureVisible(svg, registry, clock.now());
    lastPick = pick;
    const vb = svg.viewBox.baseVal;
    const canvasPaths = new Set(registry.draws.map((d) => d.path));
    const node = (path: string): NodeView => ({
      path,
      host: canvasPaths.has(path) ? "canvas" : "svg",
      geometry: geometry.get(path) ?? (canvasPaths.has(path) ? pick.boxes.get(path) ?? null : null),
      visible: pick.boxes.get(path) ?? null,
    });
    const all = new Set([...geometry.keys(), ...pick.boxes.keys()]);
    const instances: InstanceView[] = [...registry.instances.values()]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((rec) => ({
        ...node(rec.path),
        entity: rec.entity,
        instance: rec.instance,
        props: rec.props,
        parts: [...all]
          .filter((p) => p.startsWith(rec.path + ".") && isNode(p))
          .sort()
          .map(node),
      }));
    // Canvas drawings whose owner has no svg instance still show up.
    for (const d of registry.draws) {
      const { entity, instance } = parsePath(d.path);
      const root = instance ? `${entity}[${instance}]` : entity;
      if (!registry.instances.has(root) && !instances.some((i) => i.path === root)) {
        instances.push({ ...node(root), host: "canvas", entity, instance, props: {}, parts: [node(d.path)] });
      }
    }
    return {
      t: clock.now(),
      frozen: clock.isFrozen(),
      still,
      frame: { x: vb.x, y: vb.y, width: vb.width, height: vb.height },
      toClient: sceneToClient(svg),
      instances,
      coverage: pick.coverage,
      unclaimed: pick.unclaimed,
    };
  };

  const api: SceneApi = {
    version: 1,
    manifest: () => [...DECLARATIONS.values()],
    stills: () => deps.stills(),
    goto,
    play,
    snapshot,
    hitTest: (x, y) => {
      const svg = deps.svg();
      const m = svg?.getScreenCTM();
      if (!svg || !m || !lastPick) return null;
      const r = svg.getBoundingClientRect();
      const p = new DOMPoint(x + r.left, y + r.top).matrixTransform(m.inverse());
      return lastPick.at(p.x, p.y);
    },
    setOverride: (key, prop, value) => registry.setOverride(key, prop, value),
    clearOverrides: () => registry.clearOverrides(),
    overrides: () => Object.fromEntries(registry.overrides),
    setFlag: (name, on) => registry.setFlag(name, on),
    flags: () => [...registry.flags],
    verify: () => verify({ svg: deps.svg, registry, clock, stills: deps.stills(), goto, play, isPlaying: () => still === null }),
  };
  window.__scene = api;
  return () => {
    if (window.__scene === api) delete window.__scene;
  };
}
