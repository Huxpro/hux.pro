import { BadgeLink, type BadgeLinkProps } from "@/components/badge";
import { Fn, Footnote, Footnotes } from "./footnote";
import type { Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { MDXComponents } from "mdx/types";
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import type { ComponentPropsWithoutRef } from "react";
import remarkGfm from "remark-gfm";

// =============================================================================
// AboutCopy — the About's words, from content/about/<locale>.mdx.
//
// A server component: the root layout renders both languages once, at build
// time, and hands them to the client surface, which shows the reader's. The
// copy is MDX so a line can carry a <Badge> — the same component a post can
// use — and so editing it is editing a file, not a component.
//
// Not exported from the system's index: it reads the file system, and the
// index is imported by client code.
// =============================================================================

function AboutLink({ href = "", ...props }: ComponentPropsWithoutRef<"a">) {
  const className =
    "text-foreground underline decoration-foreground/25 underline-offset-[0.2em] transition-colors hover:decoration-foreground/70";
  if (/^https?:/.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        {...props}
      />
    );
  }
  return <Link href={href} className={className} {...props} />;
}

const components: MDXComponents = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "font-serif text-[1.75rem] leading-tight tracking-tight text-foreground sm:text-[2rem]",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => <p className={className} {...props} />,
  a: AboutLink,
  strong: (props) => <strong className="font-medium text-foreground" {...props} />,
  // *interface* — the one word the words are about.
  em: (props) => <em className="font-serif italic text-foreground/90" {...props} />,
  Badge: BadgeLink,
  BadgeLink,
  // A word that points somewhere without naming a thing I made: opens its
  // thing as a badge does, dressed as a plain link.
  Ref: (props: BadgeLinkProps) => <BadgeLink plain {...props} />,
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
