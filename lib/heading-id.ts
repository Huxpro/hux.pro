/**
 * A heading's id: its text, lowercased, hyphenated, with Chinese kept. The
 * post's headings take it in the browser (components/heading-link.tsx) and
 * Ask's index takes it at build time (lib/ask-corpus.ts), so a passage the
 * agent found links to the heading it sits under.
 */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s一-鿿-]/g, "") // Keep Chinese characters, alphanumeric, spaces, hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();
}
