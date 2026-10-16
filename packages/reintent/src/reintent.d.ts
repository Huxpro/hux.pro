// Types for the vendored reintent.js (Huxpro/airtalk#818), as this site uses it. Loose where
// the host decides the shapes (subjects, contexts, worlds): Reintent itself is host-neutral.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Dist = Record<string, number>;
export type Kind = string;

export interface TypeSpec {
  kinds(subject: any): Kind[];
  subjects(world: any): any[];
  id(subject: any): string;
  prior(subject: any, world?: any): Dist;
  describe(kind: Kind, subject: any): string;
  resolve: "ask" | "switch";
  pref: boolean;
  index?: { of(ctx: any): number; base(subject: any): Kind };
  applies?(subject: any, assignment: Record<string, unknown>): boolean;
  read?(world: any, subject: any): Kind | null;
  check?(kind: Kind, world: any, subject: any): string | null;
}
export type Types = Record<string, TypeSpec>;

export interface Cell {
  key: string;
  type: string;
  subject: any;
  kinds: Kind[];
  prior: Dist;
}

export interface Doc {
  decisions?: Record<string, { pick: unknown; from?: string }>;
  prefs?: Record<string, { pick: Kind; from?: string } | undefined>;
  beliefs?: Record<string, { p: Dist }>;
}

export type Assignment = Record<string, unknown>;

export const TAU: number;
export const PREF_WEIGHT: number;
export function margin(p: Dist): number;
export function argmax(p: Dist): Kind | undefined;
export function space<T extends Types>(types: T): T;
export function cells(types: Types, world: any): Cell[];
export function belief(types: Types, doc: Doc, cell: Cell): Dist;
export function decide(types: Types, doc: Doc, cell: Cell, ctx: any): { value: unknown; from: string; p?: Dist; ask: boolean };
export function assign(types: Types, doc: Doc, cs: Cell[], ctx: any, derives?: ((a: Assignment, doc: Doc) => Assignment)[]): Assignment;
export function view(types: Types, doc: Doc, cs: Cell[], ctx: any, derives?: ((a: Assignment, doc: Doc) => Assignment)[]): {
  a: Assignment;
  firm: Record<string, "person" | "pref">;
  dflt: Assignment;
};
export function questions(types: Types, doc: Doc, cs: Cell[], ctx: any): Cell[];
export function narrow<D extends Doc>(types: Types, doc: D, cell: Cell, kind: Kind | { not: Kind[] }, ctx: any, opts?: { scope?: "here" | "all"; from?: string }): D;
export function forget<D extends Doc>(doc: D, key: string): D;
export function observe(types: Types, cs: Cell[], world: any, under?: Record<string, Kind>): Record<string, Kind>;
export function check(types: Types, doc: Doc, cs: Cell[], a: Assignment, world: any, under?: Record<string, Kind>): string[];
export function alternatives<W>(
  types: Types,
  cs: Cell[],
  a: Assignment,
  world: W,
  opts: {
    run(assignment: Assignment): W;
    holds(world: W, key: string, kind: Kind): boolean;
    relax?: string[];
    read?(world: W): Record<string, Kind>;
  },
): { key: string; type: string; kind: Kind; from: Kind; assignment: Assignment; world: W; relaxed: string[] }[];
export function stale(w: { under?: Record<string, Kind> }, a: Assignment): boolean;
export function effect<W>(o: {
  eager(a: Assignment): W;
  cache?(): { world: W; under: Record<string, Kind> }[];
  request?(a: Assignment): void;
  valid?(world: W, under: Record<string, Kind>): string[];
}): (a: Assignment) => { world: W; source: "written" | "eager"; pending: boolean };
