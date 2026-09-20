import { redirect } from "next/navigation";

/** Singular alias — the lab lives at `/editor/attachments`. */
export default function AttachmentAliasPage() {
  redirect("/editor/attachments");
}
