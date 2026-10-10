// =============================================================================
// Names. A semantic path is entity[instance].part.subpart:
//
//   man                  the man, all of him, wherever he is
//   man[bedside]         the one at the bed
//   man[bedside].hat     his hat, there
//   wardrobe.door.right  one wardrobe, so no instance
//
// Paths are data: the registry keys, the DOM's data-sem, the editor's
// selection and the language index all speak them.
// =============================================================================

import { DECLARATIONS, RESERVED } from "./spec";
import { inTimeline } from "./timeline";

export interface ParsedPath {
  entity: string;
  instance: string | null;
  part: string | null;
}

const PATH = /^([a-z][a-z0-9-]*)(?:\[([a-z0-9-]+)\])?(?:\.(.+))?$/;

export function parsePath(path: string): ParsedPath {
  const m = PATH.exec(path);
  return m ? { entity: m[1], instance: m[2] ?? null, part: m[3] ?? null } : { entity: path, instance: null, part: null };
}

export function instancePath(entity: string, instance: string | null | undefined): string {
  return instance ? `${entity}[${instance}]` : entity;
}

/** The path itself and every shorter one above it: man[bedside].hat.brim → man[bedside], man[bedside].hat, … */
export function prefixes(path: string): string[] {
  const { entity, instance, part } = parsePath(path);
  const root = instancePath(entity, instance);
  const out = [root];
  if (part) {
    const segs = part.split(".");
    for (let i = 1; i <= segs.length; i++) out.push(`${root}.${segs.slice(0, i).join(".")}`);
  }
  return out;
}

/**
 * Is this path declared? Its entity, its instance (when the entity lists
 * them), and its part (one of the parts, or a prefix of one). Timeline paths
 * (beat.door, phase.awake, input.hold) answer from the timeline.
 */
export function isDeclared(path: string): boolean {
  const { entity, instance, part } = parsePath(path);
  if (RESERVED.has(entity)) return !instance && inTimeline(entity, part);
  const decl = DECLARATIONS.get(entity);
  if (!decl) return false;
  if (instance && decl.instances && !(instance in decl.instances)) return false;
  if (!part) return true;
  return (decl.parts ?? []).some((p) => p === part || p.startsWith(part + "."));
}

/** A path worth a box and a row: an instance, or exactly one of its declared parts. */
export function isNode(path: string): boolean {
  const { entity, part } = parsePath(path);
  const decl = DECLARATIONS.get(entity);
  return !part || !decl || (decl.parts ?? []).includes(part);
}

/**
 * Does a selection reach this path? Same entity; instances agree where both
 * name one; one part is a prefix of the other. A selected part does not reach
 * the whole entity.
 */
export function reaches(selection: string, path: string): boolean {
  const a = parsePath(selection);
  const b = parsePath(path);
  if (a.entity !== b.entity) return false;
  if (a.instance && b.instance && a.instance !== b.instance) return false;
  if (a.part && !b.part) return false;
  if (a.part && b.part) {
    const x = a.part.split(".");
    const y = b.part.split(".");
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return false;
  }
  return true;
}
