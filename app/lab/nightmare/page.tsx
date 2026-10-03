import { Suspense } from "react";
import { NightmareLabView } from "./view";

export const metadata = {
  title: "Nightmare Lab | Hux.Pro",
  description: "An interactive childhood nightmare: the tall man in the wide flat hat.",
  robots: { index: false, follow: false },
};

export default function NightmareLabPage() {
  return (
    <Suspense>
      <NightmareLabView />
    </Suspense>
  );
}
