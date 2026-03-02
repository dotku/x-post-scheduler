"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import NewsContent from "./NewsContent";
import type { NewsContentProps } from "./NewsContent";

const MonitoringContent = lazy(() => import("./MonitoringContent"));

type Tab = "news" | "monitoring";

interface IntelligencePageProps {
  locale: string;
  newsData: Omit<NewsContentProps, "locale">;
}

export default function IntelligencePage({
  locale,
  newsData,
}: IntelligencePageProps) {
  const t = useTranslations("intelligence");
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  const [tab, setTab] = useState<Tab>("news");

  // Read tab from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "monitoring") setTab("monitoring");
  }, []);

  // Sync tab to URL
  useEffect(() => {
    const path =
      tab === "monitoring" ? `${prefix}/news?tab=monitoring` : `${prefix}/news`;
    window.history.replaceState(null, "", path);
  }, [tab, prefix]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
                {t("title")}
              </h1>
              <p className="mt-1.5 text-gray-500 dark:text-gray-400 text-sm sm:text-base">
                {t("subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href={`${prefix}/dashboard`}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {t("backToDashboard")}
              </Link>
              {/* Language toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 text-xs font-medium">
                <Link
                  href="/news"
                  className={`px-2.5 py-1 rounded-md transition-colors ${!isZh ? "bg-blue-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                >
                  EN
                </Link>
                <Link
                  href="/zh/news"
                  className={`px-2.5 py-1 rounded-md transition-colors ${isZh ? "bg-blue-600 text-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}
                >
                  中文
                </Link>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-6 border-b border-gray-200 dark:border-gray-700 -mb-px">
            <button
              onClick={() => setTab("news")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === "news"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t("tabNews")}
            </button>
            <button
              onClick={() => setTab("monitoring")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === "monitoring"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t("tabMonitoring")}
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                Silver+
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {tab === "news" && <NewsContent locale={locale} {...newsData} />}
        {tab === "monitoring" && (
          <Suspense
            fallback={
              <div className="text-center py-12 text-gray-500">Loading...</div>
            }
          >
            <MonitoringContent locale={locale} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
