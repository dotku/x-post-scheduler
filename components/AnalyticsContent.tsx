"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import AnalyticsMetrics from "./AnalyticsMetrics";
import PostPerformanceTable from "./PostPerformanceTable";

interface Account {
  id: string;
  label: string | null;
  username: string | null;
  isDefault: boolean;
}

interface PostMetric {
  id: string;
  content: string;
  tweetId: string | null;
  postedAt: Date | null;
  impressions: number;
  likes: number;
  replies: number;
  engagements: number;
  engagementRate: number;
  account: {
    label: string | null;
    username: string | null;
  } | null;
}

interface GrowthData {
  period: number;
  followerSnapshots: Array<{
    followersCount: number;
    followingCount: number;
    tweetCount: number | null;
    recordedAt: string;
    xAccountId: string | null;
  }>;
  dailyData: Array<{
    date: string;
    impressions: number;
    posts: number;
  }>;
  topPosts: Array<{
    id: string;
    content: string;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    postedAt: string;
    engagements: number;
    engagementRate: number;
  }>;
  summary: {
    totalPosts: number;
    totalImpressions: number;
    totalEngagements: number;
    avgEngagementRate: number;
  };
}

interface ContentProfileData {
  profile: string | null;
  updatedAt: string | null;
  postCount?: number;
  topPostCount?: number;
}

interface AnalyticsContentProps {
  accounts: Account[];
}

