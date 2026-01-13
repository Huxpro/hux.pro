import { getPromptsData } from "@/lib/prompts";
import { PromptView } from "./view";

export const metadata = {
  title: "System Prompts | Hux.Pro",
  description: "Quotes, principles, and role models that shape my thinking.",
};

export default function PromptPage() {
  const data = getPromptsData();
  return <PromptView data={data} />;
}
