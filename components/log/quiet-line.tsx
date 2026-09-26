import { cn } from "@/lib/utils";

/**
 * Quiet rows — life events, and an aside while it is folded — drop a tier
 * and change face by script.
 *
 * Latin is the italic serif aside. CJK has no italic: the browser would
 * shear the glyphs, which reads as emphasis and which Chinese typography
 * does not do, so those glyphs sit in mono, upright, with the meta line.
 *
 * The choice is per run. Testing the whole string used to flip an English
 * line to mono because its venue was Chinese — `PWA 之我见 · Progressive
 * Web App, in my points of view` painted JetBrains Mono end to end. The
 * English around that name is still an aside.
 */
const CJK_CHAR = /[぀-ヿ一-鿿]/;
const CJK_RUN = /([぀-ヿ一-鿿]+)/;

export function QuietLine({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(CJK_RUN).filter((part) => part.length > 0);
  const hasCjk = parts.some((part) => CJK_CHAR.test(part));
  const hasOther = parts.some((part) => !CJK_CHAR.test(part));

  if (!hasCjk || !hasOther) {
    return (
      <span
        className={cn(className, hasCjk ? "font-mono" : "italic font-serif")}
      >
        {text}
      </span>
    );
  }

  return (
    <span className={className}>
      {parts.map((part, i) => (
        <span
          key={i}
          className={
            CJK_CHAR.test(part) ? "font-mono not-italic" : "italic font-serif"
          }
        >
          {part}
        </span>
      ))}
    </span>
  );
}
