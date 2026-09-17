import { getLogData } from "@/lib/log-server";
import { enrichLogDataWithPreviews } from "@/lib/og-snapshot";
import { WorksView } from "./view";
import { Suspense } from "react";

export const metadata = {
  title: "Works",
  description:
    "Commit history — professional work as git log, tags marking each chapter.",
};

export default function WorksPage() {
  // Bake snapshot/manual link previews into the data server-side so cards
  // render synchronously on the client (no request-time crawl, no skeleton
  // flash). Un-snapshotted links fall back to a live fetch in the component.
  const logData = enrichLogDataWithPreviews(getLogData());
  return (
    <Suspense>
      <WorksView logData={logData} />
    </Suspense>
  );
}
