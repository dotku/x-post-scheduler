"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface TopupResult {
  success: boolean;
  user: { email: string; previousBalance: number };
  newBalance: number;
  amountCents: number;
  error?: string;
}

export default function AdminCreditTopup() {
  const t = useTranslations("admin");
  const [email, setEmail] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TopupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const dollars = parseFloat(amountUsd);
    if (!email.trim()) { setError(t("topupErrorEmail")); return; }
    if (!Number.isFinite(dollars) || dollars <= 0) { setError(t("topupErrorAmount")); return; }

    const amountCents = Math.round(dollars * 100);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), amountCents, note: note.trim() || undefined }),
      });
      const data = await res.json() as TopupResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Request failed");
      } else {
        setResult(data);
        setEmail("");
        setAmountUsd("");
        setNote("");
      }
    } catch {
      setError(t("topupErrorNetwork"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 sm:grid sm:grid-cols-2 gap-4 flex flex-col">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("topupUserEmail")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("topupAmount")}
            </label>
            <input
              type="number"
              value={amountUsd}
              onChange={(e) => setAmountUsd(e.target.value)}
              placeholder="e.g. 5.00"
              min="0.01"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("topupNote")}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("topupNotePlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t("topupProcessing") : t("topupSubmit")}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <p className="font-medium">{t("topupSuccess")}</p>
          <p className="mt-1">
            {t("topupUser")}: <span className="font-mono">{result.user.email}</span>
          </p>
          <p>
            {t("topupAdded")}: <strong>${(result.amountCents / 100).toFixed(2)}</strong>
            {" · "}
            {t("topupPrevious")}: ${(result.user.previousBalance / 100).toFixed(2)}
            {" → "}
            {t("topupNewBalance")}: <strong>${(result.newBalance / 100).toFixed(2)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
