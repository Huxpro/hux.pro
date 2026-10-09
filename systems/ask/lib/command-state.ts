import { commandIdOf, validCommandValue, type CommandId } from "@/systems/command/catalog";
import type { CommandOutput } from "./command-tools";
import type { AskUIMessage } from "./tools";

/** Record a successful user tap in the existing tool result. This updates
 * all Ask surfaces and saved history without starting another model turn.
 * The model sees what actually happened on the next question. */
export function recordCommandExecution(messages: AskUIMessage[], callId: string, id: CommandId, value?: string): AskUIMessage[] {
  if (!validCommandValue(id, value)) return messages;
  return messages.map((message) => {
    if (message.role !== "assistant") return message;
    return { ...message, parts: message.parts.map((part) => {
      if (!("toolCallId" in part) || part.toolCallId !== callId || part.state !== "output-available") return part;
      const executed = value === undefined ? {} : { value };
      if (part.type === "tool-list_commands" && part.output.commands.includes(id)) {
        return { ...part, output: { ...part.output, executed: { ...part.output.executed, [id]: executed } } };
      }
      if (commandIdOf(part.type.slice(5)) !== id) return part;
      const output = part.output as CommandOutput;
      if (!("offered" in output) || output.offered !== id) return part;
      return { ...part, output: { ...output, executed } } as typeof part;
    }) };
  });
}
