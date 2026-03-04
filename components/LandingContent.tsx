"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/wavespeed";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LandingEditor from "./landing/LandingEditor";

function detectInAppBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const isWeChat = ua.includes("micromessenger");
  const isInAppBrowser =
    isWeChat ||
    ua.includes("webview") ||
    ua.includes("; wv)") ||
    ua.includes("instagram") ||
    ua.includes("fban") ||
    ua.includes("fbav");
  return { isWeChat, isInAppBrowser };
}

interface PublicStatsResponse {
  totals: {
    users: number;
    posts: number;
    galleryItems: number;
    knowledgeSources: number;
    requests: number;
    tokens: number;
    webVisits: number;
  };
  window30d: {
    requests: number;
    tokens: number;
    webVisits: number;
    topPages: {
      path: string;
      visits: number;
    }[];
    byProvider: {
      provider: string;
      requests: number;
      tokens: number;
    }[];
    topModels: {
      provider: string;
      model: string;
      requests: number;
      tokens: number;
    }[];
  };
  updatedAt: string;
}

type ProviderInfo = {
  name: string;
  badge: string;
  models: { id: string; label: string; mode: "image" | "video" | "text" }[];
};

function detectProvider(modelId: string): string {
  if (modelId.startsWith("bytedance/")) return "ByteDance";
  if (modelId.startsWith("alibaba/")) return "Alibaba";
  if (modelId.startsWith("kwaivgi/")) return "Kuaishou";
  if (modelId.startsWith("wavespeed-ai/")) {
    if (modelId.includes("qwen")) return "Alibaba";
    if (modelId.includes("wan-")) return "Alibaba";
    if (modelId.includes("flux")) return "Black Forest Labs";
    if (modelId.includes("uno")) return "ByteDance";
    if (modelId.includes("real-esrgan")) return "Xintao Wang";
    return "AI Platform";
  }
  return "Other";
}

