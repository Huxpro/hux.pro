import type { LabTable } from "@/systems/lab";

const en = {
  meta: "from the pillow",
};

const zh: typeof en = {
  meta: "从枕头上看",
};

export const STRINGS: LabTable<typeof en> = { en, zh };
