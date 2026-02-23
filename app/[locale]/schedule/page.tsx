"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

function ScheduleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<
    { id: string; label: string | null; username: string | null; isDefault: boolean }[]
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [content, setContent] = useState("");
  const [scheduleType, setScheduleType] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  // Pre-fill content and mediaUrl from URL params (from AI generate page / toolbox)
  useEffect(() => {
    const prefillContent = searchParams.get("content");
    if (prefillContent) setContent(prefillContent);
    const prefillAccount = searchParams.get("xAccountId");
    if (prefillAccount) setSelectedAccountId(prefillAccount);
    const prefillMedia = searchParams.get("mediaUrl");
    if (prefillMedia) setMediaUrl(prefillMedia);
  }, [searchParams]);

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

  const charCount = content.length;
  const charRemaining = 280 - charCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!content.trim()) {
      setError("Please enter some content");
      return;
    }

    if (charCount > 280) {
      setError("Content exceeds 280 characters");
      return;
    }

    if (scheduleType === "later" && (!scheduledDate || !scheduledTime)) {
      setError("Please select a date and time");
      return;
    }

    if (!selectedAccountId) {
      setError("Please select an X account");
      return;
    }

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

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get minimum date/time (now)
  const now = new Date();
  const minDate = format(now, "yyyy-MM-dd");
  const minTime = format(now, "HH:mm");

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <label
            htmlFor="content"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Post Content
          </label>
          <textarea
            id="content"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
            placeholder="What's happening?"
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
          </div>
        </div>

        {/* Media Preview */}
        {mediaUrl && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Attached Image
              </label>
              <button
                type="button"
                onClick={() => setMediaUrl(null)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Remove
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
              X Account
            </label>
            <select
              id="xAccount"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {accounts.length === 0 && <option value="">No account connected</option>}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {(account.label || account.username || "Unnamed account") +
                    (account.isDefault ? " (Default)" : "")}
                </option>
              ))}
            </select>
          </div>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            When to post
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
              <span className="ml-3 text-gray-900 dark:text-white">
                Post immediately
              </span>
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
              <span className="ml-3 text-gray-900 dark:text-white">
                Schedule for later
              </span>
            </label>

            {scheduleType === "later" && (
              <div className="ml-7 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="date"
                    className="block text-sm text-gray-600 dark:text-gray-400 mb-1"
                  >
                    Date
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
                  <label
                    htmlFor="time"
                    className="block text-sm text-gray-600 dark:text-gray-400 mb-1"
                  >
                    Time
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

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-stretch sm:justify-end">
          <button
            type="submit"
            disabled={isSubmitting || charCount > 280}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting
              ? "Submitting..."
              : scheduleType === "now"
              ? "Post Now"
              : "Schedule Post"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function SchedulePage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Create Post
            </h1>
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
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
