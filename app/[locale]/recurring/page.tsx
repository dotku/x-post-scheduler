"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";

interface RecurringSchedule {
  id: string;
  content: string;
  useAi: boolean;
  aiPrompt: string | null;
  imageModelId?: string | null;
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

const IMAGE_MODELS_IDS = [
  { id: "", labelKey: "noImageModel" },
  { id: "bytedance/seedream-v4.5", label: "Seedream 4.5" },
  { id: "bytedance/seedream-v4", label: "Seedream 4" },
  { id: "bytedance/dreamina-v3.1/text-to-image", label: "Dreamina 3.1" },
  { id: "wavespeed-ai/qwen-image/text-to-image", label: "Qwen Image" },
  { id: "alibaba/wan-2.6/text-to-image", label: "Wan 2.6 Image" },
];

export default function RecurringPage() {
  const t = useTranslations("recurring");
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";
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
  const [imageModelId, setImageModelId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  );
  const [time, setTime] = useState("09:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleContent, setSampleContent] = useState("");
  const [testingScheduleId, setTestingScheduleId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editAiPrompt, setEditAiPrompt] = useState("");
  const [editImageModelId, setEditImageModelId] = useState("");
  const [editFrequency, setEditFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [editTime, setEditTime] = useState("09:00");
  const [updatingScheduleId, setUpdatingScheduleId] = useState<string | null>(null);
  const [editError, setEditError] = useState("");
  const [scheduleTestResults, setScheduleTestResults] = useState<
    Record<string, { content?: string; error?: string; imageUrl?: string; imageError?: string }>
  >({});
  const [publishingScheduleId, setPublishingScheduleId] = useState<string | null>(null);
  const [publishResults, setPublishResults] = useState<
    Record<string, { success?: boolean; error?: string; tweetUrl?: string }>
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
        setError(t("errorContent"));
        return;
      }

      if (charCount > 280) {
        setError(t("errorLength"));
        return;
      }
    } else if (aiPrompt.length > 500) {
      setError(t("errorAiPrompt"));
      return;
    }

    if (!selectedAccountId) {
      setError(t("errorAccount"));
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
          imageModelId: imageModelId || undefined,
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
      setImageModelId("");
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
        setError(t("errorContent"));
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
    if (!confirm(t("deleteConfirm"))) return;

    await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    fetchSchedules();
  };

  const handleStartEdit = (schedule: RecurringSchedule) => {
    setEditError("");
    setEditingScheduleId(schedule.id);
    setEditAiPrompt(schedule.aiPrompt || "");
    setEditImageModelId(schedule.imageModelId || "");
    setEditFrequency(schedule.frequency as "daily" | "weekly" | "monthly");
    setEditTime(schedule.cronExpr);
  };

  const handleCancelEdit = () => {
    setEditingScheduleId(null);
    setEditAiPrompt("");
    setEditImageModelId("");
    setEditFrequency("daily");
    setEditTime("09:00");
    setEditError("");
  };

  const handleUpdateAiConfig = async (scheduleId: string) => {
    setEditError("");
    setUpdatingScheduleId(scheduleId);
    const schedule = schedules.find((s) => s.id === scheduleId);
    try {
      const patchBody: Record<string, unknown> = {
        frequency: editFrequency,
        cronExpr: editTime,
      };
      if (schedule?.useAi) {
        patchBody.aiPrompt = editAiPrompt;
        patchBody.imageModelId = editImageModelId;
      }
      const res = await fetch(`/api/recurring/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update schedule");
      }
      await fetchSchedules();
      handleCancelEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update schedule");
    } finally {
      setUpdatingScheduleId(null);
    }
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
        [id]: {
          content: data.content || "",
          imageUrl: data.imageUrl || undefined,
          imageError: data.imageError || undefined,
        },
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

  const handlePublishTestResult = async (scheduleId: string) => {
    const result = scheduleTestResults[scheduleId];
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!result?.content || !schedule) return;

    setPublishingScheduleId(scheduleId);
    setPublishResults((prev) => ({ ...prev, [scheduleId]: {} }));
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: result.content,
          postImmediately: true,
          xAccountId: schedule.xAccountId,
          ...(result.imageUrl ? { mediaUrl: result.imageUrl } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to publish");
      const tweetUrl = data.tweetId
        ? `https://x.com/i/web/status/${data.tweetId}`
        : undefined;
      setPublishResults((prev) => ({ ...prev, [scheduleId]: { success: true, tweetUrl } }));
    } catch (err) {
      setPublishResults((prev) => ({
        ...prev,
        [scheduleId]: { error: err instanceof Error ? err.message : "Failed to publish" },
      }));
    } finally {
      setPublishingScheduleId(null);
    }
  };

  const getModelLabel = (modelId: string) => {
    const model = IMAGE_MODELS_IDS.find((m) => m.id === modelId);
    if (!model) return modelId;
    if (model.labelKey) return t(model.labelKey as Parameters<typeof t>[0]);
    return model.label ?? modelId;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {t("title")}
            </h1>
            <Link
              href={`${prefix}/dashboard`}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              {t("backToDashboard")}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("currentBalance")}
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white break-all">
              ${(balanceCents / 100).toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("tokenUsage")}
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {recurringUsage.totalTokens.toLocaleString()} {t("tokens")}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {recurringUsage.requests.toLocaleString()} {t("requests")}
              {" · "}
              {t("promptIn")} {recurringUsage.promptTokens.toLocaleString()}
              {" · "}
              {t("completionOut")} {recurringUsage.completionTokens.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Create New Schedule */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("createTitle")}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label
                htmlFor="xAccountId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {t("xAccount")}
              </label>
              <select
                id="xAccountId"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("contentMode")}
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
                  {t("fixedContent")}
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="contentMode"
                    checked={useAi}
                    onChange={() => setUseAi(true)}
                    className="h-4 w-4 text-blue-600 border-gray-300"
                  />
                  {t("aiContent")}
                </label>
              </div>
            </div>

            {!useAi ? (
              <div>
                <label
                  htmlFor="content"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {t("postContent")}
                </label>
                <textarea
                  id="content"
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                  placeholder={t("contentPlaceholder")}
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
                  {t("charsRemaining", { count: charRemaining })}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="aiPrompt"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t("aiPrompt")}
                  </label>
                  <textarea
                    id="aiPrompt"
                    rows={3}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                    placeholder={t("aiPromptPlaceholder")}
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t("aiPromptHint")}
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="aiLanguage"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t("aiLanguage")}
                  </label>
                  <input
                    type="text"
                    id="aiLanguage"
                    value={aiLanguage}
                    onChange={(e) => setAiLanguage(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder={t("aiLanguagePlaceholder")}
                  />
                </div>
                <div>
                  <label
                    htmlFor="imageModelId"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    {t("imageModel")}
                  </label>
                  <select
                    id="imageModelId"
                    value={imageModelId}
                    onChange={(e) => setImageModelId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    {IMAGE_MODELS_IDS.map((model) => (
                      <option key={model.id || "none"} value={model.id}>
                        {model.labelKey ? t(model.labelKey as Parameters<typeof t>[0]) : model.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t("imageModelHint")}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="frequency"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {t("frequency")}
                </label>
                <select
                  id="frequency"
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value as "daily" | "weekly" | "monthly")
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="daily">{t("daily")}</option>
                  <option value="weekly">{t("weekly")}</option>
                  <option value="monthly">{t("monthly")}</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="time"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {t("time")}
                </label>
                <input
                  type="time"
                  id="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <div className="mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    {t("recommendedTimes")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "08:00", desc: "🌅" },
                      { label: "12:00", desc: "☀️" },
                      { label: "17:00", desc: "🌆" },
                      { label: "20:00", desc: "🌙" },
                    ].map(({ label, desc }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setTime(label)}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                          time === label
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600"
                        }`}
                      >
                        {desc} {label}
                      </button>
                    ))}
                  </div>
                </div>
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
                {isGeneratingSample ? t("generatingSample") : t("generateSample")}
              </button>
            </div>

            {sampleContent && (
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                  {t("sampleContent")}
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
                {isSubmitting ? t("saving") : t("saveTask")}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Schedules */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("yourSchedules")}
            </h2>
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              {t("loading")}
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {t("noSchedules")}
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
                        ? `${t("aiLabel")} ${schedule.aiPrompt ? `: ${schedule.aiPrompt}` : ""}`
                        : schedule.content}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        {schedule.useAi ? t("aiLabel") : t("fixedLabel")}
                      </span>
                      {schedule.imageModelId && (
                        <span>
                          {t("imageLabel")}{" "}
                          {getModelLabel(schedule.imageModelId)}
                        </span>
                      )}
                      <span className="capitalize">
                        {schedule.frequency === "daily" ? t("daily") : schedule.frequency === "weekly" ? t("weekly") : t("monthly")}
                      </span>
                      <span>{t("at")} {schedule.cronExpr}</span>
                      <span>
                        {t("nextLabel")} {format(new Date(schedule.nextRunAt), "PPp")}
                      </span>
                    </div>
                    {scheduleTestResults[schedule.id]?.content && (
                      <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                            {t("testOutput")}
                          </p>
                          <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                            {scheduleTestResults[schedule.id].content}
                          </p>
                        </div>
                        {scheduleTestResults[schedule.id].imageUrl && (
                          <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                              {t("generatedImage")}
                            </p>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={scheduleTestResults[schedule.id].imageUrl}
                              alt="Test generated image"
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-64 object-contain"
                            />
                          </div>
                        )}
                        {scheduleTestResults[schedule.id].imageError && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            {t("imageLabel")} {scheduleTestResults[schedule.id].imageError}
                          </p>
                        )}
                        <div className="flex items-center gap-3 pt-1">
                          {publishResults[schedule.id]?.success ? (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                {t("published")}
                              </p>
                              {publishResults[schedule.id]?.tweetUrl && (
                                <a
                                  href={publishResults[schedule.id].tweetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {t("viewOnX")}
                                </a>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handlePublishTestResult(schedule.id)}
                              disabled={publishingScheduleId === schedule.id}
                              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {publishingScheduleId === schedule.id ? t("publishing") : t("publishNow")}
                            </button>
                          )}
                          {publishResults[schedule.id]?.error && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {publishResults[schedule.id].error}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {scheduleTestResults[schedule.id]?.error && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {scheduleTestResults[schedule.id].error}
                      </p>
                    )}

                    {editingScheduleId === schedule.id && (
                      <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-3 bg-gray-50 dark:bg-gray-700/40">
                        {schedule.useAi && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                {t("aiPrompt")}
                              </label>
                              <textarea
                                rows={3}
                                value={editAiPrompt}
                                onChange={(e) => setEditAiPrompt(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                                placeholder={t("editAiPromptPlaceholder")}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                {t("imageModel")}
                              </label>
                              <select
                                value={editImageModelId}
                                onChange={(e) => setEditImageModelId(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              >
                                {IMAGE_MODELS_IDS.map((model) => (
                                  <option key={model.id || "none"} value={model.id}>
                                    {model.labelKey ? t(model.labelKey as Parameters<typeof t>[0]) : model.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                              {t("frequency")}
                            </label>
                            <select
                              value={editFrequency}
                              onChange={(e) => setEditFrequency(e.target.value as "daily" | "weekly" | "monthly")}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              <option value="daily">{t("daily")}</option>
                              <option value="weekly">{t("weekly")}</option>
                              <option value="monthly">{t("monthly")}</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                              {t("time")}
                            </label>
                            <input
                              type="time"
                              value={editTime}
                              onChange={(e) => setEditTime(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {["08:00", "12:00", "17:00", "20:00"].map((t_) => (
                                <button
                                  key={t_}
                                  type="button"
                                  onClick={() => setEditTime(t_)}
                                  className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${
                                    editTime === t_
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600"
                                  }`}
                                >
                                  {t_}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {editError && (
                          <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateAiConfig(schedule.id)}
                            disabled={updatingScheduleId === schedule.id}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {updatingScheduleId === schedule.id ? t("saving") : t("save")}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={updatingScheduleId === schedule.id}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {t("cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                      onClick={() =>
                        editingScheduleId === schedule.id
                          ? handleCancelEdit()
                          : handleStartEdit(schedule)
                      }
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {editingScheduleId === schedule.id ? t("closeEdit") : t("edit")}
                    </button>
                    <button
                      onClick={() => handleTestSchedule(schedule.id)}
                      disabled={testingScheduleId === schedule.id}
                      className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                    >
                      {testingScheduleId === schedule.id ? t("testing") : t("test")}
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
                      {t("delete")}
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
