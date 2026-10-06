import { commandDefinition, validCommandValue, type CommandId } from "@/systems/command/catalog";
import type { AskActions } from "./actions";
import type { CommandInput, CommandOfferReason, CommandOutput } from "./command-tools";

/** The model chooses intent, never the policy. Defaults, target-dependent
 * boundaries and foreground checks are enforced before calling the host. */
export function commandOfferReason(id: CommandId, input: CommandInput, foreground: boolean): CommandOfferReason | null {
  const { policy, options } = commandDefinition(id);
  if (input.execution !== "apply") return "suggestion";
  if (!foreground) return "background";
  if (policy.execution === "user-gesture" || (input.value && policy.gestureValues?.includes(input.value))) return "user-gesture";
  if (options && input.value === undefined) return "choose-target";
  return null;
}

export async function executeAskCommand(id: CommandId, input: CommandInput, host: AskActions | null, foreground: boolean): Promise<CommandOutput> {
  if (!host?.commands.some((c) => c.id === id) || !validCommandValue(id, input.value)) {
    return { error: "This command or target is unavailable in this browser." };
  }
  const output = { offered: id, ...(input.value === undefined ? {} : { value: input.value }) };
  const reason = commandOfferReason(id, input, foreground && host.visible);
  if (reason) return { ...output, reason };
  try {
    await host.runCommand(id, input.value);
    return { ...output, executed: input.value === undefined ? {} : { value: input.value } };
  } catch {
    return { error: "The action failed. Do not claim it was completed." };
  }
}
