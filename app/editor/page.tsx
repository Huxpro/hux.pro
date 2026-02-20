import { getLogData } from "@/lib/log-server";
import { EditorView } from "./view";

export const metadata = {
  title: "Editor | Hux.Pro",
  description: "Edit log.json content with live preview.",
};

export const dynamic = "force-dynamic";

export default function EditorPage() {
  const data = getLogData();
  return <EditorView initialData={data} />;
}
