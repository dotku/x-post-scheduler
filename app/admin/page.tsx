import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { getWavespeedFeeCents } from "@/lib/credits";

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

function toCountNumber(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return Number(value);
  return value ?? 0;
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

function isMissingWebVisitRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; meta?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const meta = JSON.stringify(candidate.meta ?? {});
  return (
    message.includes("42P01") ||
    message.includes('relation "WebVisit" does not exist') ||
    meta.includes("42P01")
  );
}

function inferWavespeedMediaType(modelId: string): "image" | "video" {
  const id = modelId.toLowerCase();
  if (
    id.includes("video") ||
    id.includes("/t2v") ||
    id.includes("/i2v") ||
    id.includes("seedance")
  ) {
    return "video";
  }
  return "image";
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
    wavespeedByModel30d,
    revenue24hAgg,
    revenue30dAgg,
    revenueAllTimeAgg,
    payingUsers30d,
    payingUsersAllTime,
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
    prisma.usageEvent.groupBy({
      by: ["model"],
      where: {
        provider: "wavespeed",
        createdAt: { gte: since30d },
      },
      _count: { _all: true },
      orderBy: { _count: { model: "desc" } },
      take: 50,
    }),
    prisma.creditTransaction.aggregate({
      where: {
        type: "topup",
        amountCents: { gt: 0 },
        createdAt: { gte: since24h },
      },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.creditTransaction.aggregate({
      where: {
        type: "topup",
        amountCents: { gt: 0 },
        createdAt: { gte: since30d },
      },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.creditTransaction.aggregate({
      where: {
        type: "topup",
        amountCents: { gt: 0 },
      },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.creditTransaction.findMany({
      where: {
        type: "topup",
        amountCents: { gt: 0 },
        createdAt: { gte: since30d },
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.creditTransaction.findMany({
      where: {
        type: "topup",
        amountCents: { gt: 0 },
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
  ]);

  let webVisits24h = 0;
  let webVisits30d = 0;
  let topPages30d: Array<{ path: string; visits: bigint }> = [];
  try {
    const hasWebVisitTable = await prisma.$queryRaw<Array<{ exists: string | null }>>`
      SELECT to_regclass('public."WebVisit"')::text AS exists
    `;
    if (hasWebVisitTable[0]?.exists) {
      const [webVisits24hResult, webVisits30dResult, topPages] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "WebVisit"
          WHERE "createdAt" >= ${since24h}
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "WebVisit"
          WHERE "createdAt" >= ${since30d}
        `,
        prisma.$queryRaw<Array<{ path: string; visits: bigint }>>`
          SELECT "path", COUNT(*)::bigint AS visits
          FROM "WebVisit"
          WHERE "createdAt" >= ${since30d}
          GROUP BY "path"
          ORDER BY visits DESC
          LIMIT 10
        `,
      ]);
      webVisits24h = toCountNumber(webVisits24hResult[0]?.count);
      webVisits30d = toCountNumber(webVisits30dResult[0]?.count);
      topPages30d = topPages;
    }
  } catch (error) {
    if (!isMissingWebVisitRelationError(error)) {
      console.error("Failed to load Website Traffic stats:", error);
    }
  }
  const revenue24hCents = revenue24hAgg._sum.amountCents ?? 0;
  const revenue30dCents = revenue30dAgg._sum.amountCents ?? 0;
  const revenueAllTimeCents = revenueAllTimeAgg._sum.amountCents ?? 0;
  const payingUsers30dCount = payingUsers30d.length;
  const payingUsersAllTimeCount = payingUsersAllTime.length;
  const arppu30dCents = payingUsers30dCount > 0 ? Math.round(revenue30dCents / payingUsers30dCount) : 0;
  const openAiPromptTokens30d = openAiUsage30d._sum.promptTokens ?? 0;
  const openAiCompletionTokens30d = openAiUsage30d._sum.completionTokens ?? 0;
  const openAiCharge30dCents = Math.max(
    1,
    Math.ceil(
      ((openAiPromptTokens30d / 1_000_000) * 250 + (openAiCompletionTokens30d / 1_000_000) * 1000) *
        60
    )
  );
  const wavespeedCharge30dCents = (wavespeedByModel30d as Array<{ model: string | null; _count: { _all: number } }>).reduce((sum, row) => {
    const modelId = row.model ?? "";
    if (!modelId) return sum;
    const fee = getWavespeedFeeCents(modelId, inferWavespeedMediaType(modelId));
    return sum + fee * row._count._all;
  }, 0);
  const usageBilled30dCents = openAiCharge30dCents + wavespeedCharge30dCents;
  const usageRunRatePerDayCents = usageBilled30dCents / 30;
  const estRevenue7dCents = Math.round(usageRunRatePerDayCents * 7);
  const estRevenue30dCents = Math.round(usageRunRatePerDayCents * 30);
  const estRevenue90dCents = Math.round(usageRunRatePerDayCents * 90);
  const estRevenue12mCents = Math.round(usageRunRatePerDayCents * 365);
  const promoCostPerUserCents = 500;
  const promoCostTotalCents = totalUsers * promoCostPerUserCents;

  const successRate7d = runs7d > 0 ? (success7d / runs7d) * 100 : 0;
  const openAiTotalTokens30d = openAiUsage30d._sum.totalTokens ?? 0;
  const openAiRequests30d = openAiUsage30d._count._all;
  const openAiCostUsd30d = estimateOpenAICostUsd({
    model: "gpt-4o",
    promptTokens: openAiPromptTokens30d,
    completionTokens: openAiCompletionTokens30d,
  });
  const wavespeedCostUsd30d =
    wavespeedUsage.enabled && wavespeedUsage.available ? wavespeedUsage.summary.totalCostUsd : 0;
  const estimatedCost30dCents = Math.round((openAiCostUsd30d + wavespeedCostUsd30d) * 100);
  const costRunRatePerDayCents = estimatedCost30dCents / 30;
  const estCost7dCents = Math.round(costRunRatePerDayCents * 7);
  const estCost30dCents = Math.round(costRunRatePerDayCents * 30);
  const estCost90dCents = Math.round(costRunRatePerDayCents * 90);
  const estCost12mCents = Math.round(costRunRatePerDayCents * 365);
  const operatingProfit7dCents = estRevenue7dCents - Math.round(costRunRatePerDayCents * 7);
  const operatingProfit30dCents = estRevenue30dCents - Math.round(costRunRatePerDayCents * 30);
  const operatingProfit90dCents = estRevenue90dCents - Math.round(costRunRatePerDayCents * 90);
  const operatingProfit12mCents = estRevenue12mCents - Math.round(costRunRatePerDayCents * 365);
  const estProfit7dCents =
    estRevenue7dCents - Math.round(costRunRatePerDayCents * 7) - promoCostTotalCents;
  const estProfit30dCents =
    estRevenue30dCents - Math.round(costRunRatePerDayCents * 30) - promoCostTotalCents;
  const estProfit90dCents =
    estRevenue90dCents - Math.round(costRunRatePerDayCents * 90) - promoCostTotalCents;
  const estProfit12mCents =
    estRevenue12mCents - Math.round(costRunRatePerDayCents * 365) - promoCostTotalCents;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
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
              Website Traffic
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card title="Pageviews (24h)" value={webVisits24h.toLocaleString()} />
              <Card title="Pageviews (30d)" value={webVisits30d.toLocaleString()} />
            </div>
            {topPages30d.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Top Pages (30d)
                </p>
                {topPages30d.map((row: { path: string; visits: bigint }) => (
                  <div
                    key={row.path}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
                  >
                    <span className="text-gray-700 dark:text-gray-300 truncate pr-3">
                      {row.path}
                    </span>
                    <span className="text-gray-900 dark:text-white shrink-0">
                      {toCountNumber(row.visits).toLocaleString()} visits
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Revenue
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card title="Revenue (24h)" value={`$${(revenue24hCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              <Card title="Revenue (30d)" value={`$${(revenue30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              <Card title="Revenue (All-time)" value={`$${(revenueAllTimeCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
              <Card title="ARPPU (30d)" value={`$${(arppu30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card title="Paying Users (30d)" value={payingUsers30dCount.toLocaleString()} />
              <Card title="Paying Users (All-time)" value={payingUsersAllTimeCount.toLocaleString()} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Revenue is based on successful credit top-ups (`CreditTransaction.type = topup`).
            </p>
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Revenue Estimate (Assume All Usage Is Paid)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                  title="Estimate (7d)"
                  value={`$${(estRevenue7dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Estimate (30d)"
                  value={`$${(estRevenue30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Estimate (90d)"
                  value={`$${(estRevenue90dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Estimate (12m)"
                  value={`$${(estRevenue12mCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Estimated from last 30 days usage volume with current pricing: $
                {(usageBilled30dCents / 100).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                (OpenAI ${(openAiCharge30dCents / 100).toFixed(2)} + WaveSpeed{" "}
                ${(wavespeedCharge30dCents / 100).toFixed(2)}).
              </p>
            </div>
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Cost Estimate (Model Cost Run Rate)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                  title="Cost Estimate (7d)"
                  value={`$${(estCost7dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Cost Estimate (30d)"
                  value={`$${(estCost30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Cost Estimate (90d)"
                  value={`$${(estCost90dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Cost Estimate (12m)"
                  value={`$${(estCost12mCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
              </div>
            </div>
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Operating Profit Estimate (Before AD Cost)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                  title="Operating Profit (7d)"
                  value={`$${(operatingProfit7dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Operating Profit (30d)"
                  value={`$${(operatingProfit30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Operating Profit (90d)"
                  value={`$${(operatingProfit90dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Operating Profit (12m)"
                  value={`$${(operatingProfit12mCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
              </div>
            </div>
            <div className="pt-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Net Profit Estimate (After AD Cost)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card
                  title="Profit Estimate (7d)"
                  value={`$${(estProfit7dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Profit Estimate (30d)"
                  value={`$${(estProfit30dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Profit Estimate (90d)"
                  value={`$${(estProfit90dCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
                <Card
                  title="Profit Estimate (12m)"
                  value={`$${(estProfit12mCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Cost baseline (30d): OpenAI ${openAiCostUsd30d.toFixed(2)}
                {" + "}
                WaveSpeed ${wavespeedCostUsd30d.toFixed(2)}
                {" = "}
                ${(estimatedCost30dCents / 100).toFixed(2)}.
                {" "}Promo subsidy deducted: ${(promoCostTotalCents / 100).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ({totalUsers.toLocaleString()} users × $5.00).
                {" "}Revenue estimate here uses billed usage deductions (not actual top-up cash timing).
                {wavespeedUsage.enabled && wavespeedUsage.available === false
                  ? " WaveSpeed cost unavailable, so profit is likely overstated."
                  : ""}
              </p>
            </div>
          </div>
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
                    {wavespeedUsage.topModels.map((item: { model: string; requests: number; costUsd: number }, index: number) => (
                      <div
                        key={`${item.model}-${index}`}
                        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
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
                {openAiByModel30d.map((item: { model: string | null; _sum: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } }) => {
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
                      className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm"
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
                {byJob30d.map((item: { jobName: string; _count: { _all: number }; _avg: { durationMs: number | null } }) => (
                  <div
                    key={item.jobName}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3"
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
                {recentFailures.map((item: { id: string; jobName: string; statusCode: number | null; error: string | null; triggeredBy: string | null; createdAt: Date }) => (
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
      <p className="mt-2 text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
