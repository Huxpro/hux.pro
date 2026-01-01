import { getAllDocs } from "@/lib/mdx";
import { DocsPageList } from "./docs-list";

export default function DocsPage() {
  const docs = getAllDocs();
  return <DocsPageList docs={docs} />;
}
