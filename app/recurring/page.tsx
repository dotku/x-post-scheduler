"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

interface RecurringSchedule {
  id: string;
  content: string;
  useAi: boolean;
  aiPrompt: string | null;
  aiLanguage: string | null;
  xAccountId: string | null;
  frequency: string;
  cronExpr: string;
  nextRunAt: string;
  isActive: boolean;
  createdAt: string;
}

interface RecurringUsageSummary {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export default function RecurringPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [balanceCents, setBalanceCents] = useState(0);
  const [recurringUsage, setRecurringUsage] = useState<RecurringUsageSummary>({
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });
  const [accounts, setAccounts] = useState<
    { id: string; label: string | null; username: string | null; isDefault: boolean }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [content, setContent] = useState("");
  const [useAi, setUseAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLanguage, setAiLanguage] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  );
  const [time, setTime] = useState("09:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleContent, setSampleContent] = useState("");
  const [testingScheduleId, setTestingScheduleId] = useState<string | null>(null);
  const [scheduleTestResults, setScheduleTestResults] = useState<
    Record<string, { content?: string; error?: string }>
  >({});
  const [error, setError] = useState("");

  const charCount = content.length;
  const charRemaining = 280 - charCount;

  useEffect(() => {
    void fetchSchedules();
    void fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
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
  };

  const fetchSchedules = async () => {
    const res = await fetch("/api/recurring");
    if (!res.ok) {
      setIsLoading(false);
      return;
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      setSchedules(data);
      setBalanceCents(0);
      setRecurringUsage({
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    } else {
      setSchedules(Array.isArray(data.schedules) ? data.schedules : []);
      setBalanceCents(Number(data.balanceCents ?? 0));
      setRecurringUsage({
        requests: Number(data.usage?.requests ?? 0),
        promptTokens: Number(data.usage?.promptTokens ?? 0),
        completionTokens: Number(data.usage?.completionTokens ?? 0),
        totalTokens: Number(data.usage?.totalTokens ?? 0),
      });
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!useAi) {
      if (!content.trim()) {
        setError("Please enter some content");
        return;
      }

      if (charCount > 280) {
        setError("Content exceeds 280 characters");
        return;
      }
    } else if (aiPrompt.length > 500) {
      setError("AI prompt exceeds 500 characters");
      return;
    }

    if (!selectedAccountId) {
      setError("Please select an X account");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          useAi,
          aiPrompt: aiPrompt || undefined,
          aiLanguage: aiLanguage || undefined,
          xAccountId: selectedAccountId,
          frequency,
          cronExpr: time,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create schedule");
      }

      setContent("");
      setUseAi(false);
      setAiPrompt("");
      setAiLanguage("");
      setFrequency("daily");
      setTime("09:00");
      void fetchAccounts();
      fetchSchedules();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSample = async () => {
    setError("");
    setSampleContent("");

    if (!useAi) {
      if (!content.trim()) {
        setError("Please enter recurring content first");
        return;
      }
      setSampleContent(content.trim());
      return;
    }

    setIsGeneratingSample(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt || undefined,
          language: aiLanguage || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate sample");
      }

      setSampleContent(data.content || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate sample");
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    await fetch(`/api/recurring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentActive }),
    });
    fetchSchedules();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this schedule?")) return;

    await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    fetchSchedules();
  };

  const handleTestSchedule = async (id: string) => {
    setTestingScheduleId(id);
    setScheduleTestResults((prev) => ({ ...prev, [id]: {} }));

    try {
      const res = await fetch(`/api/recurring/${id}/test`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to test this schedule");
      }

      setScheduleTestResults((prev) => ({
        ...prev,
        [id]: { content: data.content || "" },
      }));
    } catch (err) {
      setScheduleTestResults((prev) => ({
        ...prev,
        [id]: {
          error: err instanceof Error ? err.message : "Failed to test schedule",
        },
      }));
    } finally {
      setTestingScheduleId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Recurring Posts
            </h1>
            <Link
              href="/"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Current Balance
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white break-all">
              ${(balanceCents / 100).toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Recurring Token Usage
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {recurringUsage.totalTokens.toLocaleString()} tokens
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {recurringUsage.requests.toLocaleString()} requests
              {" · "}
              In: {recurringUsage.promptTokens.toLocaleString()}
              {" · "}
              Out: {recurringUsage.completionTokens.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Create New Schedule */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create Recurring Schedule
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label
                htmlFor="xAccountId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                X Account
              </label>
              <select
                id="xAccountId"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content Mode
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="contentMode"
                    checked={!useAi}
                    onChange={() => setUseAi(false)}
                    className="h-4 w-4 text-blue-600 border-gray-300"
                  />
                  Fixed content
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="contentMode"
                    checked={useAi}
                    onChange={() => setUseAi(true)}
                    className="h-4 w-4 text-blue-600 border-gray-300"
                  />
                  AI-generated content
                </label>
              </div>
            </div>

            {!useAi ? (
              <div>
                <label
                  htmlFor="content"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Post Content
                </label>
                <textarea
                  id="content"
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  placeholder="What's happening?"
                />
                <p
                  className={`mt-1 text-sm ${
                    charRemaining < 0
                      ? "text-red-500"
                      : charRemaining < 20
                      ? "text-yellow-500"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {charRemaining} characters remaining
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="aiPrompt"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    AI Prompt (Optional)
                  </label>
                  <textarea
                    id="aiPrompt"
                    rows={3}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                    placeholder="Example: Promote today's top menu item with one hashtag."
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Leave empty to let AI choose the topic from your knowledge base.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="aiLanguage"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Language (Optional)
                  </label>
                  <input
                    type="text"
                    id="aiLanguage"
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Example: English or Chinese"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="frequency"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Frequency
                </label>
                <select
                  id="frequency"
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as "daily" | "weekly" | "monthly")
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="time"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Time
                </label>
                <input
                  type="time"
                  id="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleGenerateSample}
                disabled={isGeneratingSample}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
              >
                {isGeneratingSample ? "Generating sample..." : "Generate Sample"}
              </button>
            </div>

            {sampleContent && (
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  Sample Content
                </p>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {sampleContent}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || (!useAi && charCount > 280)}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Saving..." : "Save Task"}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Schedules */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Your Schedules
            </h2>
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No recurring schedules yet. Create one above!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 dark:text-white line-clamp-2">
                      {schedule.useAi
                        ? `AI generated${schedule.aiPrompt ? `: ${schedule.aiPrompt}` : ""}`
                        : schedule.content}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        {schedule.useAi ? "AI" : "Fixed"}
                      </span>
                      <span className="capitalize">{schedule.frequency}</span>
                      <span>at {schedule.cronExpr}</span>
                      <span>
                        Next: {format(new Date(schedule.nextRunAt), "PPp")}
                      </span>
                    </div>
                    {scheduleTestResults[schedule.id]?.content && (
                      <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                          Test Output
                        </p>
                        <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                          {scheduleTestResults[schedule.id].content}
                        </p>
                      </div>
                    )}
                    {scheduleTestResults[schedule.id]?.error && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {scheduleTestResults[schedule.id].error}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                      onClick={() => handleTestSchedule(schedule.id)}
                      disabled={testingScheduleId === schedule.id}
                      className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                    >
                      {testingScheduleId === schedule.id ? "Testing..." : "Test"}
                    </button>
                    <button
                      onClick={() => handleToggle(schedule.id, schedule.isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        schedule.isActive
                          ? "bg-blue-600"
                          : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          schedule.isActive ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
