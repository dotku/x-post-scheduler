"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter, usePathname } from "next/navigation";
import {
  TIERS,
  TIER_ORDER,
  isVerifiedMember,
  getTierInfo,
  normalizeTier,
} from "@/lib/subscription";
import type { TierKey } from "@/lib/subscription";

interface XAccount {
  id: string;
  label: string | null;
  username: string | null;
  isDefault: boolean;
  createdAt: string;
  followersCount: number | null;
  followingCount: number | null;
  lastSyncedAt: string | null;
}

type VerifyStatus = "idle" | "checking" | "ok" | "error";

interface EditState {
  accountId: string;
  xApiKey: string;
  xApiSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
  label: string;
}

interface UsageSummary {
  rangeDays: number;
  window: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  allTime: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  byModel?: {
    provider: string;
    model: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostCents: number;
  }[];
}

interface CreditData {
  balanceCents: number;
  totalSavedCents: number;
  transactions: {
    id: string;
    type: string;
    amountCents: number;
    balanceAfter: number;
    description: string | null;
    createdAt: string;
  }[];
}

type AppLanguage = "en" | "zh";

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const tr = (en: string, zh: string) => (appLanguage === "zh" ? zh : en);
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [credits, setCredits] = useState<CreditData>({
    balanceCents: 0,
    totalSavedCents: 0,
    transactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topupLoading, setTopupLoading] = useState<number | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<
    Record<string, VerifyStatus>
  >({});
  const [verifyError, setVerifyError] = useState<Record<string, string>>({});
  const [editState, setEditState] = useState<EditState | null>(null);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [label, setLabel] = useState("");
  const [xApiKey, setXApiKey] = useState("");
  const [xApiSecret, setXApiSecret] = useState("");
  const [xAccessToken, setXAccessToken] = useState("");
  const [xAccessTokenSecret, setXAccessTokenSecret] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [appLanguage, setAppLanguage] = useState<AppLanguage>("en");

  // Subscription
  const [subTier, setSubTier] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<string | null>(null);
  const [subPeriodEnd, setSubPeriodEnd] = useState<string | null>(null);
  const [accountLimit, setAccountLimit] = useState<number>(1);
  const [subLoading, setSubLoading] = useState<string | null>(null);
  const [syncingSubscription, setSyncingSubscription] = useState(false);
  const [syncingFollowers, setSyncingFollowers] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const normalizedSubTier = normalizeTier(subTier);

  useEffect(() => {
    if (!authLoading && user) {
      void fetchData();
    }
  }, [authLoading, user]);

  // Auto-refresh subscription status when page becomes visible or gets focus
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchData();
      }
    };

    const handleFocus = () => {
      void fetchData();
    };

    // Listen to visibility changes (tab switching)
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Listen to window focus (returning from external page like Stripe)
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user]);

  // Language is loaded from the API (DB) in fetchData

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Handle subscription success redirect
    if (params.get("sub") === "success") {
      setMessage({
        type: "success",
        text: tr(
          "Subscription activated! Updating subscription status...",
          "订阅已生效！正在更新订阅状态...",
        ),
      });
      window.history.replaceState({}, "", window.location.pathname);

      // Poll for subscription update (webhook might take a few seconds)
      const pollSubscription = async () => {
        let attempts = 0;
        const maxAttempts = 10; // Try for up to 10 seconds

        const poll = async () => {
          attempts++;
          await fetchData();

          // Check if subscription is updated
          const subRes = await fetch("/api/me/subscription");
          if (subRes.ok) {
            const subData = await subRes.json();
            if (subData.status === "active") {
              // Subscription updated successfully
              setMessage({
                type: "success",
                text: tr(
                  "Subscription activated! Credits added successfully.",
                  "订阅已生效！积分已成功到账。",
                ),
              });
              return true;
            }
          }

          if (attempts < maxAttempts) {
            setTimeout(() => void poll(), 1000);
          } else {
            setMessage({
              type: "success",
              text: tr(
                "Subscription activated! If status doesn't update, try clicking 'Sync Subscription'.",
                "订阅已生效！如果状态未更新，请点击“同步订阅”。",
              ),
            });
          }
          return false;
        };

        void poll();
      };

      void pollSubscription();
      return;
    }

    const topup = params.get("topup");
    const sessionId = params.get("session_id");

    if (topup !== "success") {
      if (topup === "cancelled") {
        setMessage({
          type: "error",
          text: tr("Checkout cancelled.", "支付已取消。"),
        });
        window.history.replaceState({}, "", "/settings");
      }
      return;
    }

    const fulfillTopup = async () => {
      try {
        if (!sessionId) {
          setMessage({
            type: "error",
            text: tr(
              "Missing Stripe session id. Credits may still be applied via webhook.",
              "缺少 Stripe 会话 ID。积分可能仍会通过 webhook 入账。",
            ),
          });
          return;
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const res = await fetch("/api/stripe/fulfill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok) {
            await fetchData();
            setMessage({
              type: "success",
              text: tr("Credits added successfully!", "积分已成功到账！"),
            });
            return;
          }

          if (data.retryable && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }

          setMessage({
            type: "error",
            text:
              data.error ||
              tr(
                "Payment succeeded, but credit fulfillment failed.",
                "支付成功，但积分入账失败。",
              ),
          });
          return;
        }
      } catch {
        setMessage({
          type: "error",
          text: tr(
            "Payment succeeded, but credit fulfillment failed.",
            "支付成功，但积分入账失败。",
          ),
        });
      } finally {
        window.history.replaceState({}, "", "/settings");
      }
    };

    void fulfillTopup();
  }, []);

  async function fetchData() {
    try {
      const [settingsRes, usageRes, creditsRes, subRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/usage?days=30"),
        fetch("/api/credits"),
        fetch("/api/me/subscription"),
      ]);
      if (!settingsRes.ok) return;
      const data = await settingsRes.json();
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      if ((data.accounts?.length ?? 0) > 0) {
        setSetAsDefault(false);
      }
      if (data.language === "zh" || data.language === "en") {
        setAppLanguage(data.language);
      }
      if (usageRes.ok) {
        setUsage(await usageRes.json());
      }
      if (creditsRes.ok) {
        setCredits(await creditsRes.json());
      }
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubTier(normalizeTier(subData.tier) ?? subData.tier ?? null);
        setSubStatus(subData.status);
        setSubPeriodEnd(subData.periodEnd);
        setAccountLimit(subData.accountLimit ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleTopup(amountCents: number) {
    setTopupLoading(amountCents);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({
          type: "error",
          text: data.error || tr("Failed to start checkout", "无法发起支付"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: tr("Failed to start checkout", "无法发起支付"),
      });
    } finally {
      setTopupLoading(null);
    }
  }

  async function handleSubscribe(
    tier: string,
    intervalOverride?: "monthly" | "yearly",
  ) {
    setSubLoading(tier);
    setMessage(null);
    try {
      const interval = intervalOverride ?? billingInterval;
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json();
      if (data.reactivated) {
        // Subscription reactivated in-place — no redirect needed
        setSubStatus("active");
        setMessage({
          type: "success",
          text: tr(
            "Subscription reactivated successfully!",
            "订阅已成功恢复！",
          ),
        });
        await fetchData();
      } else if (data.url) {
        // If portal=true, user has truly active subscription - redirect to portal to manage
        if (data.portal) {
          setMessage({
            type: "success",
            text: tr(
              "Redirecting to subscription management portal to change your plan...",
              "正在跳转到订阅管理页面以更改您的方案...",
            ),
          });
        }
        window.location.href = data.url;
      } else {
        setMessage({
          type: "error",
          text:
            data.error || tr("Failed to start subscription", "无法发起订阅"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: tr("Failed to start subscription", "无法发起订阅"),
      });
    } finally {
      setSubLoading(null);
    }
  }

  async function handleCancelSubscription() {
    if (
      !confirm(
        tr(
          "Cancel subscription? You will keep access until the end of the billing period.",
          "确认取消订阅？你将继续使用到当前计费周期结束。",
        ),
      )
    )
      return;
    setSubLoading("cancel");
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/subscribe/cancel", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSubStatus("cancelled");
        const end = data.periodEnd
          ? format(new Date(data.periodEnd), "MMM d, yyyy")
          : "";
        setMessage({
          type: "success",
          text: tr(
            `Subscription cancelled. Access continues until ${end}.`,
            `订阅已取消，可使用至 ${end}。`,
          ),
        });
      } else {
        setMessage({
          type: "error",
          text:
            data.error || tr("Failed to cancel subscription", "取消订阅失败"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: tr("Failed to cancel subscription", "取消订阅失败"),
      });
    } finally {
      setSubLoading(null);
    }
  }

  async function handleSyncSubscription() {
    setSyncingSubscription(true);
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/sync-subscription", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSubTier(normalizeTier(data.tier) ?? data.tier ?? null);
        setSubStatus(data.status);
        setSubPeriodEnd(data.periodEnd);
        setMessage({
          type: "success",
          text: tr("Subscription synced successfully", "订阅状态已同步"),
        });
        await fetchData();
      } else {
        setMessage({
          type: "error",
          text: data.error || tr("Failed to sync subscription", "同步订阅失败"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: tr("Failed to sync subscription", "同步订阅失败"),
      });
    } finally {
      setSyncingSubscription(false);
    }
  }

  async function handleVerify(accountId: string) {
    setVerifyStatus((s) => ({ ...s, [accountId]: "checking" }));
    setVerifyError((e) => ({ ...e, [accountId]: "" }));
    try {
      const res = await fetch(
        `/api/settings/verify?accountId=${encodeURIComponent(accountId)}`,
      );
      const data = await res.json();
      if (data.valid) {
        setVerifyStatus((s) => ({ ...s, [accountId]: "ok" }));
      } else {
        setVerifyStatus((s) => ({ ...s, [accountId]: "error" }));
        setVerifyError((e) => ({
          ...e,
          [accountId]: data.error || tr("Verification failed", "验证失败"),
        }));
      }
    } catch {
      setVerifyStatus((s) => ({ ...s, [accountId]: "error" }));
      setVerifyError((e) => ({
        ...e,
        [accountId]: tr("Network error", "网络错误"),
      }));
    }
  }

  async function handleSyncFollowers() {
    setSyncingFollowers(true);
    try {
      const res = await fetch("/api/analytics/sync-followers", {
        method: "POST",
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // silently ignore
    } finally {
      setSyncingFollowers(false);
    }
  }

  function handleStartEdit(account: XAccount) {
    setEditState({
      accountId: account.id,
      label: account.label || "",
      xApiKey: "",
      xApiSecret: "",
      xAccessToken: "",
      xAccessTokenSecret: "",
    });
  }

  async function handleUpdateKeys(e: React.FormEvent) {
    e.preventDefault();
    if (!editState) return;
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: editState.accountId,
          label: editState.label || undefined,
          xApiKey: editState.xApiKey,
          xApiSecret: editState.xApiSecret,
          xAccessToken: editState.xAccessToken,
          xAccessTokenSecret: editState.xAccessTokenSecret,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: tr(
            `Keys updated — connected as @${data.username || "unknown"}`,
            `已更新密钥 — 当前账号 @${data.username || "unknown"}`,
          ),
        });
        setEditState(null);
        // Reset verify status so it shows fresh
        setVerifyStatus((s) => ({ ...s, [editState.accountId]: "idle" }));
        await fetchData();
      } else {
        setMessage({
          type: "error",
          text: data.error || tr("Failed to update keys", "更新密钥失败"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: tr("Failed to update keys", "更新密钥失败"),
      });
    } finally {
      setUpdating(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label || undefined,
          xApiKey,
          xApiSecret,
          xAccessToken,
          xAccessTokenSecret,
          setAsDefault,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: tr(
            `Account connected as @${data.username || "unknown"}`,
            `账号已连接：@${data.username || "unknown"}`,
          ),
        });
        setLabel("");
        setXApiKey("");
        setXApiSecret("");
        setXAccessToken("");
        setXAccessTokenSecret("");
        setSetAsDefault(false);
        await fetchData();
      } else {
        setMessage({
          type: "error",
          text: data.error || tr("Failed to connect", "连接失败"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: tr("Failed to save credentials", "保存凭据失败"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(accountId: string) {
    setMessage(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    if (res.ok) {
      await fetchData();
      setMessage({
        type: "success",
        text: tr("Default account updated", "默认账号已更新"),
      });
    }
  }

  async function handleRemove(accountId: string) {
    if (
      !confirm(
        tr("Remove this X account connection?", "确认移除该 X 账号连接？"),
      )
    )
      return;
    setMessage(null);
    const res = await fetch(
      `/api/settings?accountId=${encodeURIComponent(accountId)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      await fetchData();
      setMessage({
        type: "success",
        text: tr("Account removed", "账号已移除"),
      });
    }
  }

  async function handleSaveLanguage() {
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: appLanguage }),
      });
      if (!res.ok) throw new Error("Failed to save");
      // Navigate to the correct locale URL
      const currentIsZh = pathname.startsWith("/zh");
      const wantZh = appLanguage === "zh";
      if (currentIsZh !== wantZh) {
        const pathWithoutLocale = currentIsZh
          ? pathname.slice(3) || "/"
          : pathname;
        const newPath = wantZh ? `/zh${pathWithoutLocale}` : pathWithoutLocale;
        router.push(newPath);
      } else {
        setMessage({
          type: "success",
          text: tr("Language updated to English.", "语言已更新为中文。"),
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: tr("Failed to save language preference", "保存语言偏好失败"),
      });
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {tr(
              "Please sign in to manage your settings.",
              "请先登录以管理设置。",
            )}
          </p>
          <a
            href="/auth/login"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {tr("Sign In", "登录")}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {tr("Settings", "设置")}
            </h1>
            <Link
              href={pathname.startsWith("/zh") ? "/zh/dashboard" : "/dashboard"}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              {tr("← Dashboard", "← 控制台")}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tr("Profile", "个人信息")}
            </h2>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name || "User"}
                  className="w-14 h-14 rounded-full border border-gray-200 dark:border-gray-700"
                />
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900 dark:text-white truncate">
                  {user.name || tr("Unnamed user", "未命名用户")}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user.email || "—"}
                </p>
              </div>
              <div className="sm:ml-auto text-sm text-gray-600 dark:text-gray-300">
                <p>
                  {tr("Membership:", "会员等级：")}{" "}
                  {subTier
                    ? appLanguage === "zh"
                      ? getTierInfo(subTier)?.labelZh
                      : getTierInfo(subTier)?.label
                    : tr("None", "未订阅")}
                </p>
                <p>
                  {tr("Status:", "状态：")} {subStatus || "—"}
                </p>
                <button
                  onClick={handleSyncSubscription}
                  disabled={syncingSubscription}
                  className="mt-2 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {syncingSubscription
                    ? tr("Syncing...", "同步中...")
                    : tr("Sync Subscription", "同步订阅")}
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tr("Language", "语言")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {tr(
                "Choose your preferred language for supported pages.",
                "选择你的页面显示语言。",
              )}
            </p>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <select
                value={appLanguage}
                onChange={(e) => setAppLanguage(e.target.value as AppLanguage)}
                className="w-full sm:w-56 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="en">English</option>
                <option value="zh">简体中文</option>
              </select>
              <button
                type="button"
                onClick={handleSaveLanguage}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {tr("Save Language", "保存语言")}
              </button>
            </div>
          </div>
        </div>
        {/* end Profile+Language grid */}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr("Connected X Accounts", "已连接的 X 账号")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {tr(
                  "Connect multiple X accounts and choose one per post/schedule.",
                  "支持连接多个 X 账号，并在每条内容/定时任务中选择使用的账号。",
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {tr(
                  `${accounts.length} connected`,
                  `${accounts.length} 已连接`,
                )}
              </span>
              {accounts.length > 0 && (
                <button
                  onClick={() => void handleSyncFollowers()}
                  disabled={syncingFollowers}
                  className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  title={tr("Sync follower counts", "同步粉丝数")}
                >
                  {syncingFollowers
                    ? tr("Syncing...", "同步中...")
                    : tr("Sync Followers", "同步粉丝数")}
                </button>
              )}
            </div>
          </div>

          {accounts.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-gray-500 dark:text-gray-400">
              {tr("No X accounts connected yet.", "尚未连接任何 X 账号。")}
            </p>
          ) : (
            <div className="px-6 pb-6 space-y-3">
              {accounts.map((account) => {
                const status = verifyStatus[account.id] ?? "idle";
                const isEditing = editState?.accountId === account.id;
                return (
                  <div
                    key={account.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    {/* Account row */}
                    <div className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2">
                        {/* Status dot */}
                        {status === "ok" && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full bg-green-500"
                            title={tr("Connected", "已连接")}
                          />
                        )}
                        {status === "error" && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full bg-red-500"
                            title={tr("Connection error", "连接错误")}
                          />
                        )}
                        {status === "checking" && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full bg-yellow-400 animate-pulse"
                            title={tr("Checking...", "检查中...")}
                          />
                        )}
                        {status === "idle" && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"
                            title={tr("Not verified", "未验证")}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {account.label ||
                              account.username ||
                              tr("Unnamed account", "未命名账号")}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {account.username
                              ? `@${account.username}`
                              : tr("No username", "无用户名")}
                            {account.isDefault
                              ? tr(" • Default", " • 默认")
                              : ""}
                            {account.lastSyncedAt != null
                              ? ` • ${(account.followersCount ?? 0).toLocaleString()} ${tr("followers", "粉丝")} / ${(account.followingCount ?? 0).toLocaleString()} ${tr("following", "关注")}`
                              : ""}
                          </p>
                          {status === "error" && verifyError[account.id] && (
                            <p className="text-xs text-red-500 mt-0.5">
                              {verifyError[account.id]}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleVerify(account.id)}
                          disabled={status === "checking"}
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          {status === "checking"
                            ? tr("Checking...", "检查中...")
                            : tr("Verify", "验证")}
                        </button>
                        <button
                          onClick={() =>
                            isEditing
                              ? setEditState(null)
                              : handleStartEdit(account)
                          }
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          {isEditing
                            ? tr("Cancel", "取消")
                            : tr("Update keys", "更新密钥")}
                        </button>
                        {!account.isDefault && (
                          <button
                            onClick={() => handleSetDefault(account.id)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            {tr("Set default", "设为默认")}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(account.id)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          {tr("Remove", "移除")}
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form */}
                    {isEditing && editState && (
                      <form
                        onSubmit={handleUpdateKeys}
                        className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 space-y-3"
                      >
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {tr(
                            "Update API keys for this account",
                            "更新该账号的 API 密钥",
                          )}
                        </p>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {tr("Label (optional)", "标签（可选）")}
                          </label>
                          <input
                            type="text"
                            value={editState.label}
                            onChange={(e) =>
                              setEditState({
                                ...editState,
                                label: e.target.value,
                              })
                            }
                            placeholder={tr(
                              "e.g. Brand Main, Personal",
                              "例如：品牌主号、个人号",
                            )}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {tr("API Key", "API Key")}
                            </label>
                            <input
                              type="password"
                              value={editState.xApiKey}
                              onChange={(e) =>
                                setEditState({
                                  ...editState,
                                  xApiKey: e.target.value,
                                })
                              }
                              required
                              placeholder={tr(
                                "Paste new API Key",
                                "粘贴新的 API Key",
                              )}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {tr("API Secret", "API Secret")}
                            </label>
                            <input
                              type="password"
                              value={editState.xApiSecret}
                              onChange={(e) =>
                                setEditState({
                                  ...editState,
                                  xApiSecret: e.target.value,
                                })
                              }
                              required
                              placeholder={tr(
                                "Paste new API Secret",
                                "粘贴新的 API Secret",
                              )}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {tr("Access Token", "Access Token")}
                            </label>
                            <input
                              type="password"
                              value={editState.xAccessToken}
                              onChange={(e) =>
                                setEditState({
                                  ...editState,
                                  xAccessToken: e.target.value,
                                })
                              }
                              required
                              placeholder={tr(
                                "Paste new Access Token",
                                "粘贴新的 Access Token",
                              )}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              {tr("Access Token Secret", "Access Token Secret")}
                            </label>
                            <input
                              type="password"
                              value={editState.xAccessTokenSecret}
                              onChange={(e) =>
                                setEditState({
                                  ...editState,
                                  xAccessTokenSecret: e.target.value,
                                })
                              }
                              required
                              placeholder={tr(
                                "Paste new Access Token Secret",
                                "粘贴新的 Access Token Secret",
                              )}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={updating}
                            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {updating
                              ? tr("Verifying & Saving...", "验证并保存中...")
                              : tr("Save New Keys", "保存新密钥")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditState(null)}
                            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {tr("Cancel", "取消")}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add X Account — inline below the accounts list */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr("Add X Account", "添加 X 账号")}
              </h2>
              <Link
                href="/docs"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr("How to get API keys?", "如何获取 API 密钥？")}
              </Link>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr("Account Label (optional)", "账号标签（可选）")}
                  </label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={tr(
                      "e.g. Brand Main, Personal",
                      "例如：品牌主号、个人号",
                    )}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr("API Key", "API Key")}
                  </label>
                  <input
                    type="password"
                    value={xApiKey}
                    onChange={(e) => setXApiKey(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr("API Secret", "API Secret")}
                  </label>
                  <input
                    type="password"
                    value={xApiSecret}
                    onChange={(e) => setXApiSecret(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr("Access Token", "Access Token")}
                  </label>
                  <input
                    type="password"
                    value={xAccessToken}
                    onChange={(e) => setXAccessToken(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {tr("Access Token Secret", "Access Token Secret")}
                  </label>
                  <input
                    type="password"
                    value={xAccessTokenSecret}
                    onChange={(e) => setXAccessTokenSecret(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={setAsDefault}
                    onChange={(e) => setSetAsDefault(e.target.checked)}
                  />
                  {tr("Set as default account", "设为默认账号")}
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving
                    ? tr("Verifying & Saving...", "验证并保存中...")
                    : tr("Add Account", "添加账号")}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Membership / Subscription */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {appLanguage === "zh" ? "会员订阅" : "Membership"}
          </h2>

          {isVerifiedMember(subTier, subStatus) && normalizedSubTier ? (
            /* Active subscription */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    normalizedSubTier === "gold"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : normalizedSubTier === "silver"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        : normalizedSubTier === "iron"
                          ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                          : normalizedSubTier === "bronze"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
                  }`}
                >
                  ✓{" "}
                  {appLanguage === "zh"
                    ? getTierInfo(subTier)?.labelZh
                    : getTierInfo(subTier)?.label}{" "}
                  {appLanguage === "zh" ? "认证会员" : "Member"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {appLanguage === "zh" ? "下次续费：" : "Renews: "}
                  {subPeriodEnd
                    ? format(new Date(subPeriodEnd), "MMM d, yyyy")
                    : "—"}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {appLanguage === "zh"
                  ? `账号数量：${accounts.length} / ${accountLimit === Infinity ? "无限" : accountLimit}`
                  : `Accounts: ${accounts.length} / ${accountLimit === Infinity ? "unlimited" : accountLimit}`}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Upgrade/downgrade to other tiers */}
                {TIER_ORDER.filter((t) => t !== normalizedSubTier).map(
                  (tier) => {
                    const info = TIERS[tier as TierKey];
                    return (
                      <button
                        key={tier}
                        onClick={() => handleSubscribe(tier)}
                        disabled={subLoading !== null}
                        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {subLoading === tier
                          ? "…"
                          : appLanguage === "zh"
                            ? `切换至${info.labelZh} $${(info.priceMonthly / 100).toFixed(0)}/月`
                            : `Switch to ${info.label} $${(info.priceMonthly / 100).toFixed(0)}/mo`}
                      </button>
                    );
                  },
                )}
                <button
                  onClick={handleCancelSubscription}
                  disabled={subLoading !== null}
                  className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                >
                  {subLoading === "cancel"
                    ? "…"
                    : appLanguage === "zh"
                      ? "取消订阅"
                      : "Cancel Subscription"}
                </button>
              </div>
            </div>
          ) : subStatus === "cancelled" && subTier ? (
            /* Cancelled subscription — resubscribe option */
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {appLanguage === "zh"
                    ? `您的${getTierInfo(subTier)?.labelZh}会员已取消。${
                        subPeriodEnd
                          ? `会员权益将持续到 ${format(new Date(subPeriodEnd), "yyyy年M月d日")}。`
                          : ""
                      }`
                    : `Your ${getTierInfo(subTier)?.label} membership was cancelled.${
                        subPeriodEnd
                          ? ` Access continues until ${format(new Date(subPeriodEnd), "MMM d, yyyy")}.`
                          : ""
                      }`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {appLanguage === "zh"
                    ? "重新订阅即可恢复会员权益，或继续使用按需付费："
                    : "Resubscribe to restore your membership benefits, or continue with pay-as-you-go:"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* Pay as you go button */}
                  <button
                    disabled
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 cursor-default"
                  >
                    {appLanguage === "zh"
                      ? "按需付费 $0/月（期满后默认）"
                      : "Pay as you go $0/mo (default after expiry)"}
                  </button>
                  {TIER_ORDER.map((tier) => {
                    const info = TIERS[tier as TierKey];
                    const isCurrentTier = tier === normalizedSubTier;
                    return (
                      <button
                        key={tier}
                        onClick={() => handleSubscribe(tier)}
                        disabled={subLoading !== null}
                        className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${
                          isCurrentTier
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        {subLoading === tier
                          ? "…"
                          : appLanguage === "zh"
                            ? isCurrentTier
                              ? `重订${info.labelZh} $${(info.priceMonthly / 100).toFixed(0)}/月`
                              : `切换至${info.labelZh} $${(info.priceMonthly / 100).toFixed(0)}/月`
                            : isCurrentTier
                              ? `Resubscribe ${info.label} $${(info.priceMonthly / 100).toFixed(0)}/mo`
                              : `Switch to ${info.label} $${(info.priceMonthly / 100).toFixed(0)}/mo`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* No active subscription — show tier cards */
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {appLanguage === "zh"
                  ? "订阅会员即可获得认证标识、更多账号配额，以及按周期自动信用额度充值。"
                  : "Subscribe for a Verified badge, more account slots, and automatic credit top-ups each cycle."}
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBillingInterval("monthly")}
                    className={`px-3 py-1.5 text-sm font-medium ${
                      billingInterval === "monthly"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {appLanguage === "zh" ? "按月" : "Monthly"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval("yearly")}
                    className={`px-3 py-1.5 text-sm font-medium ${
                      billingInterval === "yearly"
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {appLanguage === "zh" ? "按年" : "Yearly"}
                  </button>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {appLanguage === "zh"
                    ? "年付免 2 个月"
                    : "Yearly saves 2 months"}
                </span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                {appLanguage === "zh"
                  ? "提示：AI Post Scheduler（自动发布）仅订阅会员可用。"
                  : "Note: AI Post Scheduler (auto-post) is available to subscribed members only."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Pay as you go option */}
                <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {appLanguage === "zh" ? "按需付费" : "Pay as you go"}
                  </p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    $0/mo
                  </p>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 flex-1">
                    <li>
                      ✓{" "}
                      {appLanguage === "zh"
                        ? "按需购买积分"
                        : "Buy credits as needed"}
                    </li>
                    <li className="text-gray-400 dark:text-gray-500">
                      ✗{" "}
                      {appLanguage === "zh"
                        ? "不支持社交账号自动发布"
                        : "No social auto-posting"}
                    </li>
                    <li className="text-gray-400 dark:text-gray-500">
                      ✗{" "}
                      {appLanguage === "zh"
                        ? "无认证标识"
                        : "No verified badge"}
                    </li>
                  </ul>
                  <div className="mt-1 w-full py-2 text-sm font-semibold text-center text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg">
                    {appLanguage === "zh" ? "当前方案" : "Current plan"}
                  </div>
                </div>
                {TIER_ORDER.map((tier) => {
                  const info = TIERS[tier as TierKey];
                  const isYearly = billingInterval === "yearly";
                  const priceCents = isYearly
                    ? info.priceYearly
                    : info.priceMonthly;
                  const priceLabel = isYearly
                    ? `$${(priceCents / 100).toFixed(0)}/yr`
                    : `$${(priceCents / 100).toFixed(0)}/mo`;
                  const accountLabel =
                    info.accountLimit === Infinity
                      ? appLanguage === "zh"
                        ? "无限账号"
                        : "Unlimited accounts"
                      : appLanguage === "zh"
                        ? `${info.accountLimit} 个账号`
                        : `${info.accountLimit} account${info.accountLimit > 1 ? "s" : ""}`;
                  const creditLabel =
                    appLanguage === "zh"
                      ? isYearly
                        ? `年度充值 $${(priceCents / 100).toFixed(0)}`
                        : `每月充值 $${(priceCents / 100).toFixed(0)}`
                      : isYearly
                        ? `$${(priceCents / 100).toFixed(0)} yearly credit`
                        : `$${(priceCents / 100).toFixed(0)} monthly credit`;
                  return (
                    <div
                      key={tier}
                      className={`rounded-xl border-2 p-4 flex flex-col gap-2 ${
                        tier === "silver"
                          ? "border-blue-400 dark:border-blue-500"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {tier === "silver" && (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                          {appLanguage === "zh" ? "热门" : "Popular"}
                        </span>
                      )}
                      <p className="font-bold text-gray-900 dark:text-white">
                        {appLanguage === "zh" ? info.labelZh : info.label}
                      </p>
                      <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {priceLabel}
                      </p>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 flex-1">
                        <li>✓ {accountLabel}</li>
                        <li>✓ {creditLabel}</li>
                        <li>
                          ✓{" "}
                          {appLanguage === "zh"
                            ? "认证会员标识"
                            : "Verified badge"}
                        </li>
                      </ul>
                      <button
                        onClick={() => handleSubscribe(tier, billingInterval)}
                        disabled={subLoading !== null}
                        className="mt-1 w-full py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {subLoading === tier
                          ? "…"
                          : appLanguage === "zh"
                            ? billingInterval === "yearly"
                              ? "年付订阅"
                              : "订阅"
                            : billingInterval === "yearly"
                              ? "Subscribe yearly"
                              : "Subscribe"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Enterprise plan */}
              <div className="mt-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {appLanguage === "zh" ? "企业版" : "Enterprise"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {appLanguage === "zh"
                      ? "专属定制方案，适合月预算 $15k+ 的团队与企业用户"
                      : "Custom solutions for teams & enterprises with $15k+ monthly budget"}
                  </p>
                </div>
                <a
                  href="https://jytech.us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-4 py-2 text-sm font-semibold rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors text-center"
                >
                  {appLanguage === "zh" ? "联系我们" : "Contact Us"}
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tr("Credits & Billing", "积分与账单")}
            </h2>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {tr("Current Balance", "当前余额")}
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  ${(credits.balanceCents / 100).toFixed(2)}
                </p>
                {(subTier === "gold" || subTier === "silver") &&
                  credits.totalSavedCents > 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      {appLanguage === "zh"
                        ? `会员折扣已节省 $${(credits.totalSavedCents / 100).toFixed(2)}`
                        : `Saved $${(credits.totalSavedCents / 100).toFixed(2)} with membership discount`}
                    </p>
                  )}
              </div>
              <div className="flex flex-wrap gap-2">
                {([500, 1000, 2500] as const).map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleTopup(amount)}
                    disabled={topupLoading !== null}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {topupLoading === amount
                      ? tr("Loading...", "加载中...")
                      : tr(
                          `Add $${(amount / 100).toFixed(2)}`,
                          `充值 $${(amount / 100).toFixed(2)}`,
                        )}
                  </button>
                ))}
              </div>
            </div>
            {credits.transactions.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {tr("Recent Transactions", "最近交易")}
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {credits.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-mono font-medium shrink-0 ${tx.amountCents >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}
                        >
                          {tx.amountCents >= 0 ? "+" : ""}$
                          {(tx.amountCents / 100).toFixed(2)}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 truncate">
                          {tx.description || tx.type}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                        {format(new Date(tx.createdAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {usage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr("AI Usage", "AI 使用情况")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {tr(
                  `Token consumption in the last ${usage.rangeDays} days.`,
                  `最近 ${usage.rangeDays} 天的 token 消耗。`,
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tr("Requests", "请求次数")}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {usage.window.requests}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tr("Prompt tokens", "提示 token")}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {usage.window.promptTokens.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tr("Completion tokens", "输出 token")}
                  </p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {usage.window.completionTokens.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-4">
                {tr("Total tokens (30d): ", "30天总 token：")}
                <span className="font-semibold">
                  {usage.window.totalTokens.toLocaleString()}
                </span>
                {tr(" • All-time total: ", " • 历史总计：")}
                <span className="font-semibold">
                  {usage.allTime.totalTokens.toLocaleString()}
                </span>
              </p>
              {(usage.byModel?.length ?? 0) > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {tr(
                      `Usage by Model (${usage.rangeDays}d)`,
                      `模型使用量（${usage.rangeDays} 天）`,
                    )}
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {usage.byModel!.map((item) => {
                      const displayProvider =
                        item.provider === "wavespeed"
                          ? "bytedance"
                          : item.provider;
                      return (
                        <div
                          key={`${item.provider}:${item.model}`}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                        >
                          <p className="text-sm text-gray-900 dark:text-white break-all">
                            <span className="text-xs uppercase text-gray-500 dark:text-gray-400 mr-2">
                              {displayProvider}
                            </span>
                            {item.model}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {tr(
                              `${item.requests.toLocaleString()} req • ${item.totalTokens.toLocaleString()} tokens`,
                              `${item.requests.toLocaleString()} 次请求 • ${item.totalTokens.toLocaleString()} token`,
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {/* end Credits+AI Usage grid */}

        {message && (
          <div
            className={`rounded-lg p-4 mb-6 ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}
      </main>
    </div>
  );
}
