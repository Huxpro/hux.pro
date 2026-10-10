"use client";

import { useLocale } from "@/services";
import { useRouter } from "next/navigation";
import { StageProvider } from "stage";
import Everyone from "./everyone.scene";

/** The app's side of the dream: its language, and where waking goes. */
export function EveryoneDream() {
  const { locale } = useLocale();
  const router = useRouter();
  return (
    <StageProvider locale={locale} onWake={() => router.push("/")}>
      <Everyone />
    </StageProvider>
  );
}
