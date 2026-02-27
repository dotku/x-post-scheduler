import Link from "next/link";
import {
  fetchDailyMediaTechNews,
  getLatestStoredMediaIndustryReport,
} from "@/lib/media-news";

export default async function MediaDailyWidget({
  locale,
}: {
  locale: string;
}) {
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  let daily = null;
  let weekly = null;
  try {
    [daily, weekly] = await Promise.all([
      fetchDailyMediaTechNews(),
      getLatestStoredMediaIndustryReport("weekly"),
    ]);
  } catch {
    return null;
  }

  if (!daily && !weekly) return null;

  const highlights = isZh
    ? daily?.highlightsZh ?? []
    : daily?.highlightsEn ?? [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {isZh ? "今日传媒行业动态" : "Today's Media Brief"}
            </h2>
          </span>
          {daily?.date && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {daily.date}
            </span>
          )}
        </div>
        <Link
          href={`${prefix}/media-news`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {isZh ? "查看完整日报 →" : "Full brief →"}
        </Link>
      </div>

      <div className="px-6 py-4">
        {daily ? (
          <div className="space-y-3">
            <p className="font-medium text-gray-900 dark:text-white">
              {isZh ? daily.titleZh : daily.titleEn}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {isZh ? daily.summaryZh : daily.summaryEn}
            </p>
            {highlights.length > 0 && (
              <ul className="space-y-1">
                {highlights.slice(0, 3).map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
            <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {isZh
                  ? `${daily.sourceCount} 家信源`
                  : `${daily.sourceCount} sources`}
              </span>
              <span>·</span>
              <span>
                {isZh
                  ? daily.usedAi
                    ? "AI 汇总"
                    : "规则汇总"
                  : daily.usedAi
                    ? "AI synthesis"
                    : "Rule-based"}
              </span>
              {weekly && (
                <>
                  <span>·</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {isZh
                      ? `周报：${isZh ? weekly.titleZh : weekly.titleEn}`
                      : `Weekly: ${weekly.titleEn}`}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isZh
              ? "今日日报尚未生成，稍后自动更新。"
              : "Today's brief is not ready yet. It will update automatically."}
          </p>
        )}
      </div>
    </div>
  );
}
