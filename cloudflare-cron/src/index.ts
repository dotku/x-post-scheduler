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

    // Single daily trigger: run all daily jobs sequentially
    ctx.waitUntil(
      (async () => {
        // 1. Process any scheduled posts that are due
        await safeTrigger(env, "Scheduler", "/api/scheduler");

        // 2. Generate daily content for users
        await safeTrigger(env, "Daily-generate", "/api/daily-generate");

        // 3. Daily media industry news
        await safeTrigger(env, "Media-news-daily", "/api/cron/media-news?period=daily");

        // 4. Weekly media news on Mondays
        if (new Date().getUTCDay() === 1) {
          await safeTrigger(env, "Media-news-weekly", "/api/cron/media-news?period=weekly");
        }
      })(),
    );
  },
};

export default worker;
