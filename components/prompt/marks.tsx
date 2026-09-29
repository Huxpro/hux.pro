// =============================================================================
// Marks — the two inline marks prompt content carries, shared by /prompt and
// the home prompt widget (which used to print them as raw asterisks).
// =============================================================================

/**
 * Inline marks inside a line of content. Two of them, and each is the mark
 * a script makes for itself:
 *
 *   `**bold**`   weight — the emphasis Chinese has always used
 *   `*italic*`   slope — a work's title, a term as a term, a Latin aside
 *
 * Italic is the one mark this site's two alphabets do not share. Newsreader
 * and Inter both ship a drawn italic; Noto Serif SC ships upright only, so a
 * browser asked to slant a Chinese glyph shears the upright one into a shape
 * Chinese typography has never had. `font-synthesis-style: none` refuses the
 * forgery, and that refusal is what lets one mark mean the right thing in
 * both: a title is *The Gay Science* in English and 《快乐的科学》 in Chinese,
 * and the same `*…*` produces each.
 *
 * Which is also why the mark is worth having at all. Chinese already says
 * "this is a work" with 《》; the Latin half of every citation on this page
 * was saying it with nothing.
 */
export const MARKS = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export function Marks({ text }: { text: string }) {
  return (
    <>
      {text.split(MARKS).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        if (part.length > 2 && part.startsWith("*") && part.endsWith("*"))
          return (
            <em key={i} className="[font-synthesis-style:none]">
              {part.slice(1, -1)}
            </em>
          );
        return part;
      })}
    </>
  );
}

/** The same string with its marks taken off, for an alt text or a match. */
export function plain(text: string) {
  return text.replace(MARKS, (m) => m.replace(/\*/g, ""));
}

