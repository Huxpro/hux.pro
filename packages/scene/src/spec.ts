// =============================================================================
// Declarations: what a thing is called, what it is made of, what can be turned.
//
// A declaration is static and lives next to the component that draws it
// (semantic(decl, Render)). Everything the editor, the language index and the
// verifier know about a thing comes from here: its id, the words people use
// for it, its parts, and its params with their ranges. One schema, four uses.
//
// Two kinds of number, kept apart:
//
//   params   what the thing is: a hat's size, how much dust. The code passes
//            them once, or not at all; turning one is an edit ("帽子大一点").
//   state    what the scene is doing to it: how far a door stands open, a
//            glint in an eye. The code drives it every frame; an override
//            pins it there, which is for looking, not for editing.
// =============================================================================

export interface NumberParam {
  kind: "number";
  default: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Words for this param ("帽子大小", "hat size"). */
  aka?: readonly string[];
  /** Parts this param is allowed to move. The verifier holds it to them. Default: the whole instance. */
  affects?: readonly string[];
  /**
   * What turning it changes: "shape" (the default) must move something, or it
   * is not wired; "appearance" (an opacity, a colour, canvas dust) need not.
   */
  effect?: "shape" | "appearance";
}

export interface ChoiceParam {
  kind: "choice";
  default: string;
  options: readonly string[];
  aka?: readonly string[];
  affects?: readonly string[];
}

export type Param = NumberParam | ChoiceParam;
export type Params = Record<string, Param>;

export type ParamValues<P extends Params> = {
  [K in keyof P]: P[K] extends NumberParam ? number : string;
};

export interface Declaration<P extends Params = Params, S extends Params = Params> {
  /** Stable, lower-case, the name code and people share: "man", "wardrobe". */
  id: string;
  /** character | prop | setting | camera | … */
  kind: string;
  /** The words people use for it, in any language. */
  aka: readonly string[];
  /** One line: what it looks like, for whoever regenerates it. */
  depicts?: string;
  /** Its nameable parts. Dotted names nest: "door.left". */
  parts?: readonly string[];
  /** What it is: turnable, and an edit when turned. */
  params?: P;
  /** What the scene does to it, frame by frame: an override pins it. */
  state?: S;
  /** Where it can appear, by instance name. */
  instances?: Readonly<Record<string, string>>;
  /** False for a thing with state but no picture (the viewer). */
  visual?: boolean;
}

export function num(def: number, o: Omit<NumberParam, "kind" | "default">): NumberParam {
  return { kind: "number", default: def, ...o };
}

export function choice(def: string, options: readonly string[], o: Omit<ChoiceParam, "kind" | "default" | "options"> = {}): ChoiceParam {
  return { kind: "choice", default: def, options, ...o };
}

export function defaults<P extends Params>(params: P | undefined): ParamValues<P> {
  const out: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(params ?? {})) out[k] = p.default;
  return out as ParamValues<P>;
}

// Every declaration made, by id. Declarations are module-level, like the
// components they describe, so the manifest exists before anything mounts.
export const DECLARATIONS = new Map<string, Declaration>();

/** Path roots the timeline owns (timeline.ts): no thing may be called these. */
export const RESERVED = new Set(["beat", "phase", "input"]);

export function declare(decl: Declaration): void {
  if (RESERVED.has(decl.id)) throw new Error(`scene: "${decl.id}" is reserved for the timeline; call the thing something else.`);
  // A second declaration of an id replaces the first: that is what hot reload
  // does. Two modules declaring the same id is caught by the verifier, which
  // compares the manifest against the declarations' sources.
  DECLARATIONS.set(decl.id, decl);
}
