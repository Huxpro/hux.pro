import imageSizesJson from "@/content/image-sizes.json";
import { generatedImageSize, type ImageDimensions } from "@/lib/image-dimensions";

/**
 * The size of a cover the site shows, known before the image is fetched.
 *
 * `content/image-sizes.json` records `[width, height]` for every cover that
 * can be shown whole — a card's picture (ours or another site's), a post's
 * first image — keyed by the URL the page asks for. `pnpm og:snapshot` writes
 * it from the files' headers, and `pnpm og:complete` fails when a cover is
 * missing from it or a local file has changed since. A cover slot reads it to
 * hold its height while the picture loads (components/log/media/peek-cover),
 * so a peek or a drawer opens at the size it will be.
 *
 * Client-safe: a static import, like the OG snapshot beside it.
 */
const SIZES: Record<string, readonly number[]> = imageSizesJson;

export function imageSizeOf(src: string | undefined): ImageDimensions | null {
  if (!src) return null;
  const known = SIZES[src];
  if (known) return { width: known[0], height: known[1] };
  return generatedImageSize(src);
}
