import { ReintentLabView } from "./view";

export const metadata = {
  title: "Reintent Core | Hux.Pro",
  description: "The Wardrobe on a standalone intent core: parts take intents in and give the picture out, each value decided by one rule, reconciled when the model rewrites a part.",
  robots: { index: false, follow: false },
};

export default function ReintentLabPage() {
  return <ReintentLabView />;
}
