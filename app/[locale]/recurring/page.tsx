"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import {
  HOURLY_FREQUENCIES,
  isTierAtLeast,
  TIER_ORDER,
  type TierKey,
} from "@/lib/subscription";

interface Trend {
  name: string;
  url?: string;
  description?: string;
}

interface RecurringSchedule {
  id: string;
  content: string;
  useAi: boolean;
  aiPrompt: string | null;
  imageModelId?: string | null;
  aiLanguage: string | null;
  trendRegion: string | null;
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

type ScheduleFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | keyof typeof HOURLY_FREQUENCIES;

const HOURLY_FREQUENCY_KEYS = Object.keys(HOURLY_FREQUENCIES) as Array<
  keyof typeof HOURLY_FREQUENCIES
>;

const FREQUENCY_OPTIONS: Array<{
  value: ScheduleFrequency;
  labelKey: string;
  minTier?: TierKey;
}> = [
  { value: "daily", labelKey: "daily" },
  { value: "weekly", labelKey: "weekly" },
  { value: "monthly", labelKey: "monthly" },
  {
    value: "every_12h",
    labelKey: "every12h",
    minTier: HOURLY_FREQUENCIES.every_12h.minTier,
  },
  {
    value: "every_6h",
    labelKey: "every6h",
    minTier: HOURLY_FREQUENCIES.every_6h.minTier,
  },
  {
    value: "every_4h",
    labelKey: "every4h",
    minTier: HOURLY_FREQUENCIES.every_4h.minTier,
  },
  {
    value: "every_2h",
    labelKey: "every2h",
    minTier: HOURLY_FREQUENCIES.every_2h.minTier,
  },
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
    {
      id: string;
      label: string | null;
      username: string | null;
      isDefault: boolean;
    }[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [content, setContent] = useState("");
  const [useAi] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLanguage, setAiLanguage] = useState("");
  const [imageModelId, setImageModelId] = useState("");
  const [trendRegion, setTrendRegion] = useState<
    "" | "global" | "usa" | "china" | "africa"
  >("");
  const [canUseTrending, setCanUseTrending] = useState(false);
  const [userTier, setUserTier] = useState<TierKey | null>(null);
  const [trendPreview, setTrendPreview] = useState<Trend[]>([]);
  const [trendPreviewLoading, setTrendPreviewLoading] = useState(false);
  const [trendPreviewError, setTrendPreviewError] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [time, setTime] = useState("09:00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleContent, setSampleContent] = useState("");
  const [testingScheduleId, setTestingScheduleId] = useState<string | null>(
    null,
  );
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [editAiPrompt, setEditAiPrompt] = useState("");
  const [editImageModelId, setEditImageModelId] = useState("");
  const [editTrendRegion, setEditTrendRegion] = useState<
    "" | "global" | "usa" | "china" | "africa"
  >("");
  const [editTrendPreview, setEditTrendPreview] = useState<Trend[]>([]);
  const [editTrendPreviewLoading, setEditTrendPreviewLoading] = useState(false);
  const [editTrendPreviewError, setEditTrendPreviewError] = useState("");
  const [editSampleContent, setEditSampleContent] = useState("");
  const [isGeneratingEditSample, setIsGeneratingEditSample] = useState(false);
  const [editFrequency, setEditFrequency] =
    useState<ScheduleFrequency>("daily");
  const [editTime, setEditTime] = useState("09:00");
  const [updatingScheduleId, setUpdatingScheduleId] = useState<string | null>(
    null,
  );
  const [editError, setEditError] = useState("");
  const [scheduleTestResults, setScheduleTestResults] = useState<
    Record<
      string,
      {
        content?: string;
        error?: string;
        imageUrl?: string;
        imageError?: string;
      }
    >
  >({});
  const [publishingScheduleId, setPublishingScheduleId] = useState<
    string | null
  >(null);
  const [publishResults, setPublishResults] = useState<
    Record<string, { success?: boolean; error?: string; tweetUrl?: string }>
  >({});
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchSchedules();
    void fetchAccounts();
    void (async () => {
      const res = await fetch("/api/me/subscription");
      if (!res.ok) return;
      const sub = await res.json();
      const activeTier =
        sub.status === "active" && TIER_ORDER.includes(sub.tier)
          ? (sub.tier as TierKey)
          : null;
      setUserTier(activeTier);
      setCanUseTrending(
        activeTier ? isTierAtLeast(activeTier, "silver") : false,
      );
    })();
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

    if (aiPrompt.length > 500) {
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
          trendRegion: trendRegion || undefined,
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
      setAiPrompt("");
      setAiLanguage("");
      setImageModelId("");
      setTrendRegion("");
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
      setError(
        err instanceof Error ? err.message : "Failed to generate sample",
      );
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
    setEditTrendRegion(
      (schedule.trendRegion as "" | "global" | "usa" | "china" | "africa") ||
        "",
    );
    setEditTrendPreview([]);
    setEditTrendPreviewError("");
    setEditSampleContent("");
    const nextFrequency = isScheduleFrequency(schedule.frequency)
      ? schedule.frequency
      : "daily";
    setEditFrequency(nextFrequency);
    setEditTime(schedule.cronExpr);
  };

  const handleCancelEdit = () => {
    setEditingScheduleId(null);
    setEditAiPrompt("");
    setEditImageModelId("");
    setEditTrendRegion("");
    setEditTrendPreview([]);
    setEditTrendPreviewError("");
    setEditSampleContent("");
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
        patchBody.trendRegion = editTrendRegion || null;
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
      setEditError(
        err instanceof Error ? err.message : "Failed to update schedule",
      );
    } finally {
      setUpdatingScheduleId(null);
    }
  };

  const handleTestSchedule = async (id: string, trendName?: string) => {
    setTestingScheduleId(id);
    setScheduleTestResults((prev) => ({ ...prev, [id]: {} }));

    try {
      const res = await fetch(`/api/recurring/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trendName ? { trendName } : {}),
      });
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
      setPublishResults((prev) => ({
        ...prev,
        [scheduleId]: { success: true, tweetUrl },
      }));
    } catch (err) {
      setPublishResults((prev) => ({
        ...prev,
        [scheduleId]: {
          error: err instanceof Error ? err.message : "Failed to publish",
        },
      }));
    } finally {
      setPublishingScheduleId(null);
    }
  };

  const handleGenerateFromTrends = async () => {
    if (trendPreview.length === 0) return;
    setError("");
    setSampleContent("");
    setIsGeneratingSample(true);
    try {
      // 随机选 1 条
      const randomIndex = Math.floor(Math.random() * trendPreview.length);
      const picked = trendPreview[randomIndex];
      const trendContext = `Today's trending news: "${picked.name}". Connect this topic naturally to my business context and create an engaging post.`;
      const combinedPrompt = aiPrompt
        ? `${trendContext} Additional direction: ${aiPrompt}`
        : trendContext;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: combinedPrompt,
          language: aiLanguage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setSampleContent(data.content || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const fetchTrendPreview = async (region: string) => {
    if (!region) {
      setTrendPreview([]);
      setTrendPreviewError("");
      return;
    }
    setTrendPreviewLoading(true);
    setTrendPreviewError("");
    setTrendPreview([]);
    try {
      const res = await fetch(`/api/trending?region=${region}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTrendPreviewError(data.error || `HTTP ${res.status}`);
      } else {
        setTrendPreview(data.trends ?? []);
      }
    } catch (e) {
      setTrendPreviewError(
        e instanceof Error ? e.message : "Failed to fetch trends",
      );
    } finally {
      setTrendPreviewLoading(false);
    }
  };

  const fetchEditTrendPreview = async (region: string) => {
    if (!region) {
      setEditTrendPreview([]);
      setEditTrendPreviewError("");
      return;
    }
    setEditTrendPreviewLoading(true);
    setEditTrendPreviewError("");
    setEditTrendPreview([]);
    try {
      const res = await fetch(`/api/trending?region=${region}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setEditTrendPreviewError(data.error || `HTTP ${res.status}`);
      } else {
        setEditTrendPreview(data.trends ?? []);
      }
    } catch (e) {
      setEditTrendPreviewError(
        e instanceof Error ? e.message : "Failed to fetch trends",
      );
    } finally {
      setEditTrendPreviewLoading(false);
    }
  };

  const handleGenerateFromEditTrends = async () => {
    if (editTrendPreview.length === 0) return;
    setEditSampleContent("");
    setIsGeneratingEditSample(true);
    try {
      const randomIndex = Math.floor(Math.random() * editTrendPreview.length);
      const picked = editTrendPreview[randomIndex];
      const trendContext = `Today's trending news: "${picked.name}". Connect this topic naturally to my business context and create an engaging post.`;
      const combinedPrompt = editAiPrompt
        ? `${trendContext} Additional direction: ${editAiPrompt}`
        : trendContext;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: combinedPrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setEditSampleContent(data.content || "");
    } catch (err) {
      setEditTrendPreviewError(
        err instanceof Error ? err.message : "Failed to generate",
      );
    } finally {
      setIsGeneratingEditSample(false);
    }
  };

  const getModelLabel = (modelId: string) => {
    const model = IMAGE_MODELS_IDS.find((m) => m.id === modelId);
    if (!model) return modelId;
    if (model.labelKey) return t(model.labelKey as Parameters<typeof t>[0]);
    return model.label ?? modelId;
  };

  const isHourlyFrequency = (
    value: string,
  ): value is keyof typeof HOURLY_FREQUENCIES =>
    HOURLY_FREQUENCY_KEYS.includes(value as keyof typeof HOURLY_FREQUENCIES);

  const isScheduleFrequency = (value: string): value is ScheduleFrequency =>
    value === "daily" ||
    value === "weekly" ||
    value === "monthly" ||
    isHourlyFrequency(value);

  const canUseFrequencyOption = (value: ScheduleFrequency) => {
    if (!isHourlyFrequency(value)) return true;
    const requiredTier = HOURLY_FREQUENCIES[value].minTier;
    return userTier ? isTierAtLeast(userTier, requiredTier) : false;
  };

  const getFrequencyLabel = (value: string) => {
    switch (value) {
      case "daily":
        return t("daily");
      case "weekly":
        return t("weekly");
      case "monthly":
        return t("monthly");
      case "every_12h":
        return t("every12h");
      case "every_6h":
        return t("every6h");
      case "every_4h":
        return t("every4h");
      case "every_2h":
        return t("every2h");
      default:
        return value;
    }
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
              {t("completionOut")}{" "}
              {recurringUsage.completionTokens.toLocaleString()}
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
                {accounts.length === 0 && (
                  <option value="">{t("noAccount")}</option>
                )}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {(account.label || account.username || "Unnamed account") +
                      (account.isDefault ? " (Default)" : "")}
                  </option>
                ))}
              </select>
            </div>

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
              {/* Trending Region */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  🔥 Auto Trending News
                  {!canUseTrending && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      Silver+
                    </span>
                  )}
                </label>
                {!canUseTrending ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    🔒 Upgrade to{" "}
                    <a
                      href="/settings"
                      className="text-blue-600 dark:text-blue-400 underline"
                    >
                      Silver or above
                    </a>{" "}
                    to auto-generate posts from trending news.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {(["", "global", "usa", "china", "africa"] as const).map(
                        (r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              setTrendRegion(r);
                              void fetchTrendPreview(r);
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              trendRegion === r
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                            }`}
                          >
                            {r === ""
                              ? "Off"
                              : r === "global"
                                ? "🌍 Global"
                                : r === "usa"
                                  ? "🇺🇸 USA"
                                  : r === "china"
                                    ? "🇨🇳 China"
                                    : "🌍 Africa"}
                          </button>
                        ),
                      )}
                      {trendRegion && (
                        <button
                          type="button"
                          onClick={() => void fetchTrendPreview(trendRegion)}
                          className="px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                          ↻ Refresh
                        </button>
                      )}
                    </div>
                    {trendRegion && (
                      <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                        Each run will fetch today&apos;s top 3 news from{" "}
                        {trendRegion === "global"
                          ? "Global"
                          : trendRegion.toUpperCase()}{" "}
                        and generate a post connecting them to your business.
                      </p>
                    )}

                    {/* Trending preview list */}
                    {trendRegion && (
                      <div className="mt-2">
                        {trendPreviewLoading && (
                          <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                            <svg
                              className="animate-spin h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Loading trending topics...
                          </div>
                        )}
                        {trendPreviewError && (
                          <p className="text-xs text-red-500 dark:text-red-400 py-1">
                            ❌ {trendPreviewError}
                          </p>
                        )}
                        {!trendPreviewLoading && trendPreview.length > 0 && (
                          <div className="space-y-1.5 mt-1">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              {trendPreview.length} current trending topics:
                            </p>
                            {trendPreview.slice(0, 10).map((trend, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700"
                              >
                                <span className="text-xs font-mono text-gray-400 mt-0.5 w-4 shrink-0">
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 dark:text-white leading-snug">
                                    {trend.name}
                                  </p>
                                  {trend.description && (
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {trend.description}
                                    </p>
                                  )}
                                </div>
                                {trend.url && (
                                  <a
                                    href={trend.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-500 hover:underline shrink-0"
                                  >
                                    ↗
                                  </a>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={handleGenerateFromTrends}
                              disabled={isGeneratingSample}
                              className="mt-2 w-full px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                            >
                              {isGeneratingSample ? (
                                <>
                                  <svg
                                    className="animate-spin h-3 w-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                  Generating...
                                </>
                              ) : (
                                "⚡ Generate from 1 Random Trend"
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
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
                      {model.labelKey
                        ? t(model.labelKey as Parameters<typeof t>[0])
                        : model.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("imageModelHint")}
                </p>
              </div>
            </div>

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
                    setFrequency(e.target.value as ScheduleFrequency)
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {FREQUENCY_OPTIONS.map((option) => {
                    const unlocked = canUseFrequencyOption(option.value);
                    const minTierText = option.minTier
                      ? ` (${option.minTier.toUpperCase()}+)`
                      : "";
                    return (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={!unlocked}
                      >
                        {t(option.labelKey as Parameters<typeof t>[0])}
                        {!unlocked ? minTierText : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t("hourlyFrequencyHint")}
                </p>
              </div>
              <div>
                <label
                  htmlFor="time"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  {t("time")}
                </label>
                {isHourlyFrequency(frequency) ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                    {t("hourlyNoTimeNeeded")}
                  </p>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleGenerateSample}
                disabled={isGeneratingSample}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
              >
                {isGeneratingSample
                  ? t("generatingSample")
                  : t("generateSample")}
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
                disabled={isSubmitting}
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
                        ? `${t("aiLabel")}${schedule.trendRegion ? ` 🔥 ${schedule.trendRegion.toUpperCase()}` : ""}${schedule.aiPrompt ? `: ${schedule.aiPrompt}` : ""}`
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
                        {getFrequencyLabel(schedule.frequency)}
                      </span>
                      {!isHourlyFrequency(schedule.frequency) && (
                        <span>
                          {t("at")} {schedule.cronExpr}
                        </span>
                      )}
                      <span>
                        {t("nextLabel")}{" "}
                        {format(new Date(schedule.nextRunAt), "PPp")}
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
                            {t("imageLabel")}{" "}
                            {scheduleTestResults[schedule.id].imageError}
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
                              onClick={() =>
                                handlePublishTestResult(schedule.id)
                              }
                              disabled={publishingScheduleId === schedule.id}
                              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {publishingScheduleId === schedule.id
                                ? t("publishing")
                                : t("publishNow")}
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
                                onChange={(e) =>
                                  setEditAiPrompt(e.target.value)
                                }
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
                                onChange={(e) =>
                                  setEditImageModelId(e.target.value)
                                }
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              >
                                {IMAGE_MODELS_IDS.map((model) => (
                                  <option
                                    key={model.id || "none"}
                                    value={model.id}
                                  >
                                    {model.labelKey
                                      ? t(
                                          model.labelKey as Parameters<
                                            typeof t
                                          >[0],
                                        )
                                      : model.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {/* Trending region for edit */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                🔥 Auto Trending News
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {(
                                  [
                                    "",
                                    "global",
                                    "usa",
                                    "china",
                                    "africa",
                                  ] as const
                                ).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => {
                                      setEditTrendRegion(r);
                                      void fetchEditTrendPreview(r);
                                    }}
                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                      editTrendRegion === r
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    }`}
                                  >
                                    {r === ""
                                      ? "Off"
                                      : r === "global"
                                        ? "🌍 Global"
                                        : r === "usa"
                                          ? "🇺🇸 USA"
                                          : r === "china"
                                            ? "🇨🇳 China"
                                            : "🌍 Africa"}
                                  </button>
                                ))}
                                {editTrendRegion && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void fetchEditTrendPreview(
                                        editTrendRegion,
                                      )
                                    }
                                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 transition-colors"
                                  >
                                    ↻
                                  </button>
                                )}
                              </div>
                              {editTrendPreviewLoading && (
                                <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-2">
                                  <svg
                                    className="animate-spin h-3 w-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                  Loading...
                                </div>
                              )}
                              {editTrendPreviewError && (
                                <p className="text-xs text-red-500 mt-1">
                                  ❌ {editTrendPreviewError}
                                </p>
                              )}
                              {!editTrendPreviewLoading &&
                                editTrendPreview.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-xs text-gray-400">
                                      {editTrendPreview.length} trending topics:
                                    </p>
                                    {editTrendPreview
                                      .slice(0, 8)
                                      .map((trend, i) => (
                                        <div
                                          key={i}
                                          className="flex items-start gap-1.5 px-2.5 py-1.5 rounded bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                                        >
                                          <span className="text-xs font-mono text-gray-400 shrink-0 w-3.5 mt-0.5">
                                            {i + 1}
                                          </span>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-900 dark:text-white leading-snug">
                                              {trend.name}
                                            </p>
                                            {trend.description && (
                                              <p className="text-xs text-gray-400">
                                                {trend.description}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {trend.url && (
                                              <a
                                                href={trend.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-500 hover:underline"
                                              >
                                                ↗
                                              </a>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                void handleTestSchedule(
                                                  editingScheduleId!,
                                                  trend.name,
                                                )
                                              }
                                              disabled={
                                                testingScheduleId ===
                                                editingScheduleId
                                              }
                                              className="px-1.5 py-0.5 text-xs rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 disabled:opacity-40 transition-colors"
                                              title="Full test with this trending topic"
                                            >
                                              {testingScheduleId ===
                                              editingScheduleId
                                                ? "…"
                                                : "⚡Test"}
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    <button
                                      type="button"
                                      onClick={handleGenerateFromEditTrends}
                                      disabled={isGeneratingEditSample}
                                      className="mt-1 w-full px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                                    >
                                      {isGeneratingEditSample ? (
                                        <>
                                          <svg
                                            className="animate-spin h-3 w-3"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                          >
                                            <circle
                                              className="opacity-25"
                                              cx="12"
                                              cy="12"
                                              r="10"
                                              stroke="currentColor"
                                              strokeWidth="4"
                                            />
                                            <path
                                              className="opacity-75"
                                              fill="currentColor"
                                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            />
                                          </svg>
                                          Generating...
                                        </>
                                      ) : (
                                        "⚡ Generate from 1 Random Trend"
                                      )}
                                    </button>
                                    {editSampleContent && (
                                      <div className="mt-2 p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600">
                                        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
                                          Preview
                                        </p>
                                        <p className="text-xs text-gray-900 dark:text-white whitespace-pre-wrap">
                                          {editSampleContent}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
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
                              onChange={(e) =>
                                setEditFrequency(
                                  e.target.value as ScheduleFrequency,
                                )
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              {FREQUENCY_OPTIONS.map((option) => {
                                const unlocked = canUseFrequencyOption(
                                  option.value,
                                );
                                const minTierText = option.minTier
                                  ? ` (${option.minTier.toUpperCase()}+)`
                                  : "";
                                return (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                    disabled={!unlocked}
                                  >
                                    {t(
                                      option.labelKey as Parameters<
                                        typeof t
                                      >[0],
                                    )}
                                    {!unlocked ? minTierText : ""}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                              {t("time")}
                            </label>
                            {isHourlyFrequency(editFrequency) ? (
                              <p className="text-xs text-gray-500 dark:text-gray-400 py-2">
                                {t("hourlyNoTimeNeeded")}
                              </p>
                            ) : (
                              <>
                                <input
                                  type="time"
                                  value={editTime}
                                  onChange={(e) => setEditTime(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {["08:00", "12:00", "17:00", "20:00"].map(
                                    (t_) => (
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
                                    ),
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {editError && (
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {editError}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateAiConfig(schedule.id)}
                            disabled={updatingScheduleId === schedule.id}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {updatingScheduleId === schedule.id
                              ? t("saving")
                              : t("save")}
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
                      {editingScheduleId === schedule.id
                        ? t("closeEdit")
                        : t("edit")}
                    </button>
                    <button
                      onClick={() => handleTestSchedule(schedule.id)}
                      disabled={testingScheduleId === schedule.id}
                      className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                    >
                      {testingScheduleId === schedule.id
                        ? t("testing")
                        : t("test")}
                    </button>
                    <button
                      onClick={() =>
                        handleToggle(schedule.id, schedule.isActive)
                      }
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
