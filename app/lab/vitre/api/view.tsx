"use client";

import { ApiFilter, ApiReference, LibraryShell } from "@/systems/lab";
import { useState } from "react";
import { VITRE_API } from "../api";

/** /lab/vitre/api — the library template's API page, with Vitre's data. */
export function VitreApiView() {
  const [query, setQuery] = useState("");
  return (
    <LibraryShell lab="vitre" page="api" tools={<ApiFilter value={query} onChange={setQuery} />}>
      <ApiReference api={VITRE_API} query={query} />
    </LibraryShell>
  );
}
