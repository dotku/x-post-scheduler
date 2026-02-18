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
    "user-agent": "cloudflare-cron/x-post-scheduler",
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

const worker = {
  async scheduled(
    event: ScheduledController,
    env: Env,
    ctx: WorkerExecutionContext
  ): Promise<void> {
    if (!env.APP_BASE_URL) {
      throw new Error("Missing APP_BASE_URL worker secret/var.");
    }

    if (event.cron === "* * * * *") {
      ctx.waitUntil((async () => {
        const res = await triggerEndpoint(env, "/api/scheduler");
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Scheduler trigger failed (${res.status}): ${body}`);
        }
      })());
      return;
    }

    if (event.cron === "0 0 * * *") {
      ctx.waitUntil((async () => {
        const res = await triggerEndpoint(env, "/api/daily-generate");
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Daily-generate trigger failed (${res.status}): ${body}`);
        }
      })());
      return;
    }
  },
};

export default worker;
