import type { Metadata } from "next";
import {
  fetchDailyMediaTechNews,
  getLatestStoredMediaIndustryReport,
  listStoredMediaIndustryReports,
} from "@/lib/media-news";
import IntelligencePage from "@/components/intelligence/IntelligencePage";

export const metadata: Metadata = {
  title: "Intelligence | 情报中心 | xPilot",
  description:
    "Media industry daily briefing and social sentiment monitoring. 传媒行业日报与舆情监控一站式平台。",
};

export const revalidate = 1800; // revalidate every 30 minutes

export default async function MediaNewsPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;

  const [latest, latestWeekly, dailyArchiveRaw] = await Promise.all([
    fetchDailyMediaTechNews(),
    getLatestStoredMediaIndustryReport("weekly"),
    listStoredMediaIndustryReports("daily", 14),
  ]);

  const dailyArchive = dailyArchiveRaw.filter(
    (item) => item.date !== latest?.date,
  );

  return (
    <IntelligencePage
      locale={locale || "en"}
      newsData={{ latest, latestWeekly, dailyArchive }}
    />
  );
}
