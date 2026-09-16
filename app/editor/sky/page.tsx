import { readSkyFileSnapshot } from "@/lib/sky-file";
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
  // `readAtMs` lets the lab tell a session saved after this render apart from
  // a file that changed on disk behind its back — see the session store in
  // view.tsx.
  const { file, readAtMs } = readSkyFileSnapshot();
  return <SkyEditorView initialFile={file} readAtMs={readAtMs} />;
}
