import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const OPENAI_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
};

function estimateOpenAICostUsd(params: {
  model: string | null;
  promptTokens: number;
  completionTokens: number;
}) {
  const pricing = OPENAI_PRICING_USD_PER_1M[params.model ?? ""] ?? OPENAI_PRICING_USD_PER_1M["gpt-4o"];
  const inputCost = (params.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (params.completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readNumberByKeys(
  object: Record<string, unknown> | null | undefined,
  keys: string[]
): number | null {
  if (!object) return null;
  for (const key of keys) {
    const value = toNumber(object[key]);
    if (value !== null) return value;
  }
  return null;
}

async function fetchWavespeedUsage(rangeDays = 30) {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    return {
      enabled: false as const,
      error: "Missing WAVESPEED_API_KEY",
    };
  }

  const days = Math.max(1, Math.min(rangeDays, 31));
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const response = await fetch("https://api.wavespeed.ai/api/v3/user/usage_stats", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    }),
    signal: AbortSignal.timeout(15000),
  });

  const payload = (await response.json().catch(() => null)) as
    | { code?: number; message?: string; data?: Record<string, unknown> }
    | null;

  if (!response.ok || payload?.code !== 200 || !payload?.data) {
    return {
      enabled: true as const,
      available: false as const,
      rangeDays: days,
      error: payload?.message ?? `WaveSpeed usage error (${response.status})`,
    };
  }

  const summary = payload.data.summary as Record<string, unknown> | undefined;
  const perModel = Array.isArray(payload.data.per_model_usage)
    ? (payload.data.per_model_usage as Record<string, unknown>[])
    : [];

  return {
    enabled: true as const,
    available: true as const,
    rangeDays: days,
    summary: {
      totalRequests: readNumberByKeys(summary, ["total_requests", "request_count", "requests"]) ?? 0,
      totalTasks:
        readNumberByKeys(summary, ["total_tasks", "task_count", "success_requests"]) ?? 0,
      totalCostUsd:
        readNumberByKeys(summary, ["total_cost", "cost_usd", "total_cost_usd"]) ?? 0,
    },
    topModels: perModel.slice(0, 6).map((item) => ({
      model:
        (item.model_uuid as string | undefined) ??
        (item.model_name as string | undefined) ??
        (item.model as string | undefined) ??
        "unknown",
      requests: readNumberByKeys(item, [
        "requests",
        "request_count",
        "count",
        "total_count",
      ]) ?? 0,
      costUsd: readNumberByKeys(item, ["cost_usd", "total_cost", "cost"]) ?? 0,
    })),
  };
}

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/auth/login");
    }
    redirect("/dashboard");
  }

  const now = new Date();
  const nowTs = now.getTime();
  const since24h = new Date(nowTs - 24 * 60 * 60 * 1000);
  const since7d = new Date(nowTs - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(nowTs - 30 * 24 * 60 * 60 * 1000);

  const [
    runs24h,
    runs7d,
    success7d,
    failure7d,
    byJob30d,
    recentFailures,
    totalUsers,
    recurringUsers,
    activeSchedules,
    wavespeedUsage,
    openAiUsage30d,
    openAiByModel30d,
  ] = await Promise.all([
    prisma.cronRunEvent.count({ where: { createdAt: { gte: since24h } } }),
    prisma.cronRunEvent.count({ where: { createdAt: { gte: since7d } } }),
    prisma.cronRunEvent.count({
      where: { createdAt: { gte: since7d }, success: true },
    }),
    prisma.cronRunEvent.count({
      where: { createdAt: { gte: since7d }, success: false },
    }),
    prisma.cronRunEvent.groupBy({
      by: ["jobName"],
      where: { createdAt: { gte: since30d } },
      _count: { _all: true },
      _avg: { durationMs: true },
      orderBy: { _count: { jobName: "desc" } },
    }),
    prisma.cronRunEvent.findMany({
      where: { success: false },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        jobName: true,
        statusCode: true,
        error: true,
        triggeredBy: true,
        createdAt: true,
      },
    }),
    prisma.user.count(),
    prisma.recurringSchedule.findMany({
      where: { userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.recurringSchedule.count({ where: { isActive: true } }),
    fetchWavespeedUsage(30),
    prisma.usageEvent.aggregate({
      where: {
        provider: "openai",
        createdAt: { gte: since30d },
      },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      _count: { _all: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["model"],
      where: {
        provider: "openai",
        createdAt: { gte: since30d },
      },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      _count: { _all: true },
      orderBy: { _sum: { totalTokens: "desc" } },
      take: 8,
    }),
  ]);

  const successRate7d = runs7d > 0 ? (success7d / runs7d) * 100 : 0;
  const openAiPromptTokens30d = openAiUsage30d._sum.promptTokens ?? 0;
  const openAiCompletionTokens30d = openAiUsage30d._sum.completionTokens ?? 0;
  const openAiTotalTokens30d = openAiUsage30d._sum.totalTokens ?? 0;
  const openAiRequests30d = openAiUsage30d._count._all;
  const openAiCostUsd30d = estimateOpenAICostUsd({
    model: "gpt-4o",
    promptTokens: openAiPromptTokens30d,
    completionTokens: openAiCompletionTokens30d,
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <Link
            href="/dashboard"
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Runs (24h)" value={runs24h.toLocaleString()} />
          <Card title="Runs (7d)" value={runs7d.toLocaleString()} />
          <Card title="Success Rate (7d)" value={`${successRate7d.toFixed(1)}%`} />
          <Card title="Failures (7d)" value={failure7d.toLocaleString()} />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card title="Total Users" value={totalUsers.toLocaleString()} />
          <Card title="Recurring Users" value={recurringUsers.length.toLocaleString()} />
          <Card title="Active Schedules" value={activeSchedules.toLocaleString()} />
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              WaveSpeed Platform Usage (30d)
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {!wavespeedUsage.enabled ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                WAVESPEED_API_KEY is not configured.
              </p>
            ) : wavespeedUsage.available === false ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                Failed to load usage stats: {wavespeedUsage.error || "Unknown error"}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card title="WaveSpeed Requests" value={wavespeedUsage.summary.totalRequests.toLocaleString()} />
                  <Card title="WaveSpeed Tasks" value={wavespeedUsage.summary.totalTasks.toLocaleString()} />
                  <Card
                    title="WaveSpeed Cost (USD)"
                    value={`$${wavespeedUsage.summary.totalCostUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 4,
                    })}`}
                  />
                </div>
                {wavespeedUsage.topModels.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Top Models
                    </p>
                    {wavespeedUsage.topModels.map((item, index) => (
                      <div
                        key={`${item.model}-${index}`}
                        className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
                      >
                        <span className="text-gray-700 dark:text-gray-300 truncate pr-3">
                          {item.model}
                        </span>
                        <span className="text-gray-900 dark:text-white shrink-0">
                          {item.requests.toLocaleString()} req · ${item.costUsd.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              OpenAI Usage (30d)
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card title="OpenAI Requests" value={openAiRequests30d.toLocaleString()} />
              <Card title="Prompt Tokens" value={openAiPromptTokens30d.toLocaleString()} />
              <Card title="Completion Tokens" value={openAiCompletionTokens30d.toLocaleString()} />
              <Card title="Est. Cost (USD)" value={`$${openAiCostUsd30d.toFixed(4)}`} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cost uses configured model pricing (currently gpt-4o rates) based on tracked tokens.
            </p>

            {openAiByModel30d.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  By Model
                </p>
                {openAiByModel30d.map((item) => {
                  const promptTokens = item._sum.promptTokens ?? 0;
                  const completionTokens = item._sum.completionTokens ?? 0;
                  const estCost = estimateOpenAICostUsd({
                    model: item.model,
                    promptTokens,
                    completionTokens,
                  });
                  return (
                    <div
                      key={item.model ?? "unknown"}
                      className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate pr-3">
                        {item.model ?? "unknown"}
                      </span>
                      <span className="text-gray-900 dark:text-white shrink-0">
                        {(item._sum.totalTokens ?? 0).toLocaleString()} tokens · $
                        {estCost.toFixed(4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {openAiTotalTokens30d === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No OpenAI usage recorded in the last 30 days.
              </p>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Job Volume (Last 30 Days)
            </h2>
          </div>
          <div className="p-6">
            {byJob30d.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No runs logged yet.</p>
            ) : (
              <div className="space-y-3">
                {byJob30d.map((item) => (
                  <div
                    key={item.jobName}
                    className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3"
                  >
                    <p className="font-medium text-gray-900 dark:text-white">{item.jobName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {item._count._all.toLocaleString()} runs
                      {" · "}
                      avg {Math.round(item._avg.durationMs ?? 0)}ms
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Failures
            </h2>
          </div>
          <div className="p-6">
            {recentFailures.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No failures recorded.</p>
            ) : (
              <div className="space-y-3">
                {recentFailures.map((item) => (
                  <div
                    key={item.id}
                    className="border border-red-200 dark:border-red-900/50 rounded-lg px-4 py-3 bg-red-50/40 dark:bg-red-900/10"
                  >
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      {item.jobName} · {item.statusCode ?? "N/A"} · {item.triggeredBy ?? "unknown"}
                    </p>
                    <p className="text-sm text-red-700/90 dark:text-red-300/90 mt-1">
                      {item.error || "Unknown error"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
