/**
 * In-memory metrics collection for the Weixin worker.
 * Tracks per-user and per-operation stats for the /stats dashboard.
 */

interface OperationRecord {
  type: "scrape" | "qr-login" | "resolve" | "download";
  userId?: string;
  startedAt: number;
  durationMs?: number;
  success?: boolean;
  error?: string;
}

interface UserStats {
  totalRequests: number;
  lastActiveAt: number;
  operations: { scrape: number; qrLogin: number; resolve: number; download: number };
}

const MAX_HISTORY = 200;

// Metrics state
let startedAt = Date.now();
let totalRequests = 0;
const operationHistory: OperationRecord[] = [];
const activeOperations = new Map<string, OperationRecord>();
const userStats = new Map<string, UserStats>();

export function recordRequestStart(
  operationId: string,
  type: OperationRecord["type"],
  userId?: string
) {
  totalRequests++;
  const record: OperationRecord = {
    type,
    userId,
    startedAt: Date.now(),
  };
  activeOperations.set(operationId, record);

  // Update per-user stats
  if (userId) {
    const existing = userStats.get(userId) || {
      totalRequests: 0,
      lastActiveAt: 0,
      operations: { scrape: 0, qrLogin: 0, resolve: 0, download: 0 },
    };
    existing.totalRequests++;
    existing.lastActiveAt = Date.now();
    userStats.set(userId, existing);
  }
}

export function recordRequestEnd(
  operationId: string,
  success: boolean,
  error?: string
) {
  const record = activeOperations.get(operationId);
  if (!record) return;

  record.durationMs = Date.now() - record.startedAt;
  record.success = success;
  record.error = error;

  activeOperations.delete(operationId);
  operationHistory.push(record);
  if (operationHistory.length > MAX_HISTORY) {
    operationHistory.shift();
  }

  // Update per-user operation count
  if (record.userId) {
    const user = userStats.get(record.userId);
    if (user) {
      const key = record.type === "qr-login" ? "qrLogin" : record.type;
      user.operations[key]++;
    }
  }
}

export function getMetrics() {
  const now = Date.now();
  const uptimeMs = now - startedAt;

  // Compute stats from history
  const last24h = operationHistory.filter(
    (r) => r.startedAt > now - 24 * 60 * 60 * 1000
  );
  const lastHour = last24h.filter(
    (r) => r.startedAt > now - 60 * 60 * 1000
  );

  const byType = (records: OperationRecord[]) => {
    const types = { scrape: 0, "qr-login": 0, resolve: 0, download: 0 };
    for (const r of records) {
      types[r.type]++;
    }
    return types;
  };

  const avgDuration = (records: OperationRecord[]) => {
    const completed = records.filter((r) => r.durationMs !== undefined);
    if (completed.length === 0) return 0;
    return Math.round(
      completed.reduce((sum, r) => sum + r.durationMs!, 0) / completed.length
    );
  };

  const successRate = (records: OperationRecord[]) => {
    const completed = records.filter((r) => r.success !== undefined);
    if (completed.length === 0) return 100;
    const succeeded = completed.filter((r) => r.success).length;
    return Math.round((succeeded / completed.length) * 100);
  };

  // Memory usage
  const mem = process.memoryUsage();

  // Cost estimation (Fly.io pricing)
  // shared-cpu-1x 1GB: ~$5.70/month if running 24/7
  // With auto-stop: only pay for active time
  const uptimeHours = uptimeMs / (1000 * 60 * 60);
  const hourlyRate = 5.7 / (30 * 24); // ~$0.0079/hour
  const estimatedCostUsd = uptimeHours * hourlyRate;

  // Per-user summary
  const users: Array<{
    id: string;
    requests: number;
    lastActive: string;
    operations: UserStats["operations"];
  }> = [];
  for (const [id, stats] of userStats) {
    users.push({
      id: id.substring(0, 12) + "...",
      requests: stats.totalRequests,
      lastActive: new Date(stats.lastActiveAt).toISOString(),
      operations: stats.operations,
    });
  }

  return {
    uptime: {
      startedAt: new Date(startedAt).toISOString(),
      uptimeMs,
      uptimeHuman: formatDuration(uptimeMs),
    },
    requests: {
      total: totalRequests,
      active: activeOperations.size,
      lastHour: lastHour.length,
      last24h: last24h.length,
    },
    operations: {
      lastHour: byType(lastHour),
      last24h: byType(last24h),
    },
    performance: {
      avgDurationMs: avgDuration(last24h),
      successRate: successRate(last24h),
      avgDurationLastHour: avgDuration(lastHour),
    },
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      external: formatBytes(mem.external),
    },
    cost: {
      uptimeHours: Math.round(uptimeHours * 100) / 100,
      estimatedSessionCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
      hourlyRateUsd: Math.round(hourlyRate * 10000) / 10000,
      monthlyEstimateUsd: Math.round(hourlyRate * 24 * 30 * 100) / 100,
      note: "shared-cpu-1x / 1GB / sin region. Cost only when machine is running.",
    },
    users,
    recentOperations: operationHistory.slice(-20).reverse().map((r) => ({
      type: r.type,
      user: r.userId ? r.userId.substring(0, 12) + "..." : "unknown",
      durationMs: r.durationMs,
      success: r.success,
      error: r.error,
      at: new Date(r.startedAt).toISOString(),
    })),
  };
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}