export default function LandingContent({
  isLoggedIn = false,
}: {
  isLoggedIn?: boolean;
}) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const lang = locale;
  const prefix = locale === "zh" ? "/zh" : "";

  const [userAgent] = useState(() =>
    typeof window === "undefined" ? "" : window.navigator.userAgent || "",
  );
  const [copied, setCopied] = useState(false);
  const [copiedWechat, setCopiedWechat] = useState("");
  const [stats, setStats] = useState<PublicStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const browserEnv = useMemo(() => detectInAppBrowser(userAgent), [userAgent]);

  const features = useMemo(
    () => [
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ),
        title: t("feature1Title"),
        description: t("feature1Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        ),
        title: t("feature2Title"),
        description: t("feature2Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        ),
        title: t("feature3Title"),
        description: t("feature3Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        ),
        title: t("feature4Title"),
        description: t("feature4Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        ),
        title: t("feature5Title"),
        description: t("feature5Desc"),
        premium: true,
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        ),
        title: t("feature6Title"),
        description: t("feature6Desc"),
      },
    ],
    [t],
  );

  const providerInfo = useMemo<ProviderInfo[]>(() => {
    const map = new Map<string, ProviderInfo>();
    const ensure = (provider: string, badge: string) => {
      const existing = map.get(provider);
      if (existing) return existing;
      const created: ProviderInfo = { name: provider, badge, models: [] };
      map.set(provider, created);
      return created;
    };
    for (const model of IMAGE_MODELS) {
      ensure(detectProvider(model.id), "Image/Video").models.push({
        id: model.id,
        label: model.label,
        mode: "image",
      });
    }
    for (const model of VIDEO_MODELS) {
      ensure(detectProvider(model.id), "Image/Video").models.push({
        id: model.id,
        label: model.label,
        mode: "video",
      });
    }
    // Seedance 2.0 (separate provider, not in VIDEO_MODELS)
    ensure("ByteDance", "Image/Video").models.push(
      { id: "seedance-2.0/text-to-video", label: "Seedance 2.0", mode: "video" },
      { id: "seedance-2.0/image-to-video", label: "Seedance 2.0 i2v", mode: "video" },
    );
    ensure("OpenAI", "Text").models.push({
      id: "gpt-4o",
      label: "GPT-4o (tweet generation)",
      mode: "text",
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, []);

  // Aggregate top-models data by actual model vendor instead of API provider
  const byModelVendor = useMemo(() => {
    if (!stats) return [];
    const map = new Map<string, number>();
    for (const item of stats.window30d.topModels) {
      const vendor =
        item.provider === "openai" ? "OpenAI" : detectProvider(item.model);
      map.set(vendor, (map.get(vendor) ?? 0) + item.requests);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([vendor, requests]) => ({ vendor, requests }));
  }, [stats]);

  useEffect(() => {
    fetch("/api/public/stats")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as PublicStatsResponse;
      })
      .then((data) => setStats(data))
      .finally(() => setStatsLoading(false));
  }, []);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const highlight = t("heroHighlight");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <h1
            className={`font-bold text-gray-900 dark:text-white ${
              lang === "zh" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
            }`}
          >
            {t("appName")}
          </h1>

          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link
              href={`${prefix}/gallery`}
              className="text-gray-600 dark:text-gray-400 hover:underline underline-offset-4"
            >
              {t("galleryFeed")}
            </Link>
            <Link
              href={`${prefix}/docs`}
              className="text-gray-600 dark:text-gray-400 hover:underline underline-offset-4"
            >
              {t("docs")}
            </Link>
            <Link
              href={`${prefix}/news`}
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline underline-offset-4"
            >
              {locale === "zh" ? "传媒日报" : "Media Daily"}
            </Link>
            <Link
              href={`${prefix}/changelog`}
              className="text-gray-600 dark:text-gray-400 hover:underline underline-offset-4"
            >
              {t("changelog")}
            </Link>
            <Link
              href={`${prefix}/invest`}
              className="text-gray-600 dark:text-gray-400 hover:underline underline-offset-4"
            >
              {t("investor")}
            </Link>
            <LanguageSwitcher />
            {!browserEnv.isInAppBrowser &&
              (isLoggedIn ? (
                <Link
                  href={`${prefix}/dashboard`}
                  className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-4"
                >
                  {t("dashboard")}
                </Link>
              ) : (
                <Link
                  href={`${prefix}/login`}
                  className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-4"
                >
                  {t("signIn")}
                </Link>
              ))}
          </div>

          <button
            type="button"
            onClick={() => setNavMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
            aria-expanded={navMenuOpen}
            aria-label={locale === "zh" ? "切换菜单" : "Toggle menu"}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  navMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>
        </div>

        {navMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col gap-2 text-sm">
              <Link
                href={`${prefix}/gallery`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("galleryFeed")}
              </Link>
              <Link
                href={`${prefix}/docs`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("docs")}
              </Link>
              <Link
                href={`${prefix}/news`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                {locale === "zh" ? "传媒日报" : "Media Daily"}
              </Link>
              <Link
                href={`${prefix}/changelog`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("changelog")}
              </Link>
              <Link
                href={`${prefix}/invest`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("investor")}
              </Link>
              <div className="pt-1">
                <LanguageSwitcher />
              </div>
              {!browserEnv.isInAppBrowser &&
                (isLoggedIn ? (
                  <Link
                    href={`${prefix}/dashboard`}
                    onClick={() => setNavMenuOpen(false)}
                    className="rounded-md px-2 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {t("dashboard")}
                  </Link>
                ) : (
                  <Link
                    href={`${prefix}/login`}
                    onClick={() => setNavMenuOpen(false)}
                    className="rounded-md px-2 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {t("signIn")}
                  </Link>
                ))}
            </div>
          </div>
        )}
      </header>

      {/* Beta Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
          {t("betaNotice")}
        </div>
      </div>

      {/* Seedance 2.0 Announcement */}
      <div className="bg-linear-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border-b border-purple-200 dark:border-purple-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-center">
          <p className="text-sm sm:text-base text-gray-900 dark:text-white">
            <span className="font-semibold">
              🚀 Seedance 2.0 Live
            </span>
            {" · "}
            {lang === "zh"
              ? "Seedance 2.0 视频生成模型现已上线！支持更高质量的 AI 视频创作。"
              : "Seedance 2.0 video generation model is now live! Create higher quality AI videos."}{" "}
            <Link
              href={`${prefix}/toolbox`}
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              {lang === "zh" ? "立即体验 →" : "Try it now →"}
            </Link>
          </p>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
          {t("heroTitle")}
          {highlight && (
            <>
              <br className="hidden sm:block" />
              <span className="text-blue-600 dark:text-blue-400">
                {" "}
                {highlight}
              </span>
            </>
          )}
        </h2>
        <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {t("heroSubtitle")}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {browserEnv.isInAppBrowser ? (
            <div className="w-full max-w-md rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4 text-sm text-left">
              <p className="font-semibold text-base">
                {browserEnv.isWeChat
                  ? t("wechatDetected")
                  : t("embeddedBrowser")}
              </p>
              <p className="mt-2">
                {browserEnv.isWeChat ? t("wechatHint") : t("embeddedHint")}
              </p>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="mt-3 w-full inline-flex items-center justify-center px-3 py-2.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors font-medium"
              >
                {copied ? t("linkCopied") : t("copyLink")}
              </button>
            </div>
          ) : isLoggedIn ? (
            <>
              <Link
                href={`${prefix}/dashboard`}
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                {t("goToDashboard")}
              </Link>
              <Link
                href={`${prefix}/news`}
                className="inline-flex items-center px-6 py-3 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                {locale === "zh" ? "今日传媒日报 →" : "Today's Media Brief →"}
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`${prefix}/login`}
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                {t("getStarted")}
              </Link>
              <Link
                href={`${prefix}/news`}
                className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {locale === "zh" ? "传媒行业日报 →" : "Media Industry Daily →"}
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Try editor */}
      <LandingEditor isLoggedIn={isLoggedIn} />

      {/* Features */}
      <section className="bg-white dark:bg-gray-800 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            {t("featuresTitle")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={`p-6 rounded-lg border ${feature.premium ? "border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/10" : "border-gray-200 dark:border-gray-700"}`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${feature.premium ? "bg-amber-100 dark:bg-amber-900/40" : "bg-blue-100 dark:bg-blue-900"}`}>
                    <svg
                      className={`w-5 h-5 ${feature.premium ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {feature.icon}
                    </svg>
                  </div>
                  {feature.premium && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      Silver+
                    </span>
                  )}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Usage */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {t("usageTitle")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t("usageSubtitle")}
            </p>
          </div>
          {stats?.updatedAt && (
            <p className="text-xs text-gray-400">
              {t("updated")} {new Date(stats.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {statsLoading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("loadingMetrics")}
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: t("statUsers"), value: stats.totals.users },
                { label: t("statAiRequests"), value: stats.totals.requests },
                { label: t("statTokens"), value: stats.totals.tokens },
                { label: t("statGallery"), value: stats.totals.galleryItems },
                { label: t("statWebVisits"), value: stats.totals.webVisits },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {item.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {byModelVendor.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    {t("last30ByProvider")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {byModelVendor.map((item) => (
                      <div
                        key={item.vendor}
                        className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm"
                      >
                        <span className="text-gray-700 dark:text-gray-300">
                          {item.vendor}
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {item.requests.toLocaleString()} {t("req")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  {t("topPages")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stats.window30d.topPages.slice(0, 6).map((item) => (
                    <div
                      key={item.path}
                      className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate pr-2">
                        {item.path}
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {item.visits.toLocaleString()} {t("visits")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("metricsUnavailable")}
          </div>
        )}
      </section>

      {/* Providers & Models */}
      <section className="bg-white dark:bg-gray-800 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            {t("modelsTitle")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            {t("modelsSubtitle")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providerInfo.map((provider) => (
              <div
                key={provider.name}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {provider.name}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {provider.badge}
                  </span>
                </div>
                <div className="space-y-2">
                  {provider.models.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate">
                        {model.label}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400 uppercase">
                        {model.mode}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {t("howItWorksTitle")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {(
            [
              { n: "1", title: t("step1Title"), desc: t("step1Desc") },
              { n: "2", title: t("step2Title"), desc: t("step2Desc") },
              { n: "3", title: t("step3Title"), desc: t("step3Desc") },
            ] as const
          ).map((step) => (
            <div key={step.n}>
              <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg mb-4">
                {step.n}
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {step.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white dark:bg-gray-800 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            {t("pricingTitle")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-3 max-w-xl mx-auto">
            {t("pricingSubtitle")}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-10 max-w-2xl mx-auto">
            {lang === "zh"
              ? "提示：AI Post Scheduler（自动发布）仅订阅会员可用。"
              : "Note: AI Post Scheduler (auto-post) is available to subscribed members only."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pay as you go plan */}
            <div className="relative rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-6 flex flex-col text-left">
              <p className="text-base font-bold text-gray-900 dark:text-white mb-1">
                {lang === "zh" ? "按需付费" : "Pay as you go"}
              </p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                $0
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  /mo
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400 flex-1">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {lang === "zh" ? "按需购买积分" : "Buy credits as needed"}
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-300 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  {lang === "zh"
                    ? "不支持社交账号自动发布"
                    : "No social auto-posting"}
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-300 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  {lang === "zh" ? "无认证标识" : "No verified badge"}
                </li>
              </ul>
              <Link
                href={isLoggedIn ? `${prefix}/settings` : `${prefix}/login`}
                className="mt-5 block text-center py-2 rounded-lg text-sm font-semibold transition-colors bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {lang === "zh" ? "开始使用" : "Get Started"}
              </Link>
            </div>
            {(["wood", "bronze", "iron", "silver", "gold"] as const).map(
              (tier) => {
                const tiers = {
                  wood: {
                    labelEn: "Wood",
                    labelZh: "木头",
                    price: 3,
                    accounts: "1",
                    accountsZh: "1 个账号",
                    popular: false,
                    color: "green",
                  },
                  bronze: {
                    labelEn: "Bronze",
                    labelZh: "青铜",
                    price: 5,
                    accounts: "2",
                    accountsZh: "2 个账号",
                    popular: false,
                    color: "amber",
                  },
                  iron: {
                    labelEn: "Iron",
                    labelZh: "钢铁",
                    price: 8,
                    accounts: "3",
                    accountsZh: "3 个账号",
                    popular: false,
                    color: "slate",
                  },
                  silver: {
                    labelEn: "Silver",
                    labelZh: "白银",
                    price: 18,
                    accounts: "5",
                    accountsZh: "5 个账号",
                    popular: true,
                    color: "blue",
                  },
                  gold: {
                    labelEn: "Gold",
                    labelZh: "黄金",
                    price: 188,
                    accounts: "10",
                    accountsZh: "10 个账号",
                    popular: false,
                    color: "yellow",
                  },
                }[tier];
                const isPopular = tiers.popular;
                return (
                  <div
                    key={tier}
                    className={`relative rounded-2xl border-2 p-6 flex flex-col text-left ${
                      isPopular
                        ? "border-blue-500 shadow-lg"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {lang === "zh" ? "最受欢迎" : "Most Popular"}
                      </span>
                    )}
                    <p className="text-base font-bold text-gray-900 dark:text-white mb-1">
                      {lang === "zh" ? tiers.labelZh : tiers.labelEn}
                    </p>
                    <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                      ${tiers.price}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                        /mo
                      </span>
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400 flex-1">
                      <li className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {lang === "zh"
                          ? tiers.accountsZh
                          : `${tiers.accounts} account${tiers.accounts === "1" ? "" : "s"}`}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {lang === "zh"
                          ? `每月充值 $${tiers.price}`
                          : `$${tiers.price} monthly credit`}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {lang === "zh" ? "✓ 认证会员标识" : "✓ Verified badge"}
                      </li>
                    </ul>
                    <Link
                      href={
                        isLoggedIn ? `${prefix}/settings` : `${prefix}/login`
                      }
                      className={`mt-5 block text-center py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isPopular
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {lang === "zh" ? "立即订阅" : "Get Started"}
                    </Link>
                  </div>
                );
              },
            )}
          </div>

          {/* Enterprise plan */}
          <div className="mt-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {lang === "zh" ? "企业版" : "Enterprise"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {lang === "zh"
                  ? "专属定制方案，适合月预算 $15k+ 的团队与企业客户——更多账号、更高配额、私有部署支持"
                  : "Custom solutions for teams & enterprises with $15k+ monthly budget — more accounts, higher limits, and dedicated support"}
              </p>
            </div>
            <a
              href="https://jytech.us"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold rounded-lg border-2 border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors text-center"
            >
              {lang === "zh" ? "联系我们" : "Contact Us"}
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      {!browserEnv.isInAppBrowser && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t("ctaTitle")}
          </h3>
          <Link
            href={isLoggedIn ? `${prefix}/dashboard` : `${prefix}/login`}
            className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
          >
            {isLoggedIn ? t("goToDashboard") : t("ctaButton")}
          </Link>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-8 px-4">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("footerName")}
          </p>
          <div className="text-center space-y-2 sm:space-y-1">
            <p className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              {lang === "zh" ? "微信客服" : "WeChat Support"}:
            </p>
            <div className="flex flex-col sm:flex-row sm:gap-4 gap-2 text-sm sm:text-base">
              <button
                onClick={() => {
                  navigator.clipboard.writeText("techfront-robot");
                  setCopiedWechat("techfront-robot");
                  setTimeout(() => setCopiedWechat(""), 2000);
                }}
                className={`px-3 py-2 sm:py-1.5 rounded-md transition-all ${
                  copiedWechat === "techfront-robot"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                {copiedWechat === "techfront-robot" ? "✓ " : ""}
                techfront-robot ({t("shanghai")})
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("xinmai002leo");
                  setCopiedWechat("xinmai002leo");
                  setTimeout(() => setCopiedWechat(""), 2000);
                }}
                className={`px-3 py-2 sm:py-1.5 rounded-md transition-all ${
                  copiedWechat === "xinmai002leo"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                {copiedWechat === "xinmai002leo" ? "✓ " : ""}
                xinmai002leo ({t("shenzhen")})
              </button>
            </div>
            {copiedWechat && (
              <p className="text-xs text-green-600 dark:text-green-400 animate-fade-in">
                {lang === "zh" ? "已复制微信号" : "WeChat ID copied"}
              </p>
            )}
          </div>

          {/* Africa region support */}
          <div className="text-center space-y-2 sm:space-y-1">
            <p className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              {lang === "zh" ? "非洲地区客服" : "Africa Region Support"} —
              Mohamadou Laminou:
            </p>
            <div className="flex flex-col sm:flex-row sm:gap-4 gap-2 text-sm sm:text-base">
              <a
                href="mailto:mohamadou439@gmail.com"
                className="px-3 py-2 sm:py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all break-all sm:break-normal"
              >
                mohamadou439@gmail.com
              </a>
              <a
                href="https://wa.me/8613162726136"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 sm:py-1.5 rounded-md bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 transition-all break-all sm:break-normal"
              >
                WhatsApp: +86 131 6272 6136
              </a>
            </div>
          </div>
          <Link
            href={`${prefix}/invest`}
            className="text-sm hover:underline underline-offset-4 text-gray-500 dark:text-gray-400"
          >
            {t("investorMemo")}
          </Link>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs text-gray-500 dark:text-gray-500 pt-3">
            <Link
              href={`${prefix}/about`}
              className="hover:text-gray-700 dark:hover:text-gray-400 hover:underline underline-offset-2"
            >
              {lang === "zh" ? "关于我们" : "About"}
            </Link>
            <Link
              href={`${prefix}/privacy`}
              className="hover:text-gray-700 dark:hover:text-gray-400 hover:underline underline-offset-2"
            >
              {lang === "zh" ? "隐私政策" : "Privacy"}
            </Link>
            <Link
              href={`${prefix}/terms`}
              className="hover:text-gray-700 dark:hover:text-gray-400 hover:underline underline-offset-2"
            >
              {lang === "zh" ? "服务条款" : "Terms"}
            </Link>
            <Link
              href={`${prefix}/disclaimer`}
              className="hover:text-gray-700 dark:hover:text-gray-400 hover:underline underline-offset-2"
            >
              {lang === "zh" ? "免责声明" : "Disclaimer"}
            </Link>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {lang === "zh"
              ? `© ${new Date().getFullYear()} X 推创. 保留所有权利。`
              : `© ${new Date().getFullYear()} xPilot. All rights reserved.`}
          </p>
        </div>
      </footer>
    </div>
  );
}
