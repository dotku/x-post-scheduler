import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReportByDate, listStoredMediaIndustryReports } from "@/lib/media-news";

export const revalidate = 1800;

type Props = {
  params: Promise<{ locale?: string; date: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, date } = await params;
  const isZh = locale === "zh";
  const report = await getReportByDate(date, "daily");
  if (!report) return {};

  const title = isZh
    ? `${report.titleZh} | 传媒行业日报 | xPilot`
    : `${report.titleEn} | Media Industry Daily | xPilot`;
  const description = isZh
    ? report.summaryZh.slice(0, 160)
    : report.summaryEn.slice(0, 160);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(report.coverImageUrl ? { images: [report.coverImageUrl] } : {}),
    },
    alternates: {
      canonical: `/${isZh ? "zh" : "en"}/media-news/${date}`,
      languages: {
        "zh-CN": `/zh/media-news/${date}`,
        "en-US": `/en/media-news/${date}`,
      },
    },
  };
}

export async function generateStaticParams() {
  const reports = await listStoredMediaIndustryReports("daily", 30);
  return reports.map((r) => ({ date: r.date }));
}

export default async function MediaNewsReportPage({ params }: Props) {
  const { locale, date } = await params;
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const report = await getReportByDate(date, "daily");
  if (!report) notFound();

  const highlights = isZh ? report.highlightsZh : report.highlightsEn;
  const title = isZh ? report.titleZh : report.titleEn;
  const summary = isZh ? report.summaryZh : report.summaryEn;

  const contextPrefix = isZh ? "【社会影响】" : "【Society】";
  const industryHighlights = highlights.filter((h) => !h.startsWith(contextPrefix));
  const contextHighlights = highlights
    .filter((h) => h.startsWith(contextPrefix))
    .map((h) => h.slice(contextPrefix.length).trim());

  const formattedDate = (() => {
    try {
      const d = new Date(`${date}T00:00:00.000Z`);
      return isZh
        ? d.toLocaleDateString("zh-CN", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric", weekday: "long" })
        : d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch {
      return date;
    }
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href={prefix || "/"} className="hover:text-gray-700 dark:hover:text-gray-200">
            {isZh ? "首页" : "Home"}
          </Link>
          <span>/</span>
          <Link href={`${prefix}/media-news`} className="hover:text-gray-700 dark:hover:text-gray-200">
            {isZh ? "传媒行业日报" : "Media Industry Daily"}
          </Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300 font-mono">{date}</span>
        </nav>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {/* Cover */}
          {report.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.coverImageUrl}
              alt={title}
              className="h-48 sm:h-64 w-full object-cover"
            />
          ) : (
            <div className="h-48 sm:h-64 w-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white/80 text-4xl font-bold tracking-tight select-none">
                {isZh ? "传媒日报" : "Media Daily"}
              </span>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            {/* Meta */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-2">
                {isZh ? "传媒行业日报" : "Media Industry Daily"}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-snug">
                {title}
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {formattedDate}
                <span className="mx-2">·</span>
                {isZh
                  ? `${report.sourceCount} 家信源 · ${report.usedAi ? "AI 汇总" : "规则汇总"}`
                  : `${report.sourceCount} sources · ${report.usedAi ? "AI synthesis" : "Rule-based"}`}
              </p>
            </div>

            {/* Bilingual summary */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">中文摘要</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{report.summaryZh}</p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">English Brief</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{report.summaryEn}</p>
              </div>
            </div>

            {/* Industry Highlights */}
            {industryHighlights.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
                  {isZh ? "传媒行业动态" : "Industry News"}
                </p>
                <ol className="space-y-3">
                  {industryHighlights.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Context / Social Highlights */}
            {contextHighlights.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-3">
                  {isZh ? "社会影响与行业背景" : "Social Impact & Context"}
                </p>
                <ol className="space-y-3">
                  {contextHighlights.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Both-language highlights if viewing one */}
            {highlights === report.highlightsZh && report.highlightsEn.length > 0 && (
              <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <summary className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                  English Highlights
                </summary>
                <ol className="space-y-2 px-4 pb-4">
                  {report.highlightsEn.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      {item.replace(/^【Society】/, "").trim()}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {highlights === report.highlightsEn && report.highlightsZh.length > 0 && (
              <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <summary className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200">
                  中文要点
                </summary>
                <ol className="space-y-2 px-4 pb-4">
                  {report.highlightsZh.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      {item.replace(/^【社会影响】/, "").trim()}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </article>

        {/* Back link */}
        <div className="mt-6">
          <Link
            href={`${prefix}/media-news`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← {isZh ? "返回传媒行业日报" : "Back to Media Industry Daily"}
          </Link>
        </div>
      </div>
    </div>
  );
}
