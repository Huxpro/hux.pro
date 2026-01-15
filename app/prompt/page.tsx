import { getPromptsData } from "@/lib/prompts";
import { PromptView } from "./view";

export const metadata = {
  title: "System Prompts | Hux.Pro",
  description: "Quotes, principles, and role models that shape my thinking.",
};

export default function PromptPage() {
  // Load both locales at build time, client will select based on user preference
  const dataEn = getPromptsData("en");
  const dataZh = getPromptsData("zh");
  return <PromptView dataEn={dataEn} dataZh={dataZh} />;
}
