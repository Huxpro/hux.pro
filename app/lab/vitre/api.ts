import type { ApiField, LibraryApi } from "@/systems/lab";
import {
  BOOT_STATE,
  CHROME_SYNC_OPTIONS,
  EXPORTS,
  SCROLL_PAGE_OPTIONS,
  VITRE_PROPS,
  VITRE_STATE,
  type FieldDoc,
} from "@/packages/vitre/site/src/docs/api";

// Vitre's API, in the library template's shape. The data is the package's
// (site/src/docs/api.ts), which fails the type check for an export or a field
// of a public type that is not documented. So this page lists exactly what
// ships, and every export links to the section of the guide that covers it.

function fields(docs: Record<string, FieldDoc>): ApiField[] {
  return Object.entries(docs).map(([name, f]) => ({ name, type: f.type, default: f.default, summary: f.summary }));
}

export const VITRE_API: LibraryApi = {
  exports: Object.entries(EXPORTS).map(([name, d]) => ({
    name,
    kind: d.kind,
    signature: d.signature,
    summary: d.summary,
    docs: `/lab/vitre#${d.section}`,
  })),
  types: [
    { name: "VitreProps", fields: fields(VITRE_PROPS) },
    { name: "VitreState", fields: fields(VITRE_STATE) },
    { name: "VitreBootState", fields: fields(BOOT_STATE) },
    { name: "ChromeSyncOptions", fields: fields(CHROME_SYNC_OPTIONS) },
    { name: "ScrollPageOptions", fields: fields(SCROLL_PAGE_OPTIONS) },
  ],
};
