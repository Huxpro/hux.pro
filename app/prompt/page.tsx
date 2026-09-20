import { Suspense } from "react";
import { getPromptsData } from "@/lib/prompts";
import { PromptView } from "./view";

export const metadata = {
  title: "System Prompts",
  description: "Quotes, principles, people, and books that shape my thinking.",
};

export default function PromptPage() {
  // Load both locales at build time, client will select based on user preference
  const dataEn = getPromptsData("en");
  const dataZh = getPromptsData("zh");
  // The view reads its kind / topic filter off the query string
  // (`useSearchParams`), which needs a boundary under static export — same
  // as /works, which this page's toolbar comes from.
  return (
    <Suspense>
      <PromptView dataEn={dataEn} dataZh={dataZh} />
    </Suspense>
  );
}
