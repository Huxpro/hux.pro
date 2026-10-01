import type { Metadata } from "next";
import { LabIndexView } from "./index-view";

export const metadata: Metadata = {
  title: "Lab",
  description: "This site, studied from the inside — one lab for each of its systems.",
};

export default function LabIndexPage() {
  return <LabIndexView />;
}
