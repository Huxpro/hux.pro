import { worksCardOf } from "@/lib/works-card";
import { WORKS_READINGS, type WorksReading } from "@/lib/works-readings";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const dynamicParams = false;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return WORKS_READINGS.map((type) => ({ type }));
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const card = worksCardOf(type as WorksReading);
  return renderOgImage({ title: card.copy.en.title, eyebrow: card.eyebrow, meta: card.meta });
}
