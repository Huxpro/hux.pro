"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale } from "@/components/providers";
import { t } from "@/lib/i18n";

export default function Home() {
  const { locale } = useLocale();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[680px] px-6 pt-[20vh] pb-24">
        {/* Hero */}
        <section className="mb-16">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Hux<span className="text-muted-foreground">.pro</span>
          </h1>
          <p className="mt-6 text-xl leading-relaxed text-muted-foreground">
            {locale === "en" ? (
              <>
                <span className="font-serif italic">Prose</span>, profession, programming,
                production, projects—each a facet of a complete person.
              </>
            ) : (
              <>
                <span className="font-serif italic">散文</span>、职业、编程、生产、项目——一个完整人格的多重面向。
              </>
            )}
          </p>
        </section>

        {/* Status */}
        <section className="mb-16">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="font-mono">{t(locale, "currently")}</span>
          </div>
          <p className="text-foreground leading-relaxed">
            {t(locale, "currentStatus")}
          </p>
        </section>

        {/* Navigation */}
        <section className="space-y-1">
          <NavLink
            href="/career"
            label={t(locale, "career")}
            description={t(locale, "careerDesc")}
          />
          <NavLink
            href="/blog"
            label={t(locale, "blog")}
            description={t(locale, "blogDesc")}
          />
          <NavLink
            href="/talks"
            label={t(locale, "talks")}
            description={t(locale, "talksDesc")}
          />
        </section>

      </main>
    </div>
  );
}

function NavLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between py-4 border-b border-border/50 transition-colors hover:border-foreground/20"
    >
      <div>
        <span className="text-foreground font-medium">{label}</span>
        <span className="ml-3 text-muted-foreground text-sm">{description}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
    </Link>
  );
}
