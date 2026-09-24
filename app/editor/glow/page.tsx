import { GlowLabView } from "./view";

export const metadata = {
  title: "Glow Lab | Hux.Pro",
  description: "The site's one light — systems/glow — at every scale.",
  robots: { index: false, follow: false },
};

export default function GlowLabPage() {
  return <GlowLabView />;
}
