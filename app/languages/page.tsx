import fs from "fs";
import path from "path";
import { MDXRenderer } from "@/components/mdx-renderer";
import { LanguagesView } from "./view";

export const metadata = {
  title: "Programming Languages",
  description:
    "Every programming language I've written, by how interesting it is to me and how much I've used it — an intentionally biased PL chart.",
};

export default function LanguagesPage() {
  // The notes under the chart are prose, so they are MDX and render on the
  // server like any article; the chart around them is the client's.
  const explanation = fs.readFileSync(
    path.join(process.cwd(), "content/languages/explanation.en.mdx"),
    "utf8",
  );
  return <LanguagesView explanation={<MDXRenderer source={explanation} />} />;
}
