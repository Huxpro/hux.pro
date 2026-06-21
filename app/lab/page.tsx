import { getAllLabItems } from "@/lib/mdx";
import { LabItemList } from "./lab-list";
import { Suspense } from "react";

export default function LabPage() {
  const items = getAllLabItems();

  return (
    <Suspense>
      <LabItemList items={items} />
    </Suspense>
  );
}
