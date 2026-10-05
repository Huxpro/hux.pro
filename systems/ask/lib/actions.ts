import type { OpenPageInput, OpenPageOutput, PlayInput, PlayOutput } from "./tools";

// =============================================================================
// What the agent can do on the site (the open_page and play tools), run in
// the page like the other tools (./chat.ts). Doing needs what only mounted
// components hold (the router, where Ask sits, the theater), so a component
// registers the doing here (components/actions-host.ts, from AskSide, which
// is always mounted) and the agent loop calls it.
// =============================================================================

export interface AskActions {
  visible: boolean;
  open: (input: OpenPageInput, canContinue: () => boolean) => Promise<OpenPageOutput>;
  play: (input: PlayInput) => PlayOutput;
}

let actions: AskActions | null = null;

export function setAskActions(next: AskActions | null) {
  actions = next;
}

export function getAskActions(): AskActions | null {
  return actions;
}
