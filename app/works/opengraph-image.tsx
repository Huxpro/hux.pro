import { worksCardOf } from "@/lib/works-card";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Works — Hux.Pro";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  const card = worksCardOf(null);
  return renderOgImage({ title: card.copy.en.title, eyebrow: card.eyebrow, meta: card.meta });
}
