import {
  getLocalImageDimensions,
  parseBleedDirective,
  shouldBleedImage,
} from "@/lib/image-meta";
import type { ComponentPropsWithoutRef } from "react";

/**
 * MDX `<img>` override.
 *
 * Markdown images (`![](...)`) are given a sensible default "bleed" decision:
 * wide, high-resolution captures break out of the reading column while small
 * or square images stay within it (see {@link shouldBleedImage}). The decision
 * is made from the image's intrinsic dimensions, read from `/public` at build
 * time — this is a Server Component, so the filesystem access never reaches the
 * client.
 *
 * Authors override the automatic call per image with a URL fragment:
 *
 *   ![](/img/wide-screenshot.png#bleed)      → always bleed
 *   ![](/img/tall-diagram.png#no-bleed)      → never bleed
 *
 * The chosen state is exposed as `data-bleed="true"` for the CSS in
 * `app/globals.css` to widen the element on desktop.
 */
export function MdxImage({
  src,
  alt,
  ...props
}: ComponentPropsWithoutRef<"img">) {
  const rawSrc = typeof src === "string" ? src : "";
  const { src: cleanSrc, directive } = parseBleedDirective(rawSrc);

  let bleed: boolean;
  if (directive === "bleed") {
    bleed = true;
  } else if (directive === "no-bleed") {
    bleed = false;
  } else {
    const dims = getLocalImageDimensions(cleanSrc);
    bleed = dims ? shouldBleedImage(dims) : false;
  }

  // Prose images are authored as raw markdown; next/image needs known
  // dimensions we deliberately don't thread through here.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cleanSrc}
      alt={alt ?? ""}
      data-bleed={bleed ? "true" : undefined}
      {...props}
    />
  );
}
