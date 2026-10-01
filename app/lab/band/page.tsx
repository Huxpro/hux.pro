import { BandLabView } from "./view";

export const metadata = {
  title: "Band Lab | Hux.Pro",
  description: "The top of the screen — Live Activities, notices and pinned bars sharing one strip.",
  robots: { index: false, follow: false },
};

export default function BandLabPage() {
  return <BandLabView />;
}
