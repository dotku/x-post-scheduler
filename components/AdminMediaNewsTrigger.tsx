"use client";

import { useState } from "react";

type Period = "daily" | "weekly";

type TriggerResult = {
  success: boolean;
  period?: string;
  date?: string;
  sourceCount?: number;
  usedAi?: boolean;
  title?: string;
  error?: string;
};

type BackfillEntry = {
  date: string;
  status: "pending" | "running" | "done" | "error";
  result?: TriggerResult;
};

function getPastDates(n: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates; // newest first
}

export default function AdminMediaNewsTrigger() {
  const [loadingPeriod, setLoadingPeriod] = useState<Period | null>(null);
  const [result, setResult] = useState<TriggerResult | null>(null);

  // Backfill state
  const [backfillEntries, setBackfillEntries] = useState<BackfillEntry[]>([]);
  const [isBackfilling, setIsBackfilling] = useState(false);

  // Clear archive state
  const [clearingPeriod, setClearingPeriod] = useState<Period | null>(null);
  const [clearResult, setClearResult] = useState<{ period: string; deleted: number } | { error: string } | null>(null);

  async function trigger(period: Period, date?: string) {
    setLoadingPeriod(period);
    setResult(null);
    try {
      const url = date
        ? `/api/admin/trigger-media-news?period=${period}&date=${date}`
        : `/api/admin/trigger-media-news?period=${period}`;
      const res = await fetch(url, { method: "POST" });
      const data = (await res.json()) as TriggerResult;
      setResult(data);
    } catch {
      setResult({ success: false, error: "Network error" });
    } finally {
      setLoadingPeriod(null);
    }
  }

  async function clearArchive(period: Period) {
    setClearingPeriod(period);
    setClearResult(null);
    try {
      const res = await fetch(`/api/admin/clear-media-news?period=${period}`, { method: "POST" });
      const data = (await res.json()) as { success: boolean; deleted?: number; error?: string };
      if (data.success) {
        setClearResult({ period, deleted: data.deleted ?? 0 });
      } else {
        setClearResult({ error: data.error ?? "Unknown error" });
      }
    } catch {
      setClearResult({ error: "Network error" });
    } finally {
      setClearingPeriod(null);
    }
  }

  async function startBackfill(days: number) {
    if (isBackfilling) return;
    const dates = getPastDates(days);
    const entries: BackfillEntry[] = dates.map((date) => ({
      date,
      status: "pending",
    }));
    setBackfillEntries(entries);
    setIsBackfilling(true);

    for (let i = 0; i < entries.length; i++) {
      // Mark this one as running
      setBackfillEntries((prev) =>
        prev.map((e, idx) => (idx === i ? { ...e, status: "running" } : e)),
      );

      try {
        const res = await fetch(
          `/api/admin/trigger-media-news?period=daily&date=${entries[i].date}`,
          { method: "POST" },
        );
        const data = (await res.json()) as TriggerResult;
        setBackfillEntries((prev) =>
          prev.map((e, idx) =>
            idx === i ? { ...e, status: "done", result: data } : e,
          ),
        );
      } catch {
        setBackfillEntries((prev) =>
          prev.map((e, idx) =>
            idx === i
              ? { ...e, status: "error", result: { success: false, error: "Network error" } }
              : e,
          ),
        );
      }
    }

    setIsBackfilling(false);
  }

  const doneCount = backfillEntries.filter((e) => e.status === "done" || e.status === "error").length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      {/* ── Single-trigger section ── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          传媒行业日报 · 手动触发
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          生产环境每天 01:15 UTC 自动运行。点击下方按钮可立即触发生成，适合首次初始化或补跑。
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => trigger("daily")}
            disabled={loadingPeriod !== null || isBackfilling}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPeriod === "daily" ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                生成中…
              </>
            ) : (
              "触发今日日报"
            )}
          </button>

          <button
            onClick={() => trigger("weekly")}
            disabled={loadingPeriod !== null || isBackfilling}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPeriod === "weekly" ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                生成中…
              </>
            ) : (
              "触发本周周报"
            )}
          </button>
        </div>

        {result && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              result.success
                ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20 text-green-800 dark:text-green-300"
                : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 text-red-800 dark:text-red-300"
            }`}
          >
            {result.success ? (
              <div className="space-y-0.5">
                <p className="font-medium">✓ 生成成功</p>
                <p>
                  日期：{result.date} · 信源：{result.sourceCount} 家 ·{" "}
                  {result.usedAi ? "AI 汇总" : "规则汇总"}
                </p>
                {result.title && (
                  <p className="text-gray-600 dark:text-gray-400">{result.title}</p>
                )}
              </div>
            ) : (
              <p>✗ {result.error}</p>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          自动调度：每天 01:15 UTC（日报）· 每周一 01:20 UTC（周报）via Cloudflare Worker
        </p>
      </div>

      {/* ── Clear archive section ── */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          清空存档
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          删除数据库中所有旧的日报/周报记录（不可恢复）。清空后再用下方"补跑历史日报"按钮重新生成新内容。
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          {(["daily", "weekly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                if (confirm(`确认清空所有${p === "daily" ? "日报" : "周报"}记录？此操作不可恢复。`)) {
                  void clearArchive(p);
                }
              }}
              disabled={clearingPeriod !== null || isBackfilling || loadingPeriod !== null}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingPeriod === p ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  清空中…
                </>
              ) : (
                `清空所有${p === "daily" ? "日报" : "周报"}`
              )}
            </button>
          ))}
        </div>

        {clearResult && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${"error" in clearResult
            ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 text-red-800 dark:text-red-300"
            : "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20 text-green-800 dark:text-green-300"
          }`}>
            {"error" in clearResult
              ? `✗ ${clearResult.error}`
              : `✓ 已删除 ${clearResult.deleted} 条${clearResult.period === "daily" ? "日报" : "周报"}记录`}
          </div>
        )}
      </div>

      {/* ── Backfill section ── */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          补跑历史日报
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          历史存档中的内容是用旧代码生成的，标题可能相同。点击下方按钮可以用最新代码重新生成，覆盖数据库中的旧记录。每天约需 10–20 秒。
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          {[7, 14].map((days) => (
            <button
              key={days}
              onClick={() => startBackfill(days)}
              disabled={isBackfilling || loadingPeriod !== null}
              className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBackfilling && backfillEntries.length === days ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  {doneCount}/{days} 完成…
                </>
              ) : (
                `重新生成近 ${days} 天`
              )}
            </button>
          ))}
        </div>

        {backfillEntries.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    日期
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    状态
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                    标题
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {backfillEntries.map((entry) => (
                  <tr
                    key={entry.date}
                    className="bg-white dark:bg-gray-800"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-300">
                      {entry.date}
                    </td>
                    <td className="px-3 py-2">
                      {entry.status === "pending" && (
                        <span className="text-gray-400">等待中</span>
                      )}
                      {entry.status === "running" && (
                        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                          <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                          生成中
                        </span>
                      )}
                      {entry.status === "done" && entry.result?.success && (
                        <span className="text-green-600 dark:text-green-400">
                          ✓ {entry.result.sourceCount} 篇
                        </span>
                      )}
                      {(entry.status === "error" ||
                        (entry.status === "done" && !entry.result?.success)) && (
                        <span className="text-red-600 dark:text-red-400 text-xs">
                          ✗ {entry.result?.error ?? "失败"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hidden sm:table-cell max-w-xs truncate">
                      {entry.result?.title ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
