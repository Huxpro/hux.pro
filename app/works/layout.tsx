import { Suspense } from "react";
import { getLogData } from "@/lib/log-server";
import { enrichLogDataWithPreviews } from "@/lib/og-snapshot";
import { WorksView } from "./view";

// /works lives in its layout rather than its page: each reading with a card
// of its own (`/works?type=talk`, lib/works-readings.ts) is served by a page
// of its own, `[type]`, for its Open Graph, and a layout stays mounted as the
// chips move between them. The pages render nothing.
export default function WorksLayout({ children }: { children: React.ReactNode }) {
  // Bake snapshot/manual link previews into the data server-side so cards
  // render synchronously on the client (no request-time crawl, no skeleton
  // flash). Un-snapshotted links fall back to a live fetch in the component.
  const logData = enrichLogDataWithPreviews(getLogData());
  // The view reads its filter / density state off the query string
  // (`useSearchParams`), which needs a boundary under static export.
  return (
    <>
      <Suspense>
        <WorksView logData={logData} />
      </Suspense>
      {children}
    </>
  );
}
