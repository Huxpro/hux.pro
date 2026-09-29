import fs from "fs";
import path from "path";
import type { ReactNode } from "react";
import { MDXRenderer } from "@/components/mdx-renderer";
import { locales, type Locale } from "@/lib/i18n";
import { LanguagesView } from "./view";

export const metadata = {
  title: "Programming Languages",
  description:
    "Every programming language I've written, by how interesting it is to me and how much I've used it — an intentionally biased PL chart.",
};

export default function LanguagesPage() {
  // The explanation under the chart is prose, so it renders on the server
  // like any article — both languages at build time, the client picks one.
  const explanation = Object.fromEntries(
    locales.map((locale) => [
      locale,
      <MDXRenderer
        key={locale}
        source={fs.readFileSync(
          path.join(process.cwd(), `content/languages/explanation.${locale}.md`),
          "utf8",
        )}
      />,
    ]),
  ) as Record<Locale, ReactNode>;
  return <LanguagesView explanation={explanation} />;
}
