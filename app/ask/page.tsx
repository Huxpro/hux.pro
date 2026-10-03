import { Suspense } from "react";
import { AskView } from "./view";

export const metadata = {
  title: "Ask",
  description:
    "Ask anything about Hux, his writing and his work. Answers come from the site, with links to where it says so.",
};

export default function AskRoute() {
  // The view reads the question a link carries off the query string
  // (`useSearchParams`), which needs a boundary under static export.
  return (
    <Suspense>
      <AskView />
    </Suspense>
  );
}
