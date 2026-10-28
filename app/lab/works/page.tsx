import { getLogData } from "@/lib/log-server";
import { WorksLabView } from "./view";

export const metadata = {
  title: "Works Lab | Hux.Pro",
  description: "content/log.json, printed by the /works timeline and edited in place.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function WorksLabPage() {
  const data = getLogData();
  return <WorksLabView initialData={data} />;
}
