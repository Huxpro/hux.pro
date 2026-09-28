import {
  ServerBadge,
  ServerMagicLink,
  ServerProseLink,
} from "@/components/magic-link/server";
import { Fn, Footnote, Footnotes } from "./footnote";
import type { Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { MDXComponents } from "mdx/types";
import { MDXRemote } from "next-mdx-remote/rsc";
import fs from "node:fs";
import path from "node:path";
import remarkGfm from "remark-gfm";

// =============================================================================
// AboutCopy — the About's words, from content/about/<locale>.mdx.
//
// A server component: the root layout renders both languages once, at build
// time, and hands them to the client surface, which shows the reader's. The
// copy is MDX so a line can carry a <MagicLink> or a <Badge> — the same component a post can
// use — and so editing it is editing a file, not a component.
//
// Not exported from the system's index: it reads the file system, and the
// index is imported by client code.
// =============================================================================

const components: MDXComponents = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        // On a phone the greeting is set at the words' own size — one voice,
        // the serif marking it — so the screen goes to what is said; a desk
        // has the room for it to stand as a title.
        "font-serif text-[1em] leading-[inherit] text-foreground sm:text-[2rem] sm:leading-tight sm:tracking-tight",
        className,
      )}
      {...props}
    />
  ),
  // The running-text link, the article's (`.prose-link`, globals.css), and
  // a magic link wherever it points at something the site knows.
  a: (props) => <ServerProseLink className="prose-link" {...props} />,
  strong: (props) => <strong className="font-medium text-foreground" {...props} />,
  // *interface* — the one word the words are about.
  // Every keyword summons something (components/magic-link): a badge names
  // a thing I made and wears its icon; a magic link is the word alone. Both
  // peek under the pointer and open the drawer on a phone.
  Badge: ServerBadge,
  MagicLink: ServerMagicLink,
  Fn,
  Footnotes,
  Footnote,
  Kbd: ({ children }: { children: React.ReactNode }) => (
    <kbd className={cn(TYPE.kbd, "text-[0.8em]")}>{children}</kbd>
  ),
};

function readSource(locale: Locale): string {
  const file = path.join(process.cwd(), "content", "about", `${locale}.mdx`);
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return fs.readFileSync(path.join(process.cwd(), "content", "about", "en.mdx"), "utf8");
  }
}

export function AboutCopy({ locale }: { locale: Locale }) {
  return (
    <MDXRemote
      source={readSource(locale)}
      components={components}
      options={{ blockJS: false, mdxOptions: { remarkPlugins: [remarkGfm] } }}
    />
  );
}
