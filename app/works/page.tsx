import { getLogData } from "@/lib/log-server";
import { WorksView } from "./view";

export const metadata = {
  title: "Works | Hux.Pro",
  description:
    "Commit history — professional work as git log, tags marking each chapter.",
};

export default function WorksPage() {
  const logData = getLogData();
  return <WorksView logData={logData} />;
}
