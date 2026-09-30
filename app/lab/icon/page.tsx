import { readIconConfig } from "@/lib/icon/generate";
import { IconLabView } from "./view";

export const metadata = {
  title: "Icon Lab | Hux.Pro",
  description: "Generate the app icon from typography + background levers.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function IconLabPage() {
  const config = readIconConfig();
  return <IconLabView initialConfig={config} />;
}
