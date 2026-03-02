"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonitorKeyword {
  id: string;
  keyword: string;
  type: string;
  createdAt: string;
}

interface MonitorTweet {
  id: string;
  tweetId: string;
  tweetUrl: string;
  authorUsername: string | null;
  authorName: string | null;
  text: string;
  tweetCreatedAt: string | null;
  impressions: number | null;
  likes: number | null;
  retweets: number | null;
  replies: number | null;
  source: string;
  sentiment: string | null;
  sentimentScore: number | null;
  keyTopics: string | null;
  analyzedAt: string | null;
  analysisMethod: string | null;
}

interface SummaryData {
  overview: {
    totalTweets: number;
    analyzed: number;
    positive: number;
    negative: number;
    neutral: number;
    avgScore: number;
  };
  trend: Array<{
    date: string;
    positive: number;
    negative: number;
    neutral: number;
    avgScore: number;
  }>;
  alerts: Array<{
    date: string;
    type: string;
    count: number;
    threshold: number;
  }>;
}

const SENTIMENT_COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#9ca3af",
};

const KEYWORD_TYPE_STYLES: Record<string, string> = {
  track:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  negative:
    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  competitor:
    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

export default function SentimentMonitor({
  campaignId,
}: {
  campaignId: string;
}) {
  const tc = useTranslations("campaigns");
  // Helper to access monitor.* keys
  const t = (key: string, values?: Record<string, string | number>) =>
    tc(`monitor.${key}` as Parameters<typeof tc>[0], values as never);
  const locale = useLocale();

  // State
  const [keywords, setKeywords] = useState<MonitorKeyword[]>([]);
  const [tweets, setTweets] = useState<MonitorTweet[]>([]);
  const [tweetTotal, setTweetTotal] = useState(0);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordType, setNewKeywordType] = useState("track");
  const [tweetUrls, setTweetUrls] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [addingTweets, setAddingTweets] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/monitor/keywords`
      );
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
      }
    } catch {
      /* ignore */
    }
  }, [campaignId]);

  const fetchTweets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (sentimentFilter !== "all") params.set("sentiment", sentimentFilter);
      const res = await fetch(
        `/api/campaigns/${campaignId}/monitor/tweets?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setTweets(data.tweets || []);
        setTweetTotal(data.total || 0);
      }
    } catch {
      /* ignore */
    }
  }, [campaignId, sentimentFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/monitor/summary`
      );
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch {
      /* ignore */
    }
  }, [campaignId]);

  useEffect(() => {
    fetchKeywords();
    fetchTweets();
    fetchSummary();
  }, [fetchKeywords, fetchTweets, fetchSummary]);

  // Refetch tweets when filter changes
  useEffect(() => {
    fetchTweets();
  }, [sentimentFilter, fetchTweets]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(""), 3000);
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    setAddingKeyword(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/monitor/keywords`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: newKeyword.trim(),
            type: newKeywordType,
          }),
        }
      );
      if (res.ok) {
        setNewKeyword("");
        fetchKeywords();
      } else {
        const data = await res.json().catch(() => ({}));
        showFeedback(data.error || "Failed to add keyword");
      }
    } catch {
      showFeedback("Failed to add keyword");
    } finally {
      setAddingKeyword(false);
    }
  };

  const handleDeleteKeyword = async (keywordId: string) => {
    try {
      await fetch(
        `/api/campaigns/${campaignId}/monitor/keywords?keywordId=${keywordId}`,
        { method: "DELETE" }
      );
      fetchKeywords();
    } catch {
      /* ignore */
    }
  };

  const handleAddTweets = async () => {
    const urls = tweetUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setAddingTweets(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/monitor/tweets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setTweetUrls("");
        showFeedback(
          `${t("tweetsAdded", { count: data.added })}${data.skipped > 0 ? ` · ${t("tweetsSkipped", { count: data.skipped })}` : ""}`
        );
        fetchTweets();
        fetchSummary();
      } else {
        const data = await res.json().catch(() => ({}));
        showFeedback(data.error || "Failed to add tweets");
      }
    } catch {
      showFeedback("Failed to add tweets");
    } finally {
      setAddingTweets(false);
    }
  };

  const handleScanTimeline = async () => {
    setScanning(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/monitor/tweets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "timeline_scan", limit: 50 }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        showFeedback(
          `${t("tweetsAdded", { count: data.added })} (${data.scanned} scanned)`
        );
        fetchTweets();
        fetchSummary();
      } else {
        const data = await res.json().catch(() => ({}));
        showFeedback(data.error || "Failed to scan timeline");
      }
    } catch {
      showFeedback("Failed to scan timeline");
    } finally {
      setScanning(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/monitor/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tweetIds: "all" }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const methodLabel =
          data.method === "ai" ? t("methodAi") : t("methodKeyword");
        showFeedback(`${t("analyzed", { count: data.analyzed })} (${methodLabel})`);
        fetchTweets();
        fetchSummary();
      } else {
        const data = await res.json().catch(() => ({}));
        showFeedback(data.error || "Analysis failed");
      }
    } catch {
      showFeedback("Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteTweet = async (tweetRecordId: string) => {
    try {
      await fetch(
        `/api/campaigns/${campaignId}/monitor/tweets?tweetId=${tweetRecordId}`,
        { method: "DELETE" }
      );
      fetchTweets();
      fetchSummary();
    } catch {
      /* ignore */
    }
  };

  const formatScore = (score: number) => {
    const sign = score > 0 ? "+" : "";
    return `${sign}${score.toFixed(2)}`;
  };

  const overview = summary?.overview;
  const pieData = overview
    ? [
        { name: t("positive"), value: overview.positive },
        { name: t("negative"), value: overview.negative },
        { name: t("neutral"), value: overview.neutral },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="mb-8">
      {/* Section Header */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        {t("title")}
      </h2>

      {/* Feedback message */}
      {feedbackMsg && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm">
          {feedbackMsg}
        </div>
      )}

      {/* 1. Keyword Management */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t("keywords")}
        </h3>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddKeyword();
              }
            }}
            placeholder={t("keywordPlaceholder")}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={newKeywordType}
            onChange={(e) => setNewKeywordType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="track">{t("typeTrack")}</option>
            <option value="negative">{t("typeNegative")}</option>
            <option value="competitor">{t("typeCompetitor")}</option>
          </select>
          <button
            onClick={handleAddKeyword}
            disabled={addingKeyword || !newKeyword.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {t("addKeyword")}
          </button>
        </div>

        {keywords.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t("noKeywords")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span
                key={kw.id}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${KEYWORD_TYPE_STYLES[kw.type] || KEYWORD_TYPE_STYLES.track}`}
              >
                {kw.keyword}
                <button
                  onClick={() => handleDeleteKeyword(kw.id)}
                  className="ml-0.5 hover:opacity-70"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 2. Tweet Collection */}
      <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {t("tweets")} ({tweetTotal})
        </h3>
        <textarea
          value={tweetUrls}
          onChange={(e) => setTweetUrls(e.target.value)}
          placeholder={t("tweetUrlPlaceholder")}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2 resize-none"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAddTweets}
            disabled={addingTweets || !tweetUrls.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {addingTweets ? t("addingTweets") : t("addTweets")}
          </button>
          <button
            onClick={handleScanTimeline}
            disabled={scanning || keywords.length === 0}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            {scanning ? t("scanning") : t("scanTimeline")}
          </button>
        </div>
      </div>

      {/* 3. Sentiment Overview (only when data exists) */}
      {overview && overview.analyzed > 0 && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            {t("overview")}
          </h3>

          {/* Alert banner */}
          {summary?.alerts && summary.alerts.length > 0 && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              {summary.alerts.map((alert, i) => (
                <p
                  key={i}
                  className="text-sm text-red-700 dark:text-red-300"
                >
                  {t("negativeSpikeAlert", {
                    date: alert.date,
                    count: alert.count,
                  })}
                </p>
              ))}
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("totalTweets")}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {overview.totalTweets}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("avgScore")}
              </p>
              <p
                className={`text-xl font-bold ${overview.avgScore > 0 ? "text-green-600" : overview.avgScore < 0 ? "text-red-600" : "text-gray-600"}`}
              >
                {formatScore(overview.avgScore)}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("positivePercent")}
              </p>
              <p className="text-xl font-bold text-green-600">
                {overview.analyzed > 0
                  ? Math.round((overview.positive / overview.analyzed) * 100)
                  : 0}
                %
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("alertCount")}
              </p>
              <p
                className={`text-xl font-bold ${(summary?.alerts?.length ?? 0) > 0 ? "text-red-600" : "text-gray-600 dark:text-gray-300"}`}
              >
                {summary?.alerts?.length ?? 0}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie chart */}
            {pieData.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {t("distributionChart")}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ""} ${(((percent ?? 0)) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            SENTIMENT_COLORS[
                              entry.name === t("positive")
                                ? "positive"
                                : entry.name === t("negative")
                                  ? "negative"
                                  : "neutral"
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trend line chart */}
            {summary?.trend && summary.trend.length > 1 && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {t("trendChart")}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={summary.trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="positive"
                      stroke={SENTIMENT_COLORS.positive}
                      strokeWidth={2}
                      dot={false}
                      name={t("positive")}
                    />
                    <Line
                      type="monotone"
                      dataKey="negative"
                      stroke={SENTIMENT_COLORS.negative}
                      strokeWidth={2}
                      dot={false}
                      name={t("negative")}
                    />
                    <Line
                      type="monotone"
                      dataKey="neutral"
                      stroke={SENTIMENT_COLORS.neutral}
                      strokeWidth={2}
                      dot={false}
                      name={t("neutral")}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Tweet List */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          {/* Filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {(["all", "positive", "negative", "neutral"] as const).map(
              (filter) => (
                <button
                  key={filter}
                  onClick={() => setSentimentFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    sentimentFilter === filter
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {filter === "all"
                    ? locale === "zh"
                      ? "全部"
                      : "All"
                    : t(filter)}
                </button>
              )
            )}
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={analyzing || tweetTotal === 0}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {analyzing ? t("analyzing") : t("analyzeAll")}
          </button>
        </div>

        {tweets.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
            {t("noTweets")}
          </p>
        ) : (
          <div className="space-y-3">
            {tweets.map((tweet) => {
              const topics: string[] = tweet.keyTopics
                ? (() => {
                    try {
                      return JSON.parse(tweet.keyTopics);
                    } catch {
                      return [];
                    }
                  })()
                : [];

              return (
                <div
                  key={tweet.id}
                  className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {/* Author + sentiment badge */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {tweet.authorUsername && (
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            @{tweet.authorUsername}
                          </span>
                        )}
                        {tweet.sentiment && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              tweet.sentiment === "positive"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : tweet.sentiment === "negative"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {t(tweet.sentiment as "positive" | "negative" | "neutral")}
                            {tweet.sentimentScore != null && (
                              <span className="ml-1">
                                {formatScore(tweet.sentimentScore)}
                              </span>
                            )}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {tweet.source === "manual"
                            ? t("sourceManual")
                            : t("sourceTimeline")}
                        </span>
                      </div>

                      {/* Tweet text */}
                      <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-3">
                        {tweet.text}
                      </p>

                      {/* Key topics */}
                      {topics.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {topics.map((topic, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Metrics */}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                        {tweet.impressions != null && (
                          <span>{tweet.impressions.toLocaleString()} views</span>
                        )}
                        {tweet.likes != null && tweet.likes > 0 && (
                          <span>{tweet.likes} likes</span>
                        )}
                        {tweet.retweets != null && tweet.retweets > 0 && (
                          <span>{tweet.retweets} RT</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={tweet.tweetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
                      >
                        {t("viewOnX")}
                      </a>
                      <button
                        onClick={() => handleDeleteTweet(tweet.id)}
                        className="text-xs text-red-500 hover:text-red-700 ml-2"
                      >
                        {t("deleteTweet")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
