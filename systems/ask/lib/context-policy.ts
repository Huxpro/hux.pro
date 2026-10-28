import type { AskContext } from "./tools";

/** Shared by the draft UI and the route: every visible tag is sent. */
export const MAX_CONTEXTS = 3;

export function combineContexts(pending: readonly AskContext[], page: AskContext | null): AskContext[] {
  const contexts = [...pending];
  if (page && contexts.length < MAX_CONTEXTS && !contexts.some((c) => c.href === page.href)) contexts.push(page);
  return contexts.slice(0, MAX_CONTEXTS);
}
