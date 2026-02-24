"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Trend {
  name: string;
  url?: string;
  description?: string;
}

export default function GeneratePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<
    {
      id: string;
      label: string | null;
      username: string | null;
      isDefault: boolean;
    }[]
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [language, setLanguage] = useState("auto");
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [pipelineLog, setPipelineLog] = useState<Record<string, string> | null>(
    null,
  );
  const [trends, setTrends] = useState<Trend[]>([]);
  const [trendRegion, setTrendRegion] = useState<
    "global" | "usa" | "china" | "africa"
  >("global");
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [canUseTrending, setCanUseTrending] = useState(false);

  const charCount = generatedContent.length;
  const charRemaining = 280 - charCount;

  const fetchTrends = async (region: typeof trendRegion = "global") => {
    setLoadingTrends(true);
    try {
      const res = await fetch(`/api/trending?region=${region}`);
      const data = await res.json();
      if (res.status === 403 || data.error === "TIER_REQUIRED") return;
      if (data.success && data.trends) {
        setTrends(data.trends);
      }
    } catch (err) {
      console.error("Failed to fetch trends:", err);
    } finally {
      setLoadingTrends(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const [settingsRes, subRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/me/subscription"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const list = Array.isArray(data.accounts) ? data.accounts : [];
        setAccounts(list);
        if (list.length > 0) {
          const defaultAccount =
            list.find((a: { isDefault: boolean }) => a.isDefault) ?? list[0];
          setSelectedAccountId(defaultAccount.id);
        }
      }

      if (subRes.ok) {
        const sub = await subRes.json();
        const TIER_ORDER = ["wood", "bronze", "iron", "silver", "gold"];
        const tierIdx = TIER_ORDER.indexOf(sub.tier ?? "");
        const silverIdx = TIER_ORDER.indexOf("silver");
        const allowed = tierIdx >= silverIdx && tierIdx !== -1 && sub.status === "active";
        setCanUseTrending(allowed);
        if (allowed) void fetchTrends("global");
      }
    })();
  }, []);

  const handleGenerate = async (multiple: boolean = false, overridePrompt?: string) => {
    setError("");
    setSuccess("");
    setIsGenerating(true);
    setMediaAssetId(null);
    setPipelineLog(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: overridePrompt ?? prompt ?? undefined,
          multiple,
          language: language === "auto" ? undefined : language,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate content");
      }

      if (data.media_asset_id) {
        setMediaAssetId(data.media_asset_id);
      }
      if (data.pipeline_log) {
        setPipelineLog(data.pipeline_log);
      }

      if (multiple && data.suggestions) {
        setSuggestions(data.suggestions);
        setGeneratedContent("");
      } else if (data.content) {
        setGeneratedContent(data.content);
        setSuggestions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectSuggestion = (content: string) => {
    setGeneratedContent(content);
    setSuggestions([]);
  };

  const handleSelectTrend = (trendName: string) => {
    const trendFormatted = trendName.replace(/^#/, "").trim();
    setPrompt(`Use the trending topic "${trendFormatted}" as inspiration and connect it to my business to create a relevant post`);
  };

  const handleAutoGenerateFromTrends = async () => {
    if (trends.length === 0) return;
    const top3 = trends
      .slice(0, 3)
      .map((t) => `"${t.name.replace(/^#/, "").trim()}"`)
      .join(", ");
    const autoPrompt = `Here are today's top trending topics: ${top3}. Pick the most relevant one for my business, connect it naturally to my business context, and create an engaging post.`;
    setPrompt(autoPrompt);
    await handleGenerate(false, autoPrompt);
  };

  const handlePostNow = async () => {
    if (!generatedContent.trim()) {
      setError("No content to post");
      return;
    }
    if (!selectedAccountId) {
      setError("Please select an X account");
      return;
    }

    setIsPosting(true);
    setError("");

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: generatedContent,
          postImmediately: true,
          xAccountId: selectedAccountId,
          mediaAssetId: mediaAssetId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to post");
      }

      if (data.status === "posted") {
        setSuccess("Posted successfully!");
        setGeneratedContent("");
        setMediaAssetId(null);
        setPipelineLog(null);
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        throw new Error(data.error || "Post failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedule = () => {
    if (!generatedContent.trim()) return;
    if (!selectedAccountId) {
      setError("Please select an X account");
      return;
    }
    const params = new URLSearchParams({
      content: generatedContent,
      xAccountId: selectedAccountId,
    });
    if (mediaAssetId) {
      params.set("mediaAssetId", mediaAssetId);
    }
    router.push(`/schedule?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              AI Content Generator
            </h1>
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Generation Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generate Tweet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              AI will use your knowledge base to generate relevant content
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label
                  htmlFor="xAccount"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  X Account
                </label>
                <select
                  id="xAccount"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {accounts.length === 0 && (
                    <option value="">No account connected</option>
                  )}
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {(account.label ||
                        account.username ||
                        "Unnamed account") +
                        (account.isDefault ? " (Default)" : "")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1">
                <label
                  htmlFor="prompt"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Topic or Prompt (optional)
                </label>
                <input
                  type="text"
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., new product features, company news..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="sm:col-span-1">
                <label
                  htmlFor="language"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="English">English</option>
                  <option value="Chinese">中文 (Chinese)</option>
                  <option value="Japanese">日本語 (Japanese)</option>
                  <option value="Korean">한국어 (Korean)</option>
                  <option value="Spanish">Español (Spanish)</option>
                  <option value="French">Français (French)</option>
                  <option value="German">Deutsch (German)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleGenerate(false)}
                disabled={isGenerating}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? "Generating..." : "Generate Tweet"}
              </button>
              <button
                onClick={() => handleGenerate(true)}
                disabled={isGenerating}
                className="flex-1 px-6 py-3 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? "Generating..." : "Get 3 Suggestions"}
              </button>
            </div>
          </div>
        </div>

        {/* Trending Topics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  🔥 Trending Topics
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Click a trend to use it, or auto-generate from top 3
                </p>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={() => void handleAutoGenerateFromTrends()}
                  disabled={!canUseTrending || trends.length === 0 || loadingTrends || isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>⚡ Auto Generate</>
                  )}
                </button>
                <div className="w-px h-5 bg-gray-200 dark:bg-gray-600" />
                {(["global", "usa", "china", "africa"] as const).map((region) => (
                  <button
                    key={region}
                    onClick={() => {
                      setTrendRegion(region);
                      void fetchTrends(region);
                    }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      trendRegion === region
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {region === "global"
                      ? "🌍 Global"
                      : region === "usa"
                        ? "🇺🇸 USA"
                        : region === "china"
                          ? "🇨🇳 China"
                          : "🌍 Africa"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6">
            {!canUseTrending ? (
              <div className="text-center py-8">
                <p className="text-2xl mb-2">🔒</p>
                <p className="font-medium text-gray-700 dark:text-gray-300">Silver membership required</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Upgrade to Silver or above to access real-time trending news.
                </p>
                <a
                  href="/settings"
                  className="inline-block mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Upgrade Plan
                </a>
              </div>
            ) : loadingTrends ? (
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Loading trends...</span>
              </div>
            ) : trends.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {trends.map((trend) => (
                  <button
                    key={trend.name}
                    onClick={() => handleSelectTrend(trend.name)}
                    className="text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {trend.name.replace(/^#/, "")}
                    </p>
                    {trend.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {trend.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-6">
                <p>No trends available for this region</p>
                <button
                  onClick={() => void fetchTrends(trendRegion)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 mt-2"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Status */}
        {pipelineLog && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Agent Pipeline
              </h2>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {["database_manager", "author", "editor"].map((stage, i) => (
                  <div key={stage} className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        pipelineLog[stage]
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {pipelineLog[stage] && (
                        <svg
                          className="w-3 h-3"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      {stage === "database_manager"
                        ? "DB Manager"
                        : stage.charAt(0).toUpperCase() + stage.slice(1)}
                    </div>
                    {i < 2 && (
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  View pipeline details
                </summary>
                <div className="mt-3 space-y-2">
                  {Object.entries(pipelineLog).map(([stage, log]) => (
                    <div key={stage}>
                      <p className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {stage.replace("_", " ")}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs whitespace-pre-wrap">
                        {log}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Image Preview */}
        {mediaAssetId && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Attached Image
                </h2>
                <button
                  onClick={() => setMediaAssetId(null)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${mediaAssetId}`}
                alt="Selected product image"
                className="max-w-full max-h-64 rounded-lg border border-gray-200 dark:border-gray-700 object-contain mx-auto"
              />
            </div>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Choose a Suggestion
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <p className="text-gray-900 dark:text-white">{suggestion}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {suggestion.length} characters
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Content Editor */}
        {(generatedContent || suggestions.length === 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {generatedContent ? "Edit & Post" : "Generated Content"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  rows={4}
                  placeholder="Generated content will appear here. You can also type directly..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                />
                <div className="mt-2 flex justify-between items-center">
                  <span
                    className={`text-sm ${
                      charRemaining < 0
                        ? "text-red-500"
                        : charRemaining < 20
                          ? "text-yellow-500"
                          : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {charRemaining} characters remaining
                  </span>
                  {generatedContent && (
                    <button
                      onClick={() => handleGenerate(false)}
                      disabled={isGenerating}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-green-600 dark:text-green-400 text-sm">
                    {success}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePostNow}
                  disabled={
                    !generatedContent.trim() || charCount > 280 || isPosting
                  }
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPosting ? "Posting..." : "Post Now"}
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={!generatedContent.trim() || charCount > 280}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Edit & Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Knowledge Base Link */}
        <div className="mt-6 text-center">
          <Link
            href="/knowledge"
            className="text-sm text-blue-600 hover:underline"
          >
            Manage Knowledge Base Sources →
          </Link>
        </div>
      </main>
    </div>
  );
}
