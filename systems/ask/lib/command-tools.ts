import { jsonSchema, tool, type Tool } from "ai";
import { COMMAND_IDS, commandDefinition, type CommandId, type CommandToolName } from "@/systems/command/catalog";

export interface CommandInput { value?: string; execution?: "offer" | "apply" }
export interface ListCommandsInput { ids: CommandId[] }
export interface CommandExecution { value?: string }
export type CommandExecutions = Partial<Record<CommandId, CommandExecution>>;
export type CommandOfferReason = "suggestion" | "choose-target" | "user-gesture" | "background";
export type CommandOutput = { offered: CommandId; value?: string; executed?: CommandExecution; reason?: CommandOfferReason } | { error: string };
export type ListCommandsOutput = { commands: CommandId[]; executed?: CommandExecutions };

/** Keep the model's selection and order; never expand it into a full menu.
 * Recheck current availability because voice/install can disappear. */
export function commandsToPresent(available: readonly CommandId[], input: ListCommandsInput): CommandId[] {
  if (!Array.isArray(input.ids)) return [];
  return [...new Set(input.ids)].filter((id) => available.includes(id));
}

export const commandTools = Object.fromEntries(COMMAND_IDS.map((id) => {
  const definition = commandDefinition(id);
  return [`command_${id}`, tool({
    description: `${definition.description} ${definition.policy.execution === "user-gesture"
      ? "Policy: user-gesture. Offer a card; a tap executes."
      : `Policy: on-request. Apply only an explicit request with an exact target; otherwise offer.${definition.policy.gestureValues ? ` ${definition.policy.gestureValues.join(", ")} requires a tap.` : ""}`
    } Only executed confirms completion.`,
    inputSchema: jsonSchema<CommandInput>({
      type: "object",
      properties: {
        execution: { type: "string", enum: definition.policy.execution === "user-gesture" ? ["offer"] : ["offer", "apply"],
          description: "Default offer. Apply only an explicit request to act; catalog policy still applies." },
        ...(definition.options ? {
          value: { type: "string", enum: definition.options.map((o) => o.value), description: "Exact requested target. Omit to offer choices." },
        } : {}),
      },
      additionalProperties: false,
    }),
    outputSchema: jsonSchema<CommandOutput>({ type: "object" }),
  })];
})) as Record<CommandToolName, Tool<CommandInput, CommandOutput>>;

export const listCommandsTool = tool({
  description: "Show ONLY the commands you select, as compact interactive actions. Choose 1–2 relevant examples for capability questions ('what can you do?', '你能帮我做什么') or discovering hidden interactions, rather than dumping the menu. For a specific requested setting and target, use its command_* tool instead; you may call two command tools for two requested changes. Select more commands only if the reader asks for all commands or a complete list. This tool does not execute anything.",
  inputSchema: jsonSchema<ListCommandsInput>({
    type: "object",
    properties: {
      ids: { type: "array", items: { type: "string", enum: COMMAND_IDS }, minItems: 1, maxItems: COMMAND_IDS.length,
        description: "Command ids to present, in relevance order. Usually 1–2; list every id only when the reader explicitly requests the full command menu." },
    },
    required: ["ids"],
    additionalProperties: false,
  }),
  outputSchema: jsonSchema<ListCommandsOutput>({ type: "object" }),
});
