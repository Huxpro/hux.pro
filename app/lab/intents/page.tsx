import { IntentsLabView } from "./view";

export const metadata = {
  title: "The Intent Loop | Hux.Pro",
  description: "Reintent as a reactive, intent-oriented runtime: drags, resizes and sentences as events, resolved to preset intents or handed to a model.",
  robots: { index: false, follow: false },
};

export default function IntentsLabPage() {
  return <IntentsLabView />;
}
