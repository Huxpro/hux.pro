// =============================================================================
// The verifier: what an agent runs right after it writes a scene.
//
//   declared       every data-sem path and every <Draw> names a declared thing
//                  and one of its declared parts
//   expected       each still shows what it says it shows
//   deterministic  the same moment, rendered twice, is the same pixels
//   coverage       every pixel drawn belongs to some thing (atmosphere aside)
//   local          turning a param moves only its own instance (or the parts
//                  it declares it affects), and nothing else in the scene
//
// Each failure says what to do about it: the report is read by whoever wrote
// the scene, which is often a model.
// =============================================================================

import type { Still } from "./api";
import type { Clock } from "./clock";
import { measureGeometry, measureVisible, type Box } from "./measure";
import { isDeclared, parsePath } from "./path";
import type { Registry } from "./registry";
import { DECLARATIONS, type NumberParam } from "./spec";

export interface Issue {
  check: "declared" | "expected" | "deterministic" | "coverage" | "local";
  still?: string;
  message: string;
}

export interface Report {
  ok: boolean;
  checked: { stills: number; paths: number; params: number };
  issues: Issue[];
  /** One line per param that was turned: what moved. */
  perturbations: { still: string; path: string; param: string; from: number; to: number; moved: string[]; ok: boolean }[];
  coverage: { still: string; ratio: number }[];
}

interface Deps {
  svg: () => SVGSVGElement | null;
  registry: Registry;
  clock: Clock;
  stills: readonly Still[];
  goto: (name: string) => void;
  play: () => void;
  isPlaying: () => boolean;
}

const frames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (k: number) => (k <= 0 ? resolve() : requestAnimationFrame(() => step(k - 1)));
    step(n);
  });

/** Run with performance.now() and Date.now() reading hours later than they are. */
async function withWallClockShifted<T>(fn: () => Promise<T>): Promise<T> {
  const perf = performance.now.bind(performance);
  const date = Date.now;
  const SHIFT = 3.7e6;
  performance.now = () => perf() + SHIFT;
  Date.now = () => date() + SHIFT;
  try {
    return await fn();
  } finally {
    performance.now = perf;
    Date.now = date;
  }
}

const same = (a: Box | undefined, b: Box | undefined, tol = 0.25) =>
  !!a && !!b && Math.abs(a.x0 - b.x0) <= tol && Math.abs(a.y0 - b.y0) <= tol && Math.abs(a.x1 - b.x1) <= tol && Math.abs(a.y1 - b.y1) <= tol;

