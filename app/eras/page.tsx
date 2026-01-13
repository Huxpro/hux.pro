import { getErasData } from "@/lib/eras-server";
import { sortErasByDate, sortItemsByDate } from "@/lib/eras";
import { ErasView } from "./view";

export const metadata = {
  title: "Eras | Hux.Pro",
  description:
    "Professional work organized by contextual eras — a discography of craft.",
};

export default function ErasPage() {
  const { eras, items } = getErasData();

  // Sort eras by date (most recent first)
  const sortedEras = sortErasByDate(eras);

  // Build the data structure for the view
  const data = sortedEras.map((era) => ({
    era,
    items: sortItemsByDate(items.filter((item) => item.eraId === era.id)),
  }));

  return <ErasView data={data} />;
}
