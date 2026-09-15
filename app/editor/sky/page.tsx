import { readSkyFile } from "@/lib/sky-file";
import { SkyEditorView } from "./view";

export const metadata = {
  // Bare, not "… | Hux.Pro": the root layout's title template already appends
  // the site name, so spelling it here renders it twice.
  title: "Sky Engine Lab",
  description:
    "Inspect and tune the weather wallpaper's solar and lunar model, its scene derivation and its staging.",
  robots: { index: false, follow: false },
};

/** Read `content/sky.json` per request, so a save is visible on reload. */
export const dynamic = "force-dynamic";

export default function SkyEditorPage() {
  return <SkyEditorView initialFile={readSkyFile()} />;
}
