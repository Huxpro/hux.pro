import { readIconConfig } from "@/lib/icon/generate";
import { IconEditorView } from "./view";

export const metadata = {
  title: "Icon Studio | Hux.Pro",
  description: "Generate the app icon from typography + background levers.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function IconEditorPage() {
  const config = readIconConfig();
  return <IconEditorView initialConfig={config} />;
}
