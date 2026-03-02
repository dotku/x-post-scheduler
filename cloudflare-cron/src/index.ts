interface Env {
  APP_BASE_URL: string;
  CRON_SECRET?: string;
}

interface ScheduledController {
  cron: string;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

function toAbsoluteUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalizedBase}${path}`;
}

async function triggerEndpoint(env: Env, path: string): Promise<Response> {
  const headers: HeadersInit = {
    "content-type": "application/json",
    "user-agent": "cloudflare-cron/xpilot",
  };

  if (env.CRON_SECRET) {
    headers.authorization = `Bearer ${env.CRON_SECRET}`;
  }

  const url = toAbsoluteUrl(env.APP_BASE_URL, path);
  return fetch(url, {
    method: "POST",
    headers,
    body: "{}",
  });
}

async function safeTrigger(env: Env, label: string, path: string): Promise<void> {
  const res = await triggerEndpoint(env, path);
  if (!res.ok) {
    const body = await res.text();
    console.error(`${label} failed (${res.status}): ${body}`);
  }
}

const worker = {
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: WorkerExecutionContext,
  ): Promise<void> {
    if (!env.APP_BASE_URL) {
      throw new Error("Missing APP_BASE_URL worker secret/var.");
    }

    // Determine which slot we're in based on current UTC hour
    const hour = new Date().getUTCHours();

    ctx.waitUntil(
      (async () => {
        // Every slot (2x/day at 01:00, 13:00 UTC): process scheduled posts
        await safeTrigger(env, "Scheduler", "/api/scheduler");

        // Slot 1 (UTC 01:00): Full daily pipeline
        if (hour === 1) {
          // Generate daily content for users
          await safeTrigger(env, "Daily-generate", "/api/daily-generate");

          // Daily media industry news
          await safeTrigger(env, "Media-news-daily", "/api/cron/media-news?period=daily");

          // Weekly media news on Mondays
          if (new Date().getUTCDay() === 1) {
            await safeTrigger(env, "Media-news-weekly", "/api/cron/media-news?period=weekly");
          }

          // Daily follower snapshot for growth tracking
          await safeTrigger(env, "Snapshot-followers", "/api/cron/snapshot-followers");
        }

        // Note: Tweet metrics sync + content profile auto-refresh happens when
        // users manually sync via POST /api/analytics/sync-tweet-metrics.
        // The follower snapshot cron (Slot 1) tracks growth data automatically.
      })(),
    );
  },
};

export default worker;
