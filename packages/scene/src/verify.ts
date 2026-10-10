// =============================================================================
// The verifier: what an agent runs right after it writes a scene.
//
//   declared       every data-sem path and every <Draw> names a declared thing
//                  and one of its declared parts
//   expected       each still shows what it says it shows
//   deterministic  the same moment, rendered twice, is the same pixels
//   coverage       every pixel drawn belongs to some thing (atmosphere aside)
//   local          turning a param (or a piece of state) moves only its own
//                  instance (or the parts it declares it affects), and
//                  nothing else in the scene
//   phase          every declared phase has a still, and each still gets the
//                  scene into the phase it says
//   language       every word the language layer resolves names something
//                  declared
//   atmosphere     no atmosphere covers most of the frame on its own (one
//                  that stays on its thing, like a rim, or a copy of the
//                  scene, is fine): what is drawn large is a thing
//
// Each failure says what to do about it: the report is read by whoever wrote
// the scene, which is often a model.
// =============================================================================

import type { Still } from "./api";
import type { Clock } from "./clock";
import type { LanguageLayer } from "./language";
import { measureAtmosphere, measureGeometry, measureVisible, type Box } from "./measure";
import { isDeclared, parsePath } from "./path";
import type { Registry } from "./registry";
import { DECLARATIONS, type NumberParam, type Param } from "./spec";
import type { TimelineSpec } from "./timeline";

/** Atmosphere over more of the frame than this is asked about. */
const ATMOSPHERE_MAX = 0.5;

export interface Issue {
  check: "declared" | "expected" | "deterministic" | "coverage" | "local" | "phase" | "language" | "atmosphere";
  still?: string;
  message: string;
}

export interface Report {
  ok: boolean;
  checked: { stills: number; paths: number; params: number; words: number };
  issues: Issue[];
  /** One line per param (or piece of state) that was turned: what moved. */
  perturbations: { still: string; path: string; param: string; kind: "param" | "state"; from: number; to: number; moved: string[]; ok: boolean }[];
  coverage: { still: string; ratio: number }[];
  atmosphere: { still: string; name: string; ratio: number }[];
}

interface Deps {
  svg: () => SVGSVGElement | null;
  registry: Registry;
  clock: Clock;
  stills: readonly Still[];
  timeline: TimelineSpec;
  language: LanguageLayer | null;
  phase: () => string | null;
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
  const atmosphere: Report["atmosphere"] = [];
  const seenPaths = new Set<string>();
  const turned = new Set<string>();
  const flagged = new Set<string>();

  // On screen at all: everything else is measured in scene units, and would pass unseen.
  if (!svg.clientWidth || !svg.clientHeight) {
    issues.push({
      check: "expected",
      message: `The stage is ${svg.clientWidth}×${svg.clientHeight} on screen. Give it a size: its className or style (position: fixed; inset: 0, for a page).`,
    });
  }

  // Language: every span and concept resolves to something declared.
  const refs = new Set<string>();
  for (const seg of deps.language?.prompt ?? []) if (typeof seg !== "string") refs.add(seg[1]);
  for (const c of deps.language?.concepts ?? []) refs.add(c.ref);
  for (const ref of refs) {
    if (!isDeclared(ref)) {
      issues.push({
        check: "language",
        message: `The language layer points "${ref}" at nothing declared. Point it at a declared path (entity[instance].part, beat.<name>, phase.<name>, input.<name>), or declare what it names.`,
      });
    }
  }

  // Phases: each one declared has a still that goes there.
  for (const name of Object.keys(deps.timeline.phases)) {
    if (!deps.stills.some((s) => s.phase === name)) {
      issues.push({ check: "phase", message: `Phase "${name}" has no still. Add one ({ name, phase: "${name}", expect }) so it can be seen, checked and pointed at.` });
    }
  }

  const stills = deps.stills.length ? deps.stills : [{ name: "now" } as Still];
  for (const still of stills) {
    if (deps.stills.length) deps.goto(still.name);
    await frames(3);

    if (still.phase && deps.phase() !== still.phase) {
      issues.push({
        check: "phase",
        still: still.name,
        message: `Still "${still.name}" says it is in phase "${still.phase}", and the stage says "${deps.phase() ?? "none"}". Pass <Stage phase> from the scene's state, and make the still's state match.`,
      });
    }

    for (const a of measureAtmosphere(svg)) {
      atmosphere.push({ still: still.name, name: a.name, ratio: a.ratio });
      if (!a.copy && !a.attached && a.ratio > ATMOSPHERE_MAX && !flagged.has(a.name)) {
        flagged.add(a.name);
        issues.push({
          check: "atmosphere",
          still: still.name,
          message: `At "${still.name}", atmosphere "${a.name}"${a.owner ? ` (inside ${a.owner}, and reaching well past it)` : ""} covers ${Math.round(a.ratio * 100)}% of the frame. Atmosphere is what is not a thing (a glow, grain, a second image); if this is a thing (a beam, a shadow, a room), declare it as a semantic component or a <Part>.`,
        });
      }
    }

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

    // Local: turn each number param (and each piece of state) of each thing on stage, once.
    for (const rec of registry.instances.values()) {
      const decl = DECLARATIONS.get(rec.entity);
      const turnable: [string, Param, "param" | "state"][] = [
        ...Object.entries(decl?.params ?? {}).map(([k, p]) => [k, p, "param"] as [string, Param, "param"]),
        ...Object.entries(decl?.state ?? {}).map(([k, p]) => [k, p, "state"] as [string, Param, "state"]),
      ];
      for (const [name, spec, kind] of turnable) {
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
        perturbations.push({ still: still.name, path: rec.path, param: name, kind, from, to, moved: changed, ok });
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
    checked: { stills: stills.length, paths: seenPaths.size, params: turned.size, words: refs.size },
    issues,
    perturbations,
    coverage,
    atmosphere,
  };
}
