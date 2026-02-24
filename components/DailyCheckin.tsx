"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

interface CheckinState {
  streak: number;
  longestStreak: number;
  creditBalanceCents: number;
  alreadyClaimed?: boolean;
  rewarded?: boolean;
  milestoneAt5?: boolean;
  milestoneAt30?: boolean;
  streakReset?: boolean; // true when streak was broken and reset to 1 today
}

interface DailyCheckinProps {
  /** Compact mode: fits inside a dropdown (w-52) */
  compact?: boolean;
}

export default function DailyCheckin({ compact = false }: DailyCheckinProps) {
  const locale = useLocale();
  const zh = locale === "zh";

  const [state, setState] = useState<CheckinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [fillLoading, setFillLoading] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);
  const [showMilestone, setShowMilestone] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/daily-checkin", { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) return;
        setState(data);
        if (data.milestoneAt5) {
          setShowMilestone(zh ? "连续登入 5 天！赠送一周木头会员 🎉" : "5-day streak! Wood membership for 1 week 🎉");
        } else if (data.milestoneAt30) {
          setShowMilestone(zh ? "连续登入 30 天！赠送一个月青铜会员 🎉" : "30-day streak! Bronze membership for 1 month 🎉");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFillGap() {
    setFillLoading(true);
    setFillError(null);
    try {
      const res = await fetch("/api/me/streak/fill", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setFillError(data.error || (zh ? "补全失败" : "Fill failed"));
      } else {
        setState((prev) =>
          prev
            ? {
                ...prev,
                streak: data.streak,
                longestStreak: data.longestStreak,
                creditBalanceCents: data.creditBalanceCents,
                streakReset: false,
              }
            : null,
        );
        if (data.milestoneAt5) {
          setShowMilestone(zh ? "连续登入 5 天！赠送一周木头会员 🎉" : "5-day streak! Wood membership for 1 week 🎉");
        } else if (data.milestoneAt30) {
          setShowMilestone(zh ? "连续登入 30 天！赠送一个月青铜会员 🎉" : "30-day streak! Bronze membership for 1 month 🎉");
        }
      }
    } catch {
      setFillError(zh ? "网络错误" : "Network error");
    } finally {
      setFillLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-2 animate-pulse">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </div>
    );
  }

  if (!state) return null;

  const streak = state.streak;
  // Next milestone: 5 or 30
  const nextMilestone = streak < 5 ? 5 : streak < 30 ? 30 : null;
  const progressPct = nextMilestone
    ? Math.min(100, Math.round((streak / nextMilestone) * 100))
    : 100;

  if (compact) {
    return (
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 space-y-1.5">
        {showMilestone && (
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
            {showMilestone}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            🔥 {streak} {zh ? "天连续登入" : "day streak"}
          </span>
          {state.alreadyClaimed ? (
            <span className="text-xs text-gray-400">{zh ? "已领取" : "Claimed"} ✓</span>
          ) : (
            <span className="text-xs text-green-600 dark:text-green-400">+$0.10</span>
          )}
        </div>

        {nextMilestone && (
          <div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className="bg-orange-400 h-1 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {zh
                ? `距${nextMilestone}天奖励还差 ${nextMilestone - streak} 天`
                : `${nextMilestone - streak} more days to ${nextMilestone}-day reward`}
            </p>
          </div>
        )}

        {state.streakReset && (
          <div>
            {fillError && (
              <p className="text-[10px] text-red-500">{fillError}</p>
            )}
            <button
              type="button"
              onClick={handleFillGap}
              disabled={fillLoading}
              className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50"
            >
              {fillLoading
                ? zh ? "补全中..." : "Filling..."
                : zh ? "💸 $0.20 补全连续登入" : "💸 $0.20 to restore streak"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Full / standalone mode
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      {showMilestone && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            {showMilestone}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            🔥 {streak}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {zh ? "天连续登入" : "day streak"} ·{" "}
            {zh ? `最长 ${state.longestStreak} 天` : `best: ${state.longestStreak}`}
          </p>
        </div>
        <div className="text-right">
          {state.alreadyClaimed ? (
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400">
              {zh ? "今日已领取 ✓" : "Claimed today ✓"}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-xs text-green-700 dark:text-green-400 font-semibold">
              +$0.10 {zh ? "已到账" : "rewarded"}
            </span>
          )}
        </div>
      </div>

      {nextMilestone && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{streak}</span>
            <span>
              {zh
                ? `${nextMilestone} 天 → ${nextMilestone === 5 ? "木头会员 1周" : "青铜会员 1月"}`
                : `${nextMilestone} days → ${nextMilestone === 5 ? "Wood 1 week" : "Bronze 1 month"}`}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-orange-400 h-2 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {state.streakReset && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
            {zh ? "连续记录已中断！" : "Streak broken!"}{" "}
            {zh
              ? "花 $0.20 补全昨日登入以恢复连续。"
              : "Spend $0.20 to restore yesterday's login and keep your streak."}
          </p>
          {fillError && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-1">{fillError}</p>
          )}
          <button
            type="button"
            onClick={handleFillGap}
            disabled={fillLoading}
            className="inline-flex items-center px-4 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            {fillLoading
              ? zh ? "补全中..." : "Restoring..."
              : zh ? "💸 花 $0.20 补全" : "💸 Restore for $0.20"}
          </button>
        </div>
      )}
    </div>
  );
}
