"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ProviderKeysPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const isZh = locale === "zh";

  const [seedanceKey, setSeedanceKey] = useState("");
  const [savedMask, setSavedMask] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/provider-keys")
      .then((r) => r.json())
      .then((data) => {
        setSavedMask(data.seedanceApiKey ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!seedanceKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/provider-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedanceApiKey: seedanceKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSavedMask(data.seedanceApiKey);
      setSeedanceKey("");
      setMessage({
        type: "success",
        text: isZh ? "Seedance API Key 已保存" : "Seedance API Key saved",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/provider-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedanceApiKey: null }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      setSavedMask(null);
      setSeedanceKey("");
      setMessage({
        type: "success",
        text: isZh ? "已清除" : "Cleared",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to clear",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-6">
          <Link
            href={`/${locale}/settings`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; {isZh ? "返回设置" : "Back to Settings"}
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "第三方 API Key 管理" : "Provider API Keys"}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isZh
              ? "填入你自己的 API Key，使用对应模型时将免除平台费用，直接使用你自己的额度。"
              : "Enter your own API keys to bypass platform credits and use your own quota directly."}
          </p>
        </div>

        {/* Seedance 2.0 */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Seedance 2.0
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isZh
                  ? "ByteDance Seedance 2.0 视频生成"
                  : "ByteDance Seedance 2.0 video generation"}
              </p>
            </div>
            <a
              href="https://seedanceapi.org/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isZh ? "获取 Key" : "Get Key"} &rarr;
            </a>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500">
              {isZh ? "加载中..." : "Loading..."}
            </div>
          ) : (
            <div className="space-y-3">
              {savedMask && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3">
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {isZh ? "当前 Key: " : "Current: "}
                    </span>
                    <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                      {savedMask}
                    </code>
                  </div>
                  <button
                    onClick={handleClear}
                    disabled={saving}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    {isZh ? "清除" : "Clear"}
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="password"
                  value={seedanceKey}
                  onChange={(e) => setSeedanceKey(e.target.value)}
                  placeholder={savedMask ? (isZh ? "输入新 Key 替换..." : "Enter new key to replace...") : "sk-..."}
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSave}
                  disabled={saving || !seedanceKey.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving
                    ? (isZh ? "保存中..." : "Saving...")
                    : (isZh ? "保存" : "Save")}
                </button>
              </div>

              {message && (
                <p
                  className={`text-sm ${
                    message.type === "success"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {message.text}
                </p>
              )}

              <p className="text-xs text-gray-400 dark:text-gray-500">
                {isZh
                  ? "Key 以 AES-256-GCM 加密存储。使用 Seedance 2.0 模型时将直接使用你的 Key，不扣除平台积分。"
                  : "Keys are encrypted with AES-256-GCM. When using Seedance 2.0 models, your own key will be used without platform credit charges."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
