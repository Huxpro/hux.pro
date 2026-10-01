import type { Metadata } from "next";
import { WORKS_READINGS, type WorksReading } from "@/lib/works-readings";
import { worksMetadata } from "../metadata";

// A reading of /works with a card of its own (lib/works-readings.ts):
// next.config.ts rewrites `/works?type=<type>` here. The view is the
// layout's; this page is only the reading's Open Graph.
export const dynamicParams = false;

export function generateStaticParams() {
  return WORKS_READINGS.map((type) => ({ type }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  return worksMetadata(type as WorksReading);
}

export default function WorksReadingPage() {
  return null;
}
