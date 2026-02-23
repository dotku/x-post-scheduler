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
} from "@/lib/subscription";
import type { TierKey } from "@/lib/subscription";

interface XAccount {
  id: string;
  label: string | null;
  username: string | null;
  isDefault: boolean;
  createdAt: string;
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
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [credits, setCredits] = useState<CreditData>({
    balanceCents: 0,
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
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly",
  );

  useEffect(() => {
    if (!authLoading && user) {
      void fetchData();
    }
  }, [authLoading, user]);

  // Language is loaded from the API (DB) in fetchData

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Handle subscription success redirect
    if (params.get("sub") === "success") {
      setMessage({
        type: "success",
        text: "Subscription activated! Credits will be added shortly.",
      });
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    const topup = params.get("topup");
    const sessionId = params.get("session_id");

    if (topup !== "success") {
      if (topup === "cancelled") {
        setMessage({ type: "error", text: "Checkout cancelled." });
        window.history.replaceState({}, "", "/settings");
      }
      return;
    }

    const fulfillTopup = async () => {
      try {
        if (!sessionId) {
          setMessage({
            type: "error",
            text: "Missing Stripe session id. Credits may still be applied via webhook.",
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
              text: "Credits added successfully!",
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
              data.error || "Payment succeeded, but credit fulfillment failed.",
          });
          return;
        }
      } catch {
        setMessage({
          type: "error",
          text: "Payment succeeded, but credit fulfillment failed.",
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
        setSubTier(subData.tier);
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
          text: data.error || "Failed to start checkout",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to start checkout" });
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
      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to start subscription",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to start subscription" });
    } finally {
      setSubLoading(null);
    }
  }

  async function handleCancelSubscription() {
    if (
      !confirm(
        "Cancel subscription? You will keep access until the end of the billing period.",
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
          text: `Subscription cancelled. Access continues until ${end}.`,
        });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to cancel subscription",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to cancel subscription" });
    } finally {
      setSubLoading(null);
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
          [accountId]: data.error || "Verification failed",
        }));
      }
    } catch {
      setVerifyStatus((s) => ({ ...s, [accountId]: "error" }));
      setVerifyError((e) => ({ ...e, [accountId]: "Network error" }));
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
          text: `Keys updated — connected as @${data.username || "unknown"}`,
        });
        setEditState(null);
        // Reset verify status so it shows fresh
        setVerifyStatus((s) => ({ ...s, [editState.accountId]: "idle" }));
        await fetchData();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to update keys",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to update keys" });
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
          text: `Account connected as @${data.username || "unknown"}`,
        });
        setLabel("");
        setXApiKey("");
        setXApiSecret("");
        setXAccessToken("");
        setXAccessTokenSecret("");
        setSetAsDefault(false);
        await fetchData();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to connect" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save credentials" });
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
      setMessage({ type: "success", text: "Default account updated" });
    }
  }

  async function handleRemove(accountId: string) {
    if (!confirm("Remove this X account connection?")) return;
    setMessage(null);
    const res = await fetch(
      `/api/settings?accountId=${encodeURIComponent(accountId)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      await fetchData();
      setMessage({ type: "success", text: "Account removed" });
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
          text:
            appLanguage === "zh"
              ? "语言已更新为中文。"
              : "Language updated to English.",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save language preference" });
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
            Please sign in to manage your settings.
          </p>
          <a
            href="/auth/login"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
            <Link
              href={pathname.startsWith("/zh") ? "/zh/dashboard" : "/dashboard"}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Language
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose your preferred language for supported pages.
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
              Save Language
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Connected X Accounts
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Connect multiple X accounts and choose one per post/schedule.
              </p>
            </div>
            <span className="inline-flex items-center self-start px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {accounts.length} connected
            </span>
          </div>

          {accounts.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              No X accounts connected yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
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
                            title="Connected"
                          />
                        )}
                        {status === "error" && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full bg-red-500"
                            title="Connection error"
                          />
                        )}
                        {status === "checking" && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full bg-yellow-400 animate-pulse"
                            title="Checking..."
                          />
                        )}
                        {status === "idle" && (
                          <span
                            className="shrink-0 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"
                            title="Not verified"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {account.label ||
                              account.username ||
                              "Unnamed account"}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {account.username
                              ? `@${account.username}`
                              : "No username"}
                            {account.isDefault ? " • Default" : ""}
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
                          {status === "checking" ? "Checking..." : "Verify"}
                        </button>
                        <button
                          onClick={() =>
                            isEditing
                              ? setEditState(null)
                              : handleStartEdit(account)
                          }
                          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          {isEditing ? "Cancel" : "Update keys"}
                        </button>
                        {!account.isDefault && (
                          <button
                            onClick={() => handleSetDefault(account.id)}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Set default
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(account.id)}
                          className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          Remove
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
                          Update API keys for this account
                        </p>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Label (optional)
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
                            placeholder="e.g. Brand Main, Personal"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              API Key
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
                              placeholder="Paste new API Key"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              API Secret
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
                              placeholder="Paste new API Secret"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Access Token
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
                              placeholder="Paste new Access Token"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Access Token Secret
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
                              placeholder="Paste new Access Token Secret"
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
                              ? "Verifying & Saving..."
                              : "Save New Keys"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditState(null)}
                            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Membership / Subscription */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {appLanguage === "zh" ? "会员订阅" : "Membership"}
          </h2>

          {isVerifiedMember(subTier, subStatus) && subTier ? (
            /* Active subscription */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    subTier === "gold"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : subTier === "silver"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        : subTier === "iron"
                          ? "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
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
                {TIER_ORDER.filter((t) => t !== subTier).map((tier) => {
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
                })}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Credits & Billing
          </h2>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current Balance
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                ${(credits.balanceCents / 100).toFixed(2)}
              </p>
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
                    ? "Loading..."
                    : `Add $${(amount / 100).toFixed(2)}`}
                </button>
              ))}
            </div>
          </div>
          {credits.transactions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recent Transactions
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Usage
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Token consumption in the last {usage.rangeDays} days.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Requests
                </p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {usage.window.requests}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Prompt tokens
                </p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {usage.window.promptTokens.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Completion tokens
                </p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {usage.window.completionTokens.toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-4">
              Total tokens (30d):{" "}
              <span className="font-semibold">
                {usage.window.totalTokens.toLocaleString()}
              </span>{" "}
              • All-time total:{" "}
              <span className="font-semibold">
                {usage.allTime.totalTokens.toLocaleString()}
              </span>
            </p>
            {(usage.byModel?.length ?? 0) > 0 && (
              <div className="mt-5">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cost by Model ({usage.rangeDays}d, estimated)
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {usage.byModel!.map((item) => (
                    <div
                      key={`${item.provider}:${item.model}`}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-gray-900 dark:text-white break-all">
                          <span className="text-xs uppercase text-gray-500 dark:text-gray-400 mr-2">
                            {item.provider}
                          </span>
                          {item.model}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                          ${(item.estimatedCostCents / 100).toFixed(2)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {item.requests.toLocaleString()} req •{" "}
                        {item.totalTokens.toLocaleString()} tokens
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Add X Account
            </h2>
            <Link
              href="/docs"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              How to get API keys?
            </Link>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account Label (optional)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Brand Main, Personal"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key
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
                API Secret
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
                Access Token
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
                Access Token Secret
              </label>
              <input
                type="password"
                value={xAccessTokenSecret}
                onChange={(e) => setXAccessTokenSecret(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
              />
              Set as default account
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Verifying & Saving..." : "Add Account"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
