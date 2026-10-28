import type { Metadata } from "next";
import { worksMetadata } from "./metadata";

// The view is the layout's. This page is /works's Open Graph.
export const metadata: Metadata = worksMetadata(null);

export default function WorksPage() {
  return null;
}
