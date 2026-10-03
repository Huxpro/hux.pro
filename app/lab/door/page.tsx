import type { Metadata } from "next";
import { DoorLabView } from "./view";

export const metadata: Metadata = {
  title: "The Door",
  description: "A nightmare. You wake, and the wardrobe door is still opening.",
  robots: { index: false, follow: false },
};

export default function DoorLabPage() {
  return <DoorLabView />;
}
