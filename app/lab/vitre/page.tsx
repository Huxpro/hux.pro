import { VitreLabView } from "./view";

export const metadata = {
  title: "Vitre Lab | Hux.Pro",
  description: "The page's edges and Safari's glass — packages/vitre, as this site configures it.",
  robots: { index: false, follow: false },
};

export default function VitreLabPage() {
  return <VitreLabView />;
}
