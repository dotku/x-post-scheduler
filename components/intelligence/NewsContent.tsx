"use client";

import Link from "next/link";
import type { DailyMediaNewsReport } from "@/lib/media-news";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, isZh: boolean): string {
  try {
    const d = new Date(`${dateStr}T00:00:00.000Z`);
    if (isZh) {
      return d.toLocaleDateString("zh-CN", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
    }
    return d.toLocaleDateString("en-US", {
      timeZone: "UTC",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ── product direction signals ────────────────────────────────────────────────

const PRODUCT_SIGNALS_ZH = [
  "AI 内容生产进入流程化，工具平台的竞争从「能否生成」升级为「能否批量分发+品牌安全管控」。",
  "社交平台投放效果可归因是决策核心，多账号统一数据视图成为关键能力。",
  "内容与投放的协同节奏加快，调度工具需支持「发布-监测-复盘」全闭环。",
];
const PRODUCT_SIGNALS_EN = [
  "AI content production is maturing — platform competition shifts from generation capability to bulk distribution and brand-safety guardrails.",
  "Attribution is the key buying criterion; a unified multi-account analytics view is a strategic differentiator.",
  "Content and media-buying cadence is converging — scheduling tools need to close the publish-monitor-review loop.",
];

// ── types ────────────────────────────────────────────────────────────────────

export interface NewsContentProps {
  locale: string;
  latest: DailyMediaNewsReport | null;
  latestWeekly: DailyMediaNewsReport | null;
  dailyArchive: DailyMediaNewsReport[];
}

// ── component ────────────────────────────────────────────────────────────────

export default function NewsContent({
  locale,
  latest,
  latestWeekly,
  dailyArchive,
}: NewsContentProps) {
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  const todayHighlightsRaw = isZh
    ? latest?.highlightsZh ?? []
    : latest?.highlightsEn ?? [];
  const weeklyHighlights = isZh
    ? latestWeekly?.highlightsZh ?? []
    : latestWeekly?.highlightsEn ?? [];

  const contextPrefix = isZh ? "【社会影响】" : "【Society】";
  const todayIndustryHighlights = todayHighlightsRaw.filter(
    (h) => !h.startsWith(contextPrefix),
  );
  const todayContextHighlights = todayHighlightsRaw
    .filter((h) => h.startsWith(contextPrefix))
    .map((h) => h.slice(contextPrefix.length).trim());

  return (
    <div className="space-y-6">
      {/* Date badge */}
      {latest?.date && (
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {formatDate(latest.date, isZh)}
        </p>
      )}

      {/* Quick section links */}
      <div className="flex flex-wrap gap-2 text-xs">
        <a
          href="#today"
          className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
        >
          {isZh ? "今日日报" : "Today"}
        </a>
        <a
          href="#product"
          className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
        >
          {isZh ? "产品方向信号" : "Product Signals"}
        </a>
        <a
          href="#archive"
          className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {isZh ? "往期存档" : "Archive"}
        </a>
        <a
          href="#weekly"
          className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60"
        >
          {isZh ? "本周周报" : "Weekly"}
        </a>
        <a
          href="#research"
          className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {isZh ? "深度研究" : "Research"}
        </a>
      </div>

      {/* ── Today's Daily Brief ──────────────────────────────────── */}
      <section id="today">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            {isZh ? "今日行业日报" : "Today's Daily Brief"}
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {/* Cover */}
          {latest?.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={latest.coverImageUrl}
              alt={
                isZh
                  ? "今日传媒行业日报配图"
                  : "Today's media industry brief cover"
              }
              className="h-48 sm:h-60 w-full object-cover"
            />
          ) : (
            <div className="h-48 sm:h-60 w-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white/80 text-4xl font-bold tracking-tight select-none">
                {isZh ? "传媒日报" : "Media Daily"}
              </span>
            </div>
          )}

          <div className="p-5 sm:p-6 space-y-5">
            {/* Title & meta */}
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                {latest
                  ? isZh
                    ? latest.titleZh
                    : latest.titleEn
                  : isZh
                    ? "今日日报生成中…"
                    : "Today's brief is being prepared…"}
              </h3>
              {latest && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {latest.date} ·{" "}
                  {isZh
                    ? `${latest.sourceCount} 家信源 · ${latest.usedAi ? "AI 汇总" : "规则汇总"}`
                    : `${latest.sourceCount} sources · ${latest.usedAi ? "AI synthesis" : "Rule-based"}`}
                </p>
              )}
            </div>

            {/* Bilingual summary */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  中文摘要
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {latest?.summaryZh ??
                    "正在从公开信源抓取并汇总最新传媒行业动态。"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  English Brief
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {latest?.summaryEn ??
                    "Collecting and summarizing latest media-industry developments from public sources."}
                </p>
              </div>
            </div>

            {/* Industry Highlights */}
            {todayIndustryHighlights.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
                  {isZh ? "传媒行业动态" : "Industry News"}
                </p>
                <ol className="space-y-2">
                  {todayIndustryHighlights.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {item}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Context / Social Highlights */}
            {todayContextHighlights.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-3">
                  {isZh ? "社会影响与行业背景" : "Social Impact & Context"}
                </p>
                <ol className="space-y-2">
                  {todayContextHighlights.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {item}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {!latest && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                {isZh
                  ? "今日数据尚未入库，等待每日定时任务写入后自动展示。"
                  : "No stored report yet. The page updates automatically after the daily cron job runs."}
              </p>
            )}

            {latest?.date && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <Link
                  href={`${prefix}/news/${latest.date}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {isZh
                    ? "查看完整报告与信源文章 →"
                    : "View full report & source articles →"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Product Direction Signals ────────────────────────────── */}
      <section id="product">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            {isZh
              ? "行业信号 → 产品方向"
              : "Industry Signals → Product Direction"}
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sm:p-6 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isZh
              ? "结合今日行业动态，以下信号与 xPilot 的产品方向直接相关："
              : "Based on today's industry coverage, these signals are directly relevant to xPilot's product direction:"}
          </p>

          {/* Today's AI highlights reframed */}
          {todayIndustryHighlights.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {isZh
                  ? "今日行业信号（AI 提炼）"
                  : "Today's Industry Signals (AI-distilled)"}
              </p>
              <ol className="space-y-2">
                {todayIndustryHighlights.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Persistent product signals */}
          <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {isZh ? "持续产品信号" : "Ongoing Product Signals"}
            </p>
            <ol className="space-y-2">
              {(isZh ? PRODUCT_SIGNALS_ZH : PRODUCT_SIGNALS_EN).map(
                (signal, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="shrink-0 mt-0.5 text-emerald-500 dark:text-emerald-400 font-bold">
                      →
                    </span>
                    {signal}
                  </li>
                ),
              )}
            </ol>
          </div>

          {/* Weekly strategic context */}
          {latestWeekly && weeklyHighlights.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {isZh ? "本周战略延伸" : "This Week's Strategic Context"}
              </p>
              <ol className="space-y-2">
                {weeklyHighlights.slice(0, 2).map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400 italic"
                  >
                    <span className="shrink-0 mt-0.5 text-indigo-400 font-bold">
                      ↗
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      {/* ── Archive ──────────────────────────────────────────────── */}
      <section id="archive">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
          {isZh ? "往期存档" : "Archive"}
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          {dailyArchive.length > 0 ? (
            <ul className="space-y-2">
              {dailyArchive.slice(0, 14).map((item) => (
                <li key={`d-${item.date}`} className="text-sm">
                  <Link
                    href={`${prefix}/news/${item.date}`}
                    className="flex items-baseline gap-1.5 group"
                  >
                    <span className="shrink-0 font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                      {item.date}
                    </span>
                    <span className="mx-0.5 text-gray-300 dark:text-gray-600">
                      ·
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:underline line-clamp-1">
                      {isZh ? item.titleZh : item.titleEn}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isZh ? "暂无往期日报。" : "No archived daily reports yet."}
            </p>
          )}
        </div>
      </section>

      {/* ── Weekly Report ────────────────────────────────────────── */}
      {latestWeekly && (
        <section id="weekly">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              {isZh ? "本周周报" : "This Week's Report"}
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isZh
                ? `周起始 ${latestWeekly.date}`
                : `Week of ${latestWeekly.date}`}
            </span>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sm:p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isZh ? latestWeekly.titleZh : latestWeekly.titleEn}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {isZh ? latestWeekly.summaryZh : latestWeekly.summaryEn}
            </p>
            {weeklyHighlights.length > 0 && (
              <ol className="space-y-2">
                {weeklyHighlights.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-gray-400">
              {isZh
                ? `${latestWeekly.sourceCount} 家信源 · ${latestWeekly.usedAi ? "AI 汇总" : "规则汇总"}`
                : `${latestWeekly.sourceCount} sources · ${latestWeekly.usedAi ? "AI synthesis" : "Rule-based"}`}
            </p>
          </div>
        </section>
      )}

      {/* ── Deep Research ────────────────────────────────────────── */}
      <section id="research">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
          {isZh ? "深度研究" : "Deep Research"}
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {isZh ? "深度研究" : "Deep Dive"}
            </p>
            <p className="font-medium text-gray-900 dark:text-white text-sm">
              {isZh
                ? "主流社交媒体全景（2026）"
                : "Social Media Landscape (2026)"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
              {isZh
                ? "平台规模、活跃度、渠道分工与投放建议。"
                : "Platform scale, channel roles, and execution guidance."}
            </p>
            <Link
              href={`${prefix}/news/social-media-landscape-2026`}
              className="self-start text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isZh ? "阅读 →" : "Read →"}
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {isZh ? "深度研究" : "Deep Dive"}
            </p>
            <p className="font-medium text-gray-900 dark:text-white text-sm">
              {isZh
                ? "美国主流媒体渠道全景（2026）"
                : "U.S. Mainstream Media Channels (2026)"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
              {isZh
                ? "电视、报纸、数字媒体、音频与社交分发层梳理。"
                : "TV, newspapers, digital-native, audio, and social distribution."}
            </p>
            <Link
              href={`${prefix}/news/us-mainstream-media-2026`}
              className="self-start text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isZh ? "阅读 →" : "Read →"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
