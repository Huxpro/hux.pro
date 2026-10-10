"use client";

import { useLocale } from "@/services";
import { useRouter } from "next/navigation";
import { StageProvider } from "stage";
import Blue from "./blue.scene";

/** The app's side of the dream: its language, and where waking goes. */
export function BlueDream() {
  const { locale } = useLocale();
  const router = useRouter();
  return (
    <StageProvider locale={locale} onWake={() => router.push("/")}>
      <Blue />
    </StageProvider>
  );
}
