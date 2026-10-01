import { redirect } from "next/navigation";

/** Singular alias; the lab lives at `/lab/attachments`. */
export default function AttachmentAliasPage() {
  redirect("/lab/attachments");
}
