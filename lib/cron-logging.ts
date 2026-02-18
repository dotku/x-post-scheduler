import { prisma } from "./db";

type CronLogInput = {
  jobName: string;
  endpoint: string;
  method?: string;
  success: boolean;
  statusCode?: number;
  durationMs?: number;
  triggeredBy?: string;
  error?: string;
  metadata?: unknown;
};

function safeStringify(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export async function logCronRun(input: CronLogInput) {
  try {
    await prisma.cronRunEvent.create({
      data: {
        jobName: input.jobName,
        endpoint: input.endpoint,
        method: input.method ?? "POST",
        success: input.success,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        triggeredBy: input.triggeredBy,
        error: input.error ?? null,
        metadata: safeStringify(input.metadata),
      },
    });
  } catch (error) {
    console.error("Failed to persist cron run event:", error);
  }
}

export function detectCronTrigger(request: Request): string {
  const userAgent = request.headers.get("user-agent")?.toLowerCase() ?? "";
  if (userAgent.includes("cloudflare-cron")) return "cloudflare";
  if (request.headers.has("x-vercel-id")) return "vercel";
  return "manual";
}
