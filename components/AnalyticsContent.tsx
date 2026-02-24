"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
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

interface AnalyticsContentProps {
  accounts: Account[];
}

export default function AnalyticsContent({ accounts }: AnalyticsContentProps) {
  const t = useTranslations("analytics");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<PostMetric[]>([]);
  const [totalFollowers, setTotalFollowers] = useState<number>(0);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/analytics/post-metrics?period=${timeRange}&accountId=${selectedAccount}`
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

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Calculate aggregate metrics
  const totalPosts = posts.length;
  const totalImpressions = posts.reduce((sum, p) => sum + p.impressions, 0);
  const totalEngagements = posts.reduce((sum, p) => sum + p.engagements, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.replies, 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Account Selector */}
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

          {/* Time Range Selector */}
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

      {/* Account Metrics */}
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

      {/* Post Performance */}
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
    </div>
  );
}

