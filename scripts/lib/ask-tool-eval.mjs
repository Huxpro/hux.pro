// First-call evaluation: distinguish knowing the catalog from choosing a
// small, useful set of controls. No browser effects or model calls here.
import { COMMAND_IDS, commandIdOf } from '../../systems/command/catalog.ts';
import { commandOfferReason } from '../../systems/ask/lib/execute-command.ts';

export function scoreToolSelection(test, calls) {
  const shownActions = calls.reduce((n, c) => n + (c.tool === 'list_commands' && Array.isArray(c.input?.ids) ? c.input.ids.length : commandIdOf(c.tool) ? 1 : 0), 0);
  if (test.mode === 'discovery' || test.mode === 'all-commands') {
    const ids = calls[0]?.input?.ids;
    const valid = calls.length === 1 && calls[0].tool === 'list_commands' && Array.isArray(ids)
      && ids.every((id) => COMMAND_IDS.includes(id)) && new Set(ids).size === ids.length;
    const correct = !!valid && (test.mode === 'discovery'
      ? ids.length >= 1 && ids.length <= 2
      : ids.length === COMMAND_IDS.length);
    return { correct, shownActions };
  }
  const expected = test.calls ?? (test.tool ? [{ tool: test.tool, ...(test.value === undefined ? {} : { value: test.value }), ...(test.outcome ? { outcome: test.outcome } : {}) }] : []);
  const correct = calls.length === expected.length && expected.every((want) =>
    calls.filter((call) => {
      if (call.tool !== want.tool || (want.value !== undefined && call.input?.value !== want.value)) return false;
      const id = commandIdOf(call.tool);
      return !want.outcome || (id && (commandOfferReason(id, call.input ?? {}, true) ? 'offer' : 'apply') === want.outcome);
    }).length === 1);
  return { correct, shownActions };
}
