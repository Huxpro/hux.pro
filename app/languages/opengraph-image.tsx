import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "Programming Languages — Hux.Pro";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgImage({
    title: "Programming Languages",
    eyebrow: "/languages",
    meta: "an intentionally biased PL chart",
  });
}
