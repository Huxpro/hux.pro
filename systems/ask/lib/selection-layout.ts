/** Keep our action opposite the native touch selection menu, within the visual viewport. */
export function selectionPosition(rect: { left: number; right: number; top: number; bottom: number },
  viewport: { left: number; top: number; width: number; height: number }, width: number, height: number, touch: boolean) {
  const gap = 8;
  const bottom = viewport.top + viewport.height;
  const above = touch && (rect.top + rect.bottom) / 2 < viewport.top + viewport.height / 2;
  const preferred = above ? rect.top - gap - height : rect.bottom + gap;
  const alternate = above ? rect.bottom + gap : rect.top - gap - height;
  const fits = (y: number) => y >= viewport.top + gap && y + height <= bottom - gap;
  return {
    x: Math.max(viewport.left + gap, Math.min(rect.left, viewport.left + viewport.width - width - gap)),
    y: Math.max(viewport.top + gap, Math.min(fits(preferred) ? preferred : alternate, bottom - height - gap)),
  };
}

/** Keep both ends recognizable; the full quote remains in the context payload. */
export function quoteLabel(text: string, maxChars = 48): string {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  return chars.length <= maxChars ? chars.join("") : `${chars.slice(0, Math.floor(maxChars * 26 / 48)).join("")} … ${chars.slice(-Math.floor(maxChars * 18 / 48)).join("")}`;
}
