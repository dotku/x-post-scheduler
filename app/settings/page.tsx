"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";
import { format } from "date-fns";

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

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useUser();
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [credits, setCredits] = useState<CreditData>({ balanceCents: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topupLoading, setTopupLoading] = useState<number | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<Record<string, VerifyStatus>>({});
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

  useEffect(() => {
    if (!authLoading && user) {
      void fetchData();
    }
  }, [authLoading, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
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
            setMessage({ type: "success", text: "Credits added successfully!" });
            return;
          }

          if (data.retryable && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }

          setMessage({
            type: "error",
            text: data.error || "Payment succeeded, but credit fulfillment failed.",
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
      const [settingsRes, usageRes, creditsRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/usage?days=30"),
        fetch("/api/credits"),
      ]);
      if (!settingsRes.ok) return;
      const data = await settingsRes.json();
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      if ((data.accounts?.length ?? 0) > 0) {
        setSetAsDefault(false);
      }
      if (usageRes.ok) {
        setUsage(await usageRes.json());
      }
      if (creditsRes.ok) {
        setCredits(await creditsRes.json());
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
        setMessage({ type: "error", text: data.error || "Failed to start checkout" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to start checkout" });
    } finally {
      setTopupLoading(null);
    }
  }

  async function handleVerify(accountId: string) {
    setVerifyStatus((s) => ({ ...s, [accountId]: "checking" }));
    setVerifyError((e) => ({ ...e, [accountId]: "" }));
    try {
      const res = await fetch(`/api/settings/verify?accountId=${encodeURIComponent(accountId)}`);
      const data = await res.json();
      if (data.valid) {
        setVerifyStatus((s) => ({ ...s, [accountId]: "ok" }));
      } else {
        setVerifyStatus((s) => ({ ...s, [accountId]: "error" }));
        setVerifyError((e) => ({ ...e, [accountId]: data.error || "Verification failed" }));
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
        setMessage({ type: "success", text: `Keys updated — connected as @${data.username || "unknown"}` });
        setEditState(null);
        // Reset verify status so it shows fresh
        setVerifyStatus((s) => ({ ...s, [editState.accountId]: "idle" }));
        await fetchData();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update keys" });
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
      { method: "DELETE" }
    );
    if (res.ok) {
      await fetchData();
      setMessage({ type: "success", text: "Account removed" });
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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Settings
            </h1>
            <Link
              href="/dashboard"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                          <span className="shrink-0 w-2 h-2 rounded-full bg-green-500" title="Connected" />
                        )}
                        {status === "error" && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-red-500" title="Connection error" />
                        )}
                        {status === "checking" && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Checking..." />
                        )}
                        {status === "idle" && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" title="Not verified" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {account.label || account.username || "Unnamed account"}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {account.username ? `@${account.username}` : "No username"}
                            {account.isDefault ? " • Default" : ""}
                          </p>
                          {status === "error" && verifyError[account.id] && (
                            <p className="text-xs text-red-500 mt-0.5">{verifyError[account.id]}</p>
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
                          onClick={() => isEditing ? setEditState(null) : handleStartEdit(account)}
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
                            onChange={(e) => setEditState({ ...editState, label: e.target.value })}
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
                              onChange={(e) => setEditState({ ...editState, xApiKey: e.target.value })}
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
                              onChange={(e) => setEditState({ ...editState, xApiSecret: e.target.value })}
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
                              onChange={(e) => setEditState({ ...editState, xAccessToken: e.target.value })}
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
                              onChange={(e) => setEditState({ ...editState, xAccessTokenSecret: e.target.value })}
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
                            {updating ? "Verifying & Saving..." : "Save New Keys"}
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Credits & Billing
            </h2>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
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
                    {topupLoading === amount ? "Loading..." : `Add $${(amount / 100).toFixed(2)}`}
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
                    <div key={tx.id} className="flex items-center justify-between text-sm py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-mono font-medium shrink-0 ${tx.amountCents >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                          {tx.amountCents >= 0 ? "+" : ""}${(tx.amountCents / 100).toFixed(2)}
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
                <p className="text-xs text-gray-500 dark:text-gray-400">Requests</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {usage.window.requests}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Prompt tokens</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {usage.window.promptTokens.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Completion tokens</p>
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
          <div className="flex items-center justify-between mb-4">
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
