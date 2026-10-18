import { ReintentLabView } from "./view";

export const metadata = {
  title: "Reintent Core | Hux.Pro",
  description: "The Wardrobe on Reintent: an intent tree a model writes, intents read as values, drawn by the Wardrobe's own stage.",
  robots: { index: false, follow: false },
};

export default function ReintentLabPage() {
  return <ReintentLabView />;
}
