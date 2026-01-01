"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/providers";
import { t } from "@/lib/i18n";
import type { CareerEntry } from "@/lib/content";

// Sample career data with bilingual support
const careerEntries: CareerEntry[] = [
  {
    role: "Senior Software Engineer",
    roleZh: "高级软件工程师",
    company: "ByteDance",
    companyZh: "字节跳动",
    startDate: "2022-01",
    endDate: "present",
    achievements: [
      "Leading cross-platform framework development",
      "Building developer tools and improving DX",
      "Designing and implementing component systems",
    ],
    achievementsZh: [
      "主导跨平台框架开发",
      "构建开发者工具并改善开发体验",
      "设计和实现组件系统",
    ],
  },
  {
    role: "Software Engineer",
    roleZh: "软件工程师",
    company: "Previous Company",
    companyZh: "前公司",
    startDate: "2019-06",
    endDate: "2021-12",
    achievements: [
      "Built and maintained production web applications",
      "Contributed to open-source projects",
      "Mentored junior engineers",
    ],
    achievementsZh: [
      "构建和维护生产环境 Web 应用",
      "为开源项目做贡献",
      "指导初级工程师",
    ],
  },
];

export default function CareerPage() {
  const { locale } = useLocale();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[680px] px-6 pt-16 pb-24">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(locale, "home")}
        </Link>

        {/* Header */}
        <header className="mb-16">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t(locale, "careerTitle")}
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            {t(locale, "careerSubtitle")}
          </p>
        </header>

        {/* Timeline */}
        <section className="space-y-12">
          {careerEntries.map((entry, index) => {
            const role = locale === "zh" && entry.roleZh ? entry.roleZh : entry.role;
            const company = locale === "zh" && entry.companyZh ? entry.companyZh : entry.company;
            const achievements =
              locale === "zh" && entry.achievementsZh
                ? entry.achievementsZh
                : entry.achievements;
            const endDate = entry.endDate === "present"
              ? (locale === "zh" ? "至今" : "present")
              : entry.endDate;

            return (
              <article key={index} className="group">
                {/* Date range */}
                <div className="font-mono text-sm text-muted-foreground mb-2">
                  {entry.startDate} — {endDate}
                </div>

                {/* Role & Company */}
                <h2 className="text-xl font-medium text-foreground">{role}</h2>
                <p className="text-muted-foreground mt-1">{company}</p>

                {/* Achievements */}
                <ul className="mt-4 space-y-2">
                  {achievements.map((achievement, i) => (
                    <li
                      key={i}
                      className="text-foreground/80 leading-relaxed pl-4 border-l-2 border-border"
                    >
                      {achievement}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
