import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/auth/login");
    }
    redirect("/");
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

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
  ]);

  const successRate7d = runs7d > 0 ? (success7d / runs7d) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <Link
            href="/"
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
