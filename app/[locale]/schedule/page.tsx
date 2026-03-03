"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";

/* ------------------------------------------------------------------ */
/*  Single Post Form (with A/B Score + Hashtag Optimizer)             */
/* ------------------------------------------------------------------ */

function SinglePostForm({
  accounts,
  selectedAccountId,
  setSelectedAccountId,
}: {
  accounts: { id: string; label: string | null; username: string | null; isDefault: boolean }[];
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("schedule");
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";

  const [content, setContent] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  // A/B score
  const [score, setScore] = useState<number | null>(null);
  const [scoreReasoning, setScoreReasoning] = useState("");
  const [isScoring, setIsScoring] = useState(false);

  // Hashtag optimizer
  const [hashtagSuggestion, setHashtagSuggestion] = useState<string | null>(null);
  const [hashtagLoading, setHashtagLoading] = useState(false);

  useEffect(() => {
    const prefillContent = searchParams.get("content");
    if (prefillContent) setContent(prefillContent);
    const prefillAccount = searchParams.get("xAccountId");
    if (prefillAccount) setSelectedAccountId(prefillAccount);
    const prefillMedia = searchParams.get("mediaUrl");
    if (prefillMedia) setMediaUrl(prefillMedia);
  }, [searchParams, setSelectedAccountId]);

  const charCount = content.length;
  const charRemaining = 280 - charCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!content.trim()) { setError(t("errorContent")); return; }
    if (charCount > 280) { setError(t("errorLength")); return; }
    if (scheduleType === "later" && (!scheduledDate || !scheduledTime)) { setError(t("errorDateTime")); return; }
    if (!selectedAccountId) { setError(t("errorAccount")); return; }

    setIsSubmitting(true);
    try {
      let scheduledAt = null;
      if (scheduleType === "later") {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          postImmediately: scheduleType === "now",
          scheduledAt,
          xAccountId: selectedAccountId,
          ...(mediaUrl ? { mediaUrl } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create post");
      }
      router.push(`${prefix}/dashboard`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScore = async () => {
    if (content.length < 10) return;
    setIsScoring(true);
    setScore(null);
    setScoreReasoning("");
    try {
      const res = await fetch("/api/posts/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setScore(data.score ?? null);
      setScoreReasoning(data.reasoning ?? "");
    } catch {
      // silently fail
    } finally {
      setIsScoring(false);
    }
  };

  const handleHashtags = async () => {
    if (content.length < 10) return;
    setHashtagLoading(true);
    setHashtagSuggestion(null);
    try {
      const res = await fetch("/api/posts/optimize-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.content && data.content !== content) {
        setHashtagSuggestion(data.content);
      }
    } catch {
      // silently fail
    } finally {
      setHashtagLoading(false);
    }
  };

  const scoreColor =
    score !== null
      ? score >= 70
        ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
        : score >= 30
        ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
        : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
      : "";

  const now = new Date();
  const minDate = format(now, "yyyy-MM-dd");
  const minTime = format(now, "HH:mm");

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <label
          htmlFor="content"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          {t("content")}
        </label>
        <textarea
          id="content"
          rows={5}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setScore(null);
            setHashtagSuggestion(null);
          }}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
          placeholder={t("contentPlaceholder")}
        />
        <div className="mt-2 flex flex-wrap justify-between items-center gap-2">
          <span
            className={`text-sm ${
              charRemaining < 0
                ? "text-red-500"
                : charRemaining < 20
                ? "text-yellow-500"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {t("charsRemaining", { count: charRemaining })}
          </span>
          <div className="flex items-center gap-3">
            {/* A/B Score button */}
            <button
              type="button"
              onClick={handleScore}
              disabled={isScoring || content.length < 10}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isScoring ? t("scoring") : t("scorePost")}
            </button>
            {/* Hashtag button */}
            <button
              type="button"
              onClick={handleHashtags}
              disabled={hashtagLoading || content.length < 10}
              className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hashtagLoading ? t("hashtagLoading") : t("suggestHashtags")}
            </button>
          </div>
        </div>

        {/* Score result */}
        {score !== null && (
          <div className="mt-3 flex items-start gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${scoreColor}`}>
              {score}/100
            </span>
            {scoreReasoning && (
              <p className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                <span className="font-medium">{t("scoreFeedback")}:</span> {scoreReasoning}
              </p>
            )}
          </div>
        )}

        {/* Hashtag suggestion */}
        {hashtagSuggestion && (
          <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
            <p className="text-sm text-purple-800 dark:text-purple-200 whitespace-pre-wrap">
              {hashtagSuggestion}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setContent(hashtagSuggestion);
                  setHashtagSuggestion(null);
                }}
                className="text-sm font-medium text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100"
              >
                {t("hashtagApply")}
              </button>
              <button
                type="button"
                onClick={() => setHashtagSuggestion(null)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {t("hashtagDismiss")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Media Preview */}
      {mediaUrl && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("attachedImage")}
            </label>
            <button
              type="button"
              onClick={() => setMediaUrl(null)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              {t("remove")}
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt="Attached media"
            className="w-full rounded-lg max-h-64 object-contain border border-gray-200 dark:border-gray-700"
          />
        </div>
      )}

      {/* Schedule Options */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="mb-4">
          <label
            htmlFor="xAccount"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {t("xAccount")}
          </label>
          <select
            id="xAccount"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {accounts.length === 0 && <option value="">{t("noAccount")}</option>}
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {(account.label || account.username || "Unnamed account") +
                  (account.isDefault ? " (Default)" : "")}
              </option>
            ))}
          </select>
        </div>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          {t("whenToPost")}
        </label>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="scheduleType"
              value="now"
              checked={scheduleType === "now"}
              onChange={() => setScheduleType("now")}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-3 text-gray-900 dark:text-white">{t("postImmediately")}</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="scheduleType"
              value="later"
              checked={scheduleType === "later"}
              onChange={() => setScheduleType("later")}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-3 text-gray-900 dark:text-white">{t("scheduleLater")}</span>
          </label>

          {scheduleType === "later" && (
            <div className="ml-7 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t("date")}
                </label>
                <input
                  type="date"
                  id="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={minDate}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="time" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {t("time")}
                </label>
                <input
                  type="time"
                  id="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={scheduledDate === minDate ? minTime : undefined}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-stretch sm:justify-end">
        <button
          type="submit"
          disabled={isSubmitting || charCount > 280}
          className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? t("submitting") : scheduleType === "now" ? t("postNow") : t("schedulePost")}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Thread Form                                                       */
/* ------------------------------------------------------------------ */

function ThreadForm({
  accounts,
  selectedAccountId,
  setSelectedAccountId,
}: {
  accounts: { id: string; label: string | null; username: string | null; isDefault: boolean }[];
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
}) {
  const router = useRouter();
  const t = useTranslations("schedule");
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";

  const [prompt, setPrompt] = useState("");
  const [threadCount, setThreadCount] = useState(5);
  const [language, setLanguage] = useState("en");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [tweets, setTweets] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError("");
    setTweets([]);
    try {
      const res = await fetch("/api/posts/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          count: threadCount,
          language,
          postImmediately: false,
          xAccountId: selectedAccountId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate thread");
      }
      const data = await res.json();
      setTweets(data.tweets ?? data.posts?.map((p: { content: string }) => p.content) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePostThread = async () => {
    if (tweets.length === 0 || !selectedAccountId) return;
    setIsPosting(true);
    setError("");
    try {
      const res = await fetch("/api/posts/thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweets,
          postImmediately: true,
          xAccountId: selectedAccountId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to post thread");
      }
      router.push(`${prefix}/dashboard`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPosting(false);
    }
  };

  const updateTweet = (index: number, value: string) => {
    setTweets((prev) => prev.map((tw, i) => (i === index ? value : tw)));
  };

  return (
    <div className="space-y-6">
      {/* Thread prompt */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("threadPrompt")}
          </label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
            placeholder={t("threadPromptPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("threadLength")}
            </label>
            <select
              value={threadCount}
              onChange={(e) => setThreadCount(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {[3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {t("threadLengthTweets", { count: n })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("threadLanguage")}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("xAccount")}
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {accounts.length === 0 && <option value="">{t("noAccount")}</option>}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {(account.label || account.username || "Unnamed account") +
                    (account.isDefault ? " (Default)" : "")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? t("generatingThread") : t("generateThread")}
        </button>
      </div>

      {/* Thread preview */}
      {tweets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            {t("threadPreview")}
          </h3>
          <div className="space-y-4">
            {tweets.map((tweet, i) => (
              <div key={i} className="relative">
                {/* Thread connector line */}
                {i < tweets.length - 1 && (
                  <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-blue-200 dark:bg-blue-800 -mb-4" />
                )}
                <div className="flex gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={tweet}
                      onChange={(e) => updateTweet(i, e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p
                      className={`text-xs mt-1 ${tweet.length > 280 ? "text-red-500" : "text-gray-400 dark:text-gray-500"}`}
                    >
                      {tweet.length}/280
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handlePostThread}
              disabled={isPosting || !selectedAccountId}
              className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPosting ? t("submitting") : t("postThread")}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Combined Schedule Form with mode toggle                           */
/* ------------------------------------------------------------------ */

function ScheduleForm() {
  const t = useTranslations("schedule");
  const [mode, setMode] = useState<"single" | "thread">("single");
  const [accounts, setAccounts] = useState<
    { id: string; label: string | null; username: string | null; isDefault: boolean }[]
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  useEffect(() => {
    async function fetchAccounts() {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.accounts) ? data.accounts : [];
      setAccounts(list);
      if (list.length > 0) {
        const defaultAccount =
          list.find((a: { isDefault: boolean }) => a.isDefault) ?? list[0];
        setSelectedAccountId((prev) => prev || defaultAccount.id);
      }
    }
    void fetchAccounts();
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setMode("single")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "single"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          {t("singlePost")}
        </button>
        <button
          onClick={() => setMode("thread")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === "thread"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          {t("threadMode")}
        </button>
      </div>

      {mode === "single" ? (
        <SinglePostForm
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          setSelectedAccountId={setSelectedAccountId}
        />
      ) : (
        <ThreadForm
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          setSelectedAccountId={setSelectedAccountId}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function SchedulePage() {
  const t = useTranslations("schedule");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {t("title")}
            </h1>
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              {t("cancel")}
            </Link>
          </div>
        </div>
      </header>

      <Suspense
        fallback={
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="animate-pulse">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-48 mb-6"></div>
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg h-32"></div>
            </div>
          </div>
        }
      >
        <ScheduleForm />
      </Suspense>
    </div>
  );
}
