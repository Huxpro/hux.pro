"use client";

import type { BlogPostSummary } from "@/lib/content";
import type { PromptsData } from "@/lib/prompts";
import { createContext, useContext } from "react";

/**
 * Data the native Writing and Prompt windows need on every route. The root
 * layout (a server component) loads it once and hands it here, the same way
 * the home page already receives the writing list.
 */
interface BuiltinCatalogValue {
  posts: BlogPostSummary[];
  promptsEn: PromptsData | null;
  promptsZh: PromptsData | null;
}

const BuiltinCatalogContext = createContext<BuiltinCatalogValue>({
  posts: [],
  promptsEn: null,
  promptsZh: null,
});

export function BuiltinCatalogProvider({
  posts,
  promptsEn,
  promptsZh,
  children,
}: BuiltinCatalogValue & { children: React.ReactNode }) {
  return (
    <BuiltinCatalogContext.Provider value={{ posts, promptsEn, promptsZh }}>
      {children}
    </BuiltinCatalogContext.Provider>
  );
}

export function useBuiltinCatalog() {
  return useContext(BuiltinCatalogContext);
}
