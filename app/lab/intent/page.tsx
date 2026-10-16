import { IntentLabView } from "./view";

export const metadata = {
  title: "Intent Lab | Hux.Pro",
  description: "A dream's intents as closed choices, decided per screen by a person, a model sure enough, or code.",
  robots: { index: false, follow: false },
};

export default async function IntentLabPage({ searchParams }: { searchParams: Promise<{ dream?: string }> }) {
  const { dream } = await searchParams;
  return <IntentLabView initial={dream} />;
}
