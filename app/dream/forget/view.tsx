"use client";

import { useLocale } from "@/services";
import { useRouter } from "next/navigation";
import { StageProvider } from "stage";
import Forget from "./forget.scene";

/** The app's side of the dream: its language, and where waking goes. */
export function ForgetDream() {
  const { locale } = useLocale();
  const router = useRouter();
  return (
    <StageProvider locale={locale} onWake={() => router.push("/")}>
      <Forget />
    </StageProvider>
  );
}