export async function verify(deps: Deps): Promise<Report> {
  const { registry, clock } = deps;
  const svg = deps.svg();
  if (!svg) throw new Error("scene: not mounted");
  const wasPlaying = deps.isPlaying();
  const t0 = clock.now();
  const issues: Issue[] = [];
  const perturbations: Report["perturbations"] = [];
  const coverage: Report["coverage"] = [];
  const seenPaths = new Set<string>();
  const turned = new Set<string>();

  const stills = deps.stills.length ? deps.stills : [{ name: "now" } as Still];
  for (const still of stills) {
    if (deps.stills.length) deps.goto(still.name);
    await frames(3);

    // Declared: every name used, in the svg and on the canvas.
    const used = [...svg.querySelectorAll("[data-sem]")].map((el) => el.getAttribute("data-sem")!);
    for (const d of registry.draws) used.push(d.path);
    for (const path of used) {
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);
      if (!isDeclared(path)) {
        const { entity, part } = parsePath(path);
        issues.push({
          check: "declared",
          still: still.name,
          message: DECLARATIONS.has(entity)
            ? `"${path}" uses part "${part}", which "${entity}" does not declare. Add it to the declaration's parts, or rename the <Part>.`
            : `"${path}" names "${entity}", which nothing declares. Draw it through semantic({ id: "${entity}", … }).`,
        });
      }
    }

    // Deterministic, expected, covered. The same held moment is drawn twice,
    // the second time with the wall clock pushed hours ahead: anything that
    // reads it (instead of useTime) moves, and so does unseeded randomness.
    const a = await measureVisible(svg, registry, clock.now());
    const b = await withWallClockShifted(async () => {
      await frames(2);
      return measureVisible(svg, registry, clock.now());
    });
    const moved = [...a.boxes.keys()].filter((k) => !same(a.boxes.get(k), b.boxes.get(k), 0));
    if (moved.length) {
      issues.push({
        check: "deterministic",
        still: still.name,
        message: `At "${still.name}", the same moment drew differently twice: ${moved.slice(0, 4).join(", ")}. Read time from useTime(), and seed any randomness.`,
      });
    }
    for (const path of still.expect ?? []) {
      if (!a.boxes.get(path)?.px) {
        issues.push({ check: "expected", still: still.name, message: `"${still.name}" should show "${path}", and nothing of it is visible.` });
      }
    }
    coverage.push({ still: still.name, ratio: a.coverage });
    if (a.unclaimed && a.unclaimed.px > 8) {
      const u = a.unclaimed;
      issues.push({
        check: "coverage",
        still: still.name,
        message: `At "${still.name}", ${Math.round(u.px)} px are drawn by nothing declared, around (${u.x0.toFixed(0)}, ${u.y0.toFixed(0)})–(${u.x1.toFixed(0)}, ${u.y1.toFixed(0)}). Wrap them in a semantic component or a <Part>, or in <Atmosphere> if they are not a thing.`,
      });
    }

    // Local: turn each number param of each thing on stage, once.
    for (const rec of registry.instances.values()) {
      const decl = DECLARATIONS.get(rec.entity);
      for (const [name, spec] of Object.entries(decl?.params ?? {})) {
        if (spec.kind !== "number" || turned.has(`${rec.path}:${name}`)) continue;
        turned.add(`${rec.path}:${name}`);
        const p = spec as NumberParam;
        const from = Number(rec.props[name] ?? p.default);
        const span = p.max - p.min;
        const to = from + span * 0.25 <= p.max ? from + span * 0.25 : from - span * 0.25;
        const prior = registry.overrides.get(rec.path)?.[name];
        const before = measureGeometry(svg);
        registry.setOverride(rec.path, name, to);
        await frames(2);
        const after = measureGeometry(svg);
        registry.setOverride(rec.path, name, prior);
        await frames(1);
        const allowed = (path: string) => {
          if (path === rec.path) return true;
          if (!path.startsWith(rec.path + ".")) return false;
          if (!p.affects) return true;
          const part = path.slice(rec.path.length + 1);
          return p.affects.some((x) => part === x || part.startsWith(x + "."));
        };
        const changed = [...new Set([...before.keys(), ...after.keys()])].filter((k) => !same(before.get(k), after.get(k)));
        const stray = changed.filter((k) => !allowed(k));
        const ok = stray.length === 0;
        perturbations.push({ still: still.name, path: rec.path, param: name, from, to, moved: changed, ok });
        if (ok && changed.length === 0 && (p.effect ?? "shape") === "shape") {
          issues.push({
            check: "local",
            still: still.name,
            message: `Turning ${rec.path}.${name} from ${from} to ${to} moved nothing. Read it from props where it is drawn (a number written into the drawing does not follow the param), or mark it effect: "appearance".`,
          });
        }
        if (!ok) {
          issues.push({
            check: "local",
            still: still.name,
            message: `Turning ${rec.path}.${name} from ${from} to ${to} also moved ${stray.join(", ")}. A param should move only its own thing${p.affects ? ` (declared: ${p.affects.join(", ")})` : ""}.`,
          });
        }
      }
    }
  }

  if (wasPlaying) deps.play();
  else clock.freeze(t0);
  return {
    ok: issues.length === 0,
    checked: { stills: stills.length, paths: seenPaths.size, params: turned.size },
    issues,
    perturbations,
    coverage,
  };
}
