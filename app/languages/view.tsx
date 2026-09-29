"use client";

import type { ReactNode } from "react";
import { PageLayout } from "@/components/ui/page-layout";
import { LanguageIndex } from "@/components/languages/language-index";
import { PLChart } from "@/components/languages/pl-chart";
import { t } from "@/lib/i18n";
import { useLocale } from "@/services";

// =============================================================================
// /languages — the PL chart.
//
// The figure first, then what it means (the explanation, prose rendered on
// the server), then every note, as a list. Formerly its own site
// (github.com/Huxpro/PL-chart, ECharts on a blank page); here it is a page of
// this one: the site's type, its ink, its surfaces.
// =============================================================================

export function LanguagesView({ explanation }: { explanation: ReactNode }) {
  const { locale } = useLocale();
  return (
    <PageLayout page="languages">
      <PLChart locale={locale} />

      {/* My words, in English whatever the locale. */}
      <div lang="en" className="prose-article mt-16">
        {explanation}
      </div>

      <section aria-labelledby="languages-notes" className="mt-16">
        <h2
          id="languages-notes"
          className="mb-6 text-[1.125rem] font-medium text-foreground"
        >
          {t(locale, "languagesNotes")}
        </h2>
        <LanguageIndex locale={locale} />
      </section>
    </PageLayout>
  );
}
