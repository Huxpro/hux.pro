import { PromptsLabView } from "./view";

export const metadata = {
  title: "Prompts Lab | Hux.Pro",
  description: "content/prompts.json, read as a structure: the map of its refs, every voice, every sentence, and its own rules.",
  robots: { index: false, follow: false },
};

export default function PromptsLabPage() {
  return <PromptsLabView />;
}
