// =============================================================================
// The registry: what is on stage right now, and what people have said about it.
//
//   instances   every mounted semantic thing, by path, with its live props
//   overrides   values set from outside (the inspector, a sentence) by path
//               or by entity; they sit on top of the props the code passes,
//               so a regenerated component keeps them
//   draws       immediate-mode drawings (canvas), in paint order
//   flags       switches a scene may read (the inspector's demos)
// =============================================================================

import type { Declaration } from "./spec";
import { DECLARATIONS } from "./spec";

export interface InstanceRecord {
  path: string;
  entity: string;
  instance: string | null;
  props: Record<string, unknown>;
  host: "svg" | "canvas";
  node: () => Element | null;
}

export type DrawFn = (ctx: CanvasRenderingContext2D, t: number) => void;

export interface DrawRecord {
  id: number;
  path: string;
  fn: DrawFn;
}

export class Registry {
  readonly instances = new Map<string, InstanceRecord>();
  readonly overrides = new Map<string, Record<string, unknown>>();
  readonly flags = new Set<string>();
  draws: DrawRecord[] = [];
  private version = 0;
  private readonly listeners = new Set<() => void>();
  private drawSeq = 0;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;
  private emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  mount(rec: InstanceRecord): () => void {
    this.instances.set(rec.path, rec);
    return () => {
      if (this.instances.get(rec.path) === rec) this.instances.delete(rec.path);
    };
  }

  update(path: string, props: Record<string, unknown>): void {
    const rec = this.instances.get(path);
    if (rec) rec.props = props;
  }

  addDraw(path: string, fn: DrawFn): { set: (fn: DrawFn) => void; remove: () => void } {
    const rec: DrawRecord = { id: ++this.drawSeq, path, fn };
    this.draws = [...this.draws, rec];
    return {
      set: (next) => { rec.fn = next; },
      remove: () => { this.draws = this.draws.filter((d) => d !== rec); },
    };
  }

  declaration(entity: string): Declaration | undefined {
    return DECLARATIONS.get(entity);
  }

  /** Entity-wide overrides, then this instance's: the more specific wins. */
  overridesFor(entity: string, path: string): Record<string, unknown> {
    return { ...this.overrides.get(entity), ...(path !== entity ? this.overrides.get(path) : undefined) };
  }

  setOverride(key: string, prop: string, value: unknown): void {
    const cur = { ...this.overrides.get(key) };
    if (value === undefined) delete cur[prop];
    else cur[prop] = value;
    if (Object.keys(cur).length) this.overrides.set(key, cur);
    else this.overrides.delete(key);
    this.emit();
  }

  clearOverrides(): void {
    this.overrides.clear();
    this.emit();
  }

  setFlag(name: string, on: boolean): void {
    if (on) this.flags.add(name);
    else this.flags.delete(name);
    this.emit();
  }
}
