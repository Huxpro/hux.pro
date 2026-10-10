// A scene's phases: a small state machine, driven by the stage's own clock
// (never setTimeout), so a phase is the same at the same time on every run.
//
//   { talking: { on: { touch: "hushed" } }, hushed: { after: [1.8, "you"] }, you: {} }
//
// The first key is where it starts.

export type MachineConfig = Record<string, { on?: Record<string, string>; after?: [seconds: number, next: string] }>;

export interface Machine {
  phase(): string;
  /** When each phase was last entered, in stage seconds. */
  entered(): Readonly<Record<string, number>>;
  /** Seconds since `phase` was entered; -1 if it has not been. */
  since(phase: string, now: number): number;
  /** An event: true when it moved the machine. */
  send(event: string, now: number): boolean;
  /** Let time pass: true when an `after` moved the machine. */
  tick(now: number): boolean;
}

export function createMachine(config: MachineConfig, now = 0): Machine {
  const first = Object.keys(config)[0];
  if (!first) throw new Error("a machine needs at least one phase");
  let phase = first;
  const entered: Record<string, number> = { [first]: now };
  const go = (next: string, at: number) => {
    if (!(next in config)) throw new Error(`no phase "${next}"`);
    phase = next;
    entered[next] = at;
    return true;
  };
  return {
    phase: () => phase,
    entered: () => entered,
    since: (p, at) => (p in entered ? at - entered[p] : -1),
    send(event, at) {
      const next = config[phase]?.on?.[event];
      return next ? go(next, at) : false;
    },
    tick(at) {
      let moved = false;
      // An `after` of 0 may chain; a loop of them would never settle, so stop at the number of phases.
      for (let i = 0; i < Object.keys(config).length; i++) {
        const after = config[phase]?.after;
        if (!after || at - entered[phase] < after[0]) break;
        // The next phase began when the delay ran out, not when this frame noticed.
        moved = go(after[1], entered[phase] + after[0]);
      }
      return moved;
    },
  };
}
