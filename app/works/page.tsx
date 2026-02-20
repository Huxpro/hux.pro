import { getLogData } from "@/lib/log-server";
import { buildTimelineData } from "@/lib/log";
import { WorksView } from "./view";

export const metadata = {
  title: "Works | Hux.Pro",
  description:
    "Commit history — professional work as git log, tags marking each chapter.",
};

export default function WorksPage() {
  const logData = getLogData();
  const data = buildTimelineData(logData);
  return <WorksView data={data} />;
}
