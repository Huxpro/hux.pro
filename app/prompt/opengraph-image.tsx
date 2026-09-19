import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "System Prompts — Hux.Pro";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return renderOgImage({
    title: "System Prompts",
    eyebrow: "/prompts",
    meta: "quotes, principles, people, and books",
  });
}
