import type { Metadata } from "next";
import Link from "next/link";
import {
  fetchDailyMediaTechNews,
  getLatestStoredMediaIndustryReport,
} from "@/lib/media-news";

export const metadata: Metadata = {
  title: "Media Industry Daily Summary | xPilot",
  description:
    "Today’s media, social, and marketing industry summary with bilingual insights and action points.",
};

export const dynamic = "force-dynamic";

export default async function WeeklyTemplatePage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";
  const latestDaily = await fetchDailyMediaTechNews();
  const latestWeekly = await getLatestStoredMediaIndustryReport("weekly");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href={`${prefix}/media-news`}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← {isZh ? "返回传媒行业日报" : "Back to Media Industry Daily"}
          </Link>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {isZh
              ? `传媒营销科技行业总结（${latestDaily?.date ?? "今日"}）`
              : `Media, Social & Marketing Industry Summary (${latestDaily?.date ?? "Today"})`}
          </h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {isZh
              ? "基于今日媒体与社交营销相关报道，提炼行业信号、策略影响与可执行动作。"
              : "A published report summarizing today’s media, social, and marketing signals with strategic implications."}
          </p>
        </div>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sm:p-8 space-y-8 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "今日双语摘要" : "Today’s Bilingual Brief"}
            </h2>
            {latestDaily ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isZh
                    ? `日期：${latestDaily.date} · 来源数：${latestDaily.sourceCount} · 生成：${latestDaily.usedAi ? "AI" : "规则"}`
                    : `Date: ${latestDaily.date} · Sources: ${latestDaily.sourceCount} · Method: ${latestDaily.usedAi ? "AI" : "Rule-based"}`}
                </p>

                {latestDaily.coverImageUrl ? (
                  <img
                    src={latestDaily.coverImageUrl}
                    alt={isZh ? "今日行业总结配图" : "Today report cover"}
                    className="h-48 w-full rounded-lg object-cover"
                  />
                ) : null}

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {latestDaily.titleZh} / {latestDaily.titleEn}
                </h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      中文
                    </p>
                    <p className="mt-2">{latestDaily.summaryZh}</p>
                    <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                      {latestDaily.highlightsZh.map((item, index) => (
                        <li key={`w-zh-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      English
                    </p>
                    <p className="mt-2">{latestDaily.summaryEn}</p>
                    <ul className="mt-2 list-disc list-inside space-y-1 text-sm">
                      {latestDaily.highlightsEn.map((item, index) => (
                        <li key={`w-en-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-sm text-gray-600 dark:text-gray-400">
                {isZh
                  ? "今日数据尚未生成。请先触发 /api/cron/media-news?period=daily。"
                  : "Today’s report is not generated yet. Trigger /api/cron/media-news?period=daily first."}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "今日行业趋势判断" : "Today’s Trend Signals"}
            </h2>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  {isZh
                    ? "AI 内容生产进入“流程化阶段”，重点从生成速度转向品牌安全与分发效率。"
                    : "AI content production is shifting from raw generation speed to workflow quality, brand safety, and distribution efficiency."}
                </li>
                <li>
                  {isZh
                    ? "社交平台竞争焦点继续向“可归因转化”倾斜，营销预算更加看重真实转化链路。"
                    : "Social competition continues to move toward attributable conversion, with marketing budgets prioritizing measurable outcomes."}
                </li>
                <li>
                  {isZh
                    ? "媒体分发碎片化加深，同一议题需要跨短视频、图文、社区的多格式协同。"
                    : "Media distribution fragmentation deepens, requiring multi-format coordination across short video, articles, and communities."}
                </li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "今日营销执行建议" : "Today’s Marketing Actions"}
            </h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                {isZh
                  ? "将今日热议主题拆成三种格式（短视频/图文/社群观点），24 小时内完成一次矩阵分发。"
                  : "Turn today’s top topic into 3 formats (short video/article/community POV) and execute a 24-hour matrix distribution."}
              </li>
              <li>
                {isZh
                  ? "对今日投放素材做 A/B 版本，分别优化“点击率”和“转化率”，避免单一素材吃全量预算。"
                  : "Run A/B variants for today’s ad creatives with separate optimization targets (CTR vs conversion) to avoid single-creative budget concentration."}
              </li>
              <li>
                {isZh
                  ? "把来源名单中的高可信媒体纳入固定监测池，建立“晨间快报 + 午间复盘”双节奏。"
                  : "Build a fixed high-trust source pool from today’s outlets and run a two-cycle cadence: morning brief + noon recalibration."}
              </li>
            </ol>
          </section>

          {latestWeekly ? (
            <section>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {isZh ? "本周延伸观察" : "Weekly Extended Context"}
              </h2>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
                <p className="font-medium">
                  {latestWeekly.titleZh} / {latestWeekly.titleEn}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isZh
                    ? `周期起点：${latestWeekly.date} · 来源：${latestWeekly.sourceCount}`
                    : `Week start: ${latestWeekly.date} · Sources: ${latestWeekly.sourceCount}`}
                </p>
              </div>
            </section>
          ) : null}
        </article>
      </div>
    </div>
  );
}
