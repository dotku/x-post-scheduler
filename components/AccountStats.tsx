"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

interface AccountStat {
  accountId: string;
  label: string | null;
  username: string | null;
  isDefault: boolean;
  followersCount: number | null;
  lastSyncedAt: string | null;
  posted: number;
  scheduled: number;
  failed: number;
  total: number;
  impressions: number;
}

interface StatsData {
  period: number;
  totals: {
    posted: number;
    scheduled: number;
    failed: number;
    total: number;
    views: number;
    impressions: number;
  };
  accounts: AccountStat[];
}

interface DailyPoint {
  date: string;
  impressions: number;
}

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

function formatXTick(dateStr: string, period: Period): string {
  const d = new Date(dateStr + "T00:00:00");
  if (period === 7) return `${d.getMonth() + 1}/${d.getDate()}`;
  // For 30/90, only show every nth label to avoid crowding
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AccountStats() {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<StatsData | null>(null);
  const [chartData, setChartData] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [syncingFollowers, setSyncingFollowers] = useState(false);
  const [followerSyncMsg, setFollowerSyncMsg] = useState("");

  const fetchStats = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/analytics/account-stats?period=${period}`).then((r) =>
        r.json(),
      ),
      fetch(`/api/analytics/impressions-daily?period=${period}`).then((r) =>
        r.json(),
      ),
    ])
      .then(([stats, daily]) => {
        setData(stats);
        setChartData(daily.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch(
        `/api/analytics/sync-tweet-metrics?period=${period}`,
        { method: "POST" },
      );
      const d = await res.json();
      if (res.ok) {
        setSyncMsg(
          t("syncDone", {
            synced: d.synced,
            impressions: d.totalImpressions.toLocaleString(),
          }),
        );
        fetchStats();
        router.refresh();
      } else {
        setSyncMsg(t("syncFailed"));
      }
    } catch {
      setSyncMsg(t("syncFailed"));
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncFollowers = async () => {
    setSyncingFollowers(true);
    setFollowerSyncMsg("");
    try {
      const res = await fetch("/api/analytics/sync-followers", {
        method: "POST",
      });
      const d = await res.json();
      if (res.ok) {
        setFollowerSyncMsg(
          t("followersSynced", {
            synced: d.synced,
            total: d.totalFollowers.toLocaleString(),
          }),
        );
        fetchStats();
        router.refresh();
      } else {
        setFollowerSyncMsg(t("syncFailed"));
      }
    } catch {
      setFollowerSyncMsg(t("syncFailed"));
    } finally {
      setSyncingFollowers(false);
    }
  };

  // Determine tick interval so X-axis isn't too crowded
  const tickInterval = period === 7 ? 0 : period === 30 ? 4 : 14;

  const hasImpressionsData = chartData.some((d) => d.impressions > 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t("statsTitle")}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  period === p
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {p}
                {t("days")}
              </button>
            ))}
          </div>
          <button
            onClick={handleSyncFollowers}
            disabled={syncingFollowers}
            title={t("syncFollowersTooltip")}
            className="px-3 py-1 text-sm rounded border border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 transition-colors"
          >
            {syncingFollowers
              ? "⟳ " + t("syncing")
              : "👥 " + t("syncFollowers")}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            title={t("syncTooltip")}
            className="px-3 py-1 text-sm rounded border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
          >
            {syncing ? "⟳ " + t("syncing") : "↻ " + t("syncViews")}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="px-6 py-2 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
          {syncMsg}
        </div>
      )}

      {followerSyncMsg && (
        <div className="px-6 py-2 text-sm text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
          {followerSyncMsg}
        </div>
      )}

      {loading ? (
        <div className="px-6 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t("loadingStats")}
        </div>
      ) : !data ? (
        <div className="px-6 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
          {t("statsUnavailable")}
        </div>
      ) : (
        <div className="p-6 space-y-4">
          {/* Totals row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {(data.totals.impressions ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("statsImpressions")}
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {(data.totals.views ?? 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("statsViews")}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data.totals.total}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("statsTotalPosts")}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                {data.totals.posted}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("posted")}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                {data.totals.failed}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t("failed")}
              </p>
            </div>
          </div>

          {/* Daily impressions line chart */}
          {hasImpressionsData && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                {t("impressionsChart")}
              </p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(156,163,175,0.3)"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatXTick(v, period)}
                      interval={tickInterval}
                      tick={{ fontSize: 11, fill: "rgb(156,163,175)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "rgb(156,163,175)" }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickFormatter={(v: number) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}m`
                          : v >= 1000
                            ? `${(v / 1000).toFixed(0)}k`
                            : String(v)
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgb(31,41,55)",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "rgb(209,213,219)",
                      }}
                      labelStyle={{
                        color: "rgb(156,163,175)",
                        marginBottom: "4px",
                      }}
                      formatter={(value: number) => [
                        value.toLocaleString(),
                        t("statsImpressions"),
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      stroke="rgb(59,130,246)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "rgb(59,130,246)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-account breakdown */}
          {data.accounts.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                {t("statsByAccount")}
              </p>
              <div className="space-y-2">
                {data.accounts.map((acc) => (
                  <div
                    key={acc.accountId}
                    className="flex items-center gap-3 text-sm"
                  >
                    <div className="w-32 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {acc.label || acc.username || t("unknownAccount")}
                      </p>
                      {acc.username && acc.label && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          @{acc.username}
                        </p>
                      )}
                      {acc.followersCount !== null && (
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          👥 {acc.followersCount.toLocaleString()}{" "}
                          {t("statsFollowers")}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      {data.totals.total > 0 ? (
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{
                              width: `${Math.round((acc.total / data.totals.total) * 100)}%`,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {acc.impressions > 0 && (
                        <span className="text-blue-600 dark:text-blue-400">
                          👁 {acc.impressions.toLocaleString()}
                        </span>
                      )}
                      <span className="text-green-600 dark:text-green-400">
                        {acc.posted} ✓
                      </span>
                      {acc.scheduled > 0 && (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          {acc.scheduled} ⏱
                        </span>
                      )}
                      {acc.failed > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          {acc.failed} ✕
                        </span>
                      )}
                      <span className="font-medium text-gray-700 dark:text-gray-300 w-8 text-right">
                        {acc.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
