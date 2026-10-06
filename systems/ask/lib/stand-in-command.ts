import { COMMAND_IDS, commandDefinition, type CommandToolName } from "@/systems/command/catalog";
import type { CommandInput, ListCommandsInput } from "./command-tools";

/** A deliberately scripted, keyless demo, not a natural-language router. */
export function standInCommand(question: string): { toolName: CommandToolName; input: CommandInput } | { toolName: "list_commands"; input: ListCommandsInput } | null {
  if (/(?:all|every|complete|full).*(?:commands|actions|tools)|(?:全部|所有|完整).*(?:操作|命令|工具|功能)/i.test(question)) {
    return { toolName: "list_commands", input: { ids: COMMAND_IDS } };
  }
  if (/what can (you|this (site|website)) (do|help)|what.*(can|help).*site|你能.*(做什么|做些什么)|网站.*(能做|功能)/i.test(question)) {
    return { toolName: "list_commands", input: { ids: ["theme", "sky-window"] } };
  }
  if (!/change|switch|set |open|choose|play|pause|更改|切换|换成|改成|设置|打开|选择|播放|暂停/i.test(question)) return null;
  const id = /language|english|chinese|语言|中文|英文/i.test(question) ? "language"
    : /theme|appearance|dark mode|light mode|主题|外观|深色|浅色/i.test(question) ? "theme"
    : /sky window|天空之窗/i.test(question) ? "sky-window"
    : /wallpaper|background|weather|壁纸|背景|天气/i.test(question) ? "wallpaper"
    : COMMAND_IDS.find((id) => {
      const { title } = commandDefinition(id);
      return question.toLowerCase().includes(title.en.toLowerCase()) || question.includes(title.zh);
    });
  if (!id) return null;
  const options = commandDefinition(id).options;
  const value = id === "language" ? /中文|chinese/i.test(question) ? "zh" : /英文|english/i.test(question) ? "en" : undefined
    : id === "theme" ? /深色|dark/i.test(question) ? "dark" : /浅色|light/i.test(question) ? "light" : /太阳|sun/i.test(question) ? "sun" : /系统|system/i.test(question) ? "system" : undefined
    : options?.find((o) => question.toLowerCase().includes(o.value) || question.includes(o.zh))?.value;
  const explicitRequest = /^(?:please\s+|(?:can|could|would)\s+you\s+|i(?:'d like| want)\s+you to\s+)?(?:change|switch|set|open|choose|play|pause)\b/i.test(question.trim())
    || /^(?:请(?:帮我)?|帮我)?(?:把.*(?:换成|改成|设置)|更改|切换|换成|改成|设置|打开|选择|播放|暂停)/.test(question.trim());
  const canApply = explicitRequest && commandDefinition(id).policy.execution === "on-request";
  return { toolName: `command_${id}`, input: { ...(value ? { value } : {}), execution: canApply ? "apply" : "offer" } };
}
