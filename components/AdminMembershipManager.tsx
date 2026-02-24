"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export default function AdminMembershipManager() {
  const t = useTranslations("admin");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<string>("air");
  const [status, setStatus] = useState<string>("active");
  const [periodEnd, setPeriodEnd] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    message?: string;
    previous?: {
      tier?: string | null;
      status?: string | null;
      periodEnd?: string | null;
      stripeSubId?: string | null;
    };
    updated?: {
      subscriptionTier?: string | null;
      subscriptionStatus?: string | null;
      subscriptionPeriodEnd?: string | null;
    };
  } | null>(null);

  const tiers = ["air", "bronze", "iron", "silver", "gold"];
  const statuses = ["active", "cancelled", "past_due"];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/update-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          subscriptionTier: tier || null,
          subscriptionStatus: status || null,
          subscriptionPeriodEnd: periodEnd || null,
          note,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({ success: false, message: data.error || "Failed" });
      } else {
        setResult({
          success: true,
          message: "Membership updated successfully",
          previous: data.previous,
          updated: data.updated,
        });
        // Reset form
        setEmail("");
        setTier("air");
        setStatus("active");
        setPeriodEnd("");
        setNote("");
      }
    } catch (error) {
      setResult({ success: false, message: String(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        {t("membershipManager")}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("userEmail")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="user@example.com"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("subscriptionTier")}
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {tiers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("subscriptionStatus")}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("periodEnd")}
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("adminNote")}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder={t("adminNotePlaceholder")}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          {loading ? t("updating") : t("updateMembership")}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 p-4 rounded-md ${
            result.success
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
          }`}
        >
          <p className="font-medium">{result.message}</p>
          {result.previous && (
            <div className="mt-2 text-sm">
              <p className="font-semibold">{t("previous")}:</p>
              <ul className="list-disc list-inside">
                <li>
                  {t("tier")}: {result.previous.tier || "none"}
                </li>
                <li>
                  {t("status")}: {result.previous.status || "none"}
                </li>
                <li>
                  {t("periodEnd")}: {result.previous.periodEnd || "none"}
                </li>
              </ul>
            </div>
          )}
          {result.updated && (
            <div className="mt-2 text-sm">
              <p className="font-semibold">{t("updated")}:</p>
              <ul className="list-disc list-inside">
                <li>
                  {t("tier")}: {result.updated.subscriptionTier || "none"}
                </li>
                <li>
                  {t("status")}: {result.updated.subscriptionStatus || "none"}
                </li>
                <li>
                  {t("periodEnd")}:{" "}
                  {result.updated.subscriptionPeriodEnd || "none"}
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
