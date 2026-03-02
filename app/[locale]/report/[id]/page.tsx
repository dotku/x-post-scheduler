import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; locale?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const snapshot = await prisma.topicSnapshot.findUnique({
    where: { publicId: id },
    include: { topic: { select: { name: true, nameZh: true } } },
  });
  if (!snapshot) return { title: "Report Not Found | xPilot" };
  return {
    title: `${snapshot.topic.name} - Sentiment Report | xPilot`,
    description: snapshot.aiSummary?.slice(0, 160) || "Sentiment analysis report powered by xPilot.",
  };
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "text-green-600 dark:text-green-400",
  negative: "text-red-600 dark:text-red-400",
  neutral: "text-gray-600 dark:text-gray-400",
};

const SENTIMENT_BG: Record<string, string> = {
  positive: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  negative: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  neutral: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
};

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ id: string; locale?: string }>;
}) {
  const { id, locale } = await params;
  const isZh = locale === "zh";

  const snapshot = await prisma.topicSnapshot.findUnique({
    where: { publicId: id },
    include: { topic: { select: { name: true, nameZh: true, description: true, keywords: true } } },
  });

  if (!snapshot) notFound();

  const themes: string[] = snapshot.themes ? JSON.parse(snapshot.themes) : [];
  const topTweets: Array<{
    id: string;
    text: string;
    authorUsername: string;
    sentiment: string;
    likeCount?: number;
    retweetCount?: number;
  }> = snapshot.topTweets ? JSON.parse(snapshot.topTweets) : [];
  const keywords: string[] = JSON.parse(snapshot.topic.keywords);
  const sentimentLabel = isZh ? ["正面", "中立", "负面"] : ["Positive", "Neutral", "Negative"];
  const topicName = isZh && snapshot.topic.nameZh ? snapshot.topic.nameZh : snapshot.topic.name;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              {isZh ? "舆情报告" : "Sentiment Report"}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(snapshot.createdAt).toLocaleDateString(isZh ? "zh-CN" : "en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {topicName}
          </h1>
          {snapshot.topic.description && (
            <p className="mt-1.5 text-gray-500 dark:text-gray-400 text-sm">
              {snapshot.topic.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {snapshot.tweetCount}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {isZh ? "推文数量" : "Tweets Analyzed"}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className={`text-2xl font-bold ${SENTIMENT_COLORS.positive}`}>
              {snapshot.positiveCount}%
            </div>
            <div className="text-xs text-gray-500 mt-1">{sentimentLabel[0]}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className={`text-2xl font-bold ${SENTIMENT_COLORS.neutral}`}>
              {snapshot.neutralCount}%
            </div>
            <div className="text-xs text-gray-500 mt-1">{sentimentLabel[1]}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-center">
            <div className={`text-2xl font-bold ${SENTIMENT_COLORS.negative}`}>
              {snapshot.negativeCount}%
            </div>
            <div className="text-xs text-gray-500 mt-1">{sentimentLabel[2]}</div>
          </div>
        </div>

        {/* Sentiment bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {isZh ? "情感分布" : "Sentiment Distribution"}
          </h2>
          <div className="flex h-4 w-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            <div className="bg-green-500" style={{ width: `${snapshot.positiveCount}%` }} />
            <div className="bg-gray-400" style={{ width: `${snapshot.neutralCount}%` }} />
            <div className="bg-red-500" style={{ width: `${snapshot.negativeCount}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span className="text-green-600">{sentimentLabel[0]} {snapshot.positiveCount}%</span>
            <span className="text-gray-500">{sentimentLabel[1]} {snapshot.neutralCount}%</span>
            <span className="text-red-600">{sentimentLabel[2]} {snapshot.negativeCount}%</span>
          </div>
        </div>

        {/* Themes */}
        {themes.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "热门主题" : "Key Themes"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme) => (
                <span
                  key={theme}
                  className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI Summary */}
        {snapshot.aiSummary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "AI 分析摘要" : "AI Analysis Summary"}
            </h2>
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {snapshot.aiSummary}
            </div>
          </div>
        )}

        {/* Top Tweets */}
        {topTweets.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "代表性推文" : "Notable Tweets"}
            </h2>
            <div className="space-y-3">
              {topTweets.map((tweet) => (
                <div
                  key={tweet.id}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      @{tweet.authorUsername}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium ${SENTIMENT_BG[tweet.sentiment] || SENTIMENT_BG.neutral}`}
                    >
                      {tweet.sentiment === "positive"
                        ? sentimentLabel[0]
                        : tweet.sentiment === "negative"
                          ? sentimentLabel[2]
                          : sentimentLabel[1]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {tweet.text}
                  </p>
                  {(tweet.likeCount || tweet.retweetCount) && (
                    <div className="mt-1 text-xs text-gray-400">
                      {tweet.likeCount ? `❤️ ${tweet.likeCount}` : ""}{" "}
                      {tweet.retweetCount ? `🔁 ${tweet.retweetCount}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-400">
            {isZh ? "由" : "Powered by"}{" "}
            <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
              xPilot
            </Link>{" "}
            {isZh ? "生成" : ""} ·{" "}
            {new Date(snapshot.createdAt).toLocaleString(isZh ? "zh-CN" : "en-US")}
            {snapshot.modelId && ` · ${snapshot.modelId}`}
          </div>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isZh ? "了解 xPilot 舆情监控" : "Try xPilot Sentiment Monitor"}
          </Link>
        </div>
      </div>
    </div>
  );
}