export default function AnalyticsContent({ accounts }: AnalyticsContentProps) {
  const t = useTranslations("analytics");
  const [activeTab, setActiveTab] = useState<"posts" | "growth">("posts");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<number>(30);

  // Post performance state
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostMetric[]>([]);
  const [totalFollowers, setTotalFollowers] = useState<number>(0);

  // Growth state
  const [growthData, setGrowthData] = useState<GrowthData | null>(null);
  const [growthLoading, setGrowthLoading] = useState(false);

  // Content profile state
  const [profile, setProfile] = useState<ContentProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileGenerating, setProfileGenerating] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/post-metrics?period=${timeRange}&accountId=${selectedAccount}`,
      );
      const data = await response.json();
      setPosts(data.posts || []);
      setTotalFollowers(data.totalFollowers || 0);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setPosts([]);
      setTotalFollowers(0);
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedAccount]);

  const fetchGrowth = useCallback(async () => {
    setGrowthLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/growth?period=${timeRange}`,
      );
      if (response.ok) {
        const data = await response.json();
        setGrowthData(data);
      }
    } catch (error) {
      console.error("Failed to fetch growth:", error);
    } finally {
      setGrowthLoading(false);
    }
  }, [timeRange]);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const response = await fetch("/api/analytics/content-profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const generateProfile = async () => {
    setProfileGenerating(true);
    try {
      const response = await fetch("/api/analytics/content-profile", {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error("Failed to generate profile:", error);
    } finally {
      setProfileGenerating(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    if (activeTab === "growth") {
      fetchGrowth();
    }
  }, [activeTab, fetchGrowth]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Derived metrics
  const totalPosts = posts.length;
  const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
  const totalEngagements = posts.reduce((sum, p) => sum + p.engagements, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.replies, 0);

  // Chart formatters
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("selectAccount")}
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t("allAccounts")}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label || account.username || account.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("timeRange")}
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={7}>{t("last7Days")}</option>
              <option value={30}>{t("last30Days")}</option>
              <option value={90}>{t("last90Days")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("posts")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "posts"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {t("postPerfTab")}
        </button>
        <button
          onClick={() => setActiveTab("growth")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "growth"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {t("growthTab")}
        </button>
      </div>

      {/* Post Performance Tab */}
      {activeTab === "posts" && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t("accountMetrics")}
            </h2>
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {t("loading")}
              </div>
            ) : (
              <AnalyticsMetrics
                totalFollowers={totalFollowers}
                totalPosts={totalPosts}
                totalImpressions={totalImpressions}
                totalEngagements={totalEngagements}
                totalComments={totalComments}
              />
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("postPerformance")}
              </h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {t("loading")}
                </div>
              ) : (
                <PostPerformanceTable posts={posts} />
              )}
            </div>
          </div>
        </>
      )}

      {/* Growth & Engagement Tab */}
      {activeTab === "growth" && (
        <>
          {growthLoading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t("loading")}
            </div>
          ) : growthData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: t("totalPosts"),
                    value: growthData.summary.totalPosts,
                    color: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
                  },
                  {
                    label: t("totalImpressions"),
                    value: formatNumber(growthData.summary.totalImpressions),
                    color: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300",
                  },
                  {
                    label: t("totalEngagements"),
                    value: formatNumber(growthData.summary.totalEngagements),
                    color: "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300",
                  },
                  {
                    label: t("avgEngagementRate"),
                    value: `${(growthData.summary.avgEngagementRate ?? 0).toFixed(2)}%`,
                    color: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className={`rounded-lg p-4 ${card.color}`}
                  >
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-sm opacity-80">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Follower Growth Chart */}
              {growthData.followerSnapshots.length > 1 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t("followerGrowth")}
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={growthData.followerSnapshots.map((s) => ({
                        date: s.recordedAt,
                        followers: s.followersCount,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 12, fill: "#9CA3AF" }}
                      />
                      <YAxis
                        tickFormatter={formatNumber}
                        tick={{ fontSize: 12, fill: "#9CA3AF" }}
                      />
                      <Tooltip
                        labelFormatter={(v) =>
                          new Date(v as string).toLocaleDateString()
                        }
                        contentStyle={{
                          backgroundColor: "rgb(31,41,55)",
                          border: "none",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="followers"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Engagement Trend Chart */}
              {growthData.dailyData.length > 1 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t("engagementTrend")}
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={growthData.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        tick={{ fontSize: 12, fill: "#9CA3AF" }}
                      />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={formatNumber}
                        tick={{ fontSize: 12, fill: "#9CA3AF" }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12, fill: "#9CA3AF" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgb(31,41,55)",
                          border: "none",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="impressions"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        name={t("impressions")}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="posts"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        name={t("totalPosts")}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Posts by Engagement */}
              {growthData.topPosts.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {t("topPostsByEngagement")}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {t("post")}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {t("impressions")}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {t("likes")}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {t("retweets")}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {t("engagementRate")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {growthData.topPosts.map((post) => (
                          <tr
                            key={post.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="px-4 py-3 max-w-xs">
                              <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                                {post.content}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                              {(post.impressions ?? 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                              {(post.likes ?? 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                              {(post.retweets ?? 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-medium text-green-600 dark:text-green-400">
                              {(post.engagementRate ?? 0).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t("noData")}
            </div>
          )}
        </>
      )}

      {/* Content Profile Card (always visible) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("contentProfile")}
          </h2>
          {profile?.profile && (
            <button
              onClick={generateProfile}
              disabled={profileGenerating}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
            >
              {profileGenerating ? t("generatingProfile") : t("refreshProfile")}
            </button>
          )}
        </div>
        {profileLoading ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            {t("loading")}
          </div>
        ) : profile?.profile ? (
          <div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {profile.profile}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              {profile.updatedAt && (
                <span>
                  {t("profileLastUpdated", {
                    date: new Date(profile.updatedAt).toLocaleDateString(),
                  })}
                </span>
              )}
              {profile.topPostCount != null && profile.postCount != null && (
                <span>
                  {t("profileAnalyzedPosts", {
                    top: profile.topPostCount,
                    total: profile.postCount,
                  })}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t("profileEmpty")}
            </p>
            <button
              onClick={generateProfile}
              disabled={profileGenerating}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {profileGenerating
                ? t("generatingProfile")
                : t("generateProfile")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
