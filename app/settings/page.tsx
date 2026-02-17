"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import Link from "next/link";

interface XAccount {
  id: string;
  label: string | null;
  username: string | null;
  isDefault: boolean;
  createdAt: string;
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

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useUser();
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      void fetchAccounts();
    }
  }, [authLoading, user]);

  async function fetchAccounts() {
    try {
      const [settingsRes, usageRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/usage?days=30"),
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
    } finally {
      setLoading(false);
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
        await fetchAccounts();
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
      await fetchAccounts();
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
      await fetchAccounts();
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
              href="/"
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Connected X Accounts
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Connect multiple X accounts and choose one per post/schedule.
              </p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {accounts.length} connected
            </span>
          </div>

          {accounts.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              No X accounts connected yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {account.label || account.username || "Unnamed account"}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {account.username ? `@${account.username}` : "No username"}
                      {account.isDefault ? " • Default" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
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
              ))}
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Add X Account
          </h2>
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
