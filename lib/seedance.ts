import { toPublicUrl } from "./public-url";
import type { VideoSubmitParams, VideoTask } from "./wavespeed";

const SEEDANCE_BASE = "https://seedanceapi.org/v1";

function getApiKey(userKey?: string): string {
  const key = userKey || process.env.SEEDANCE_API_KEY;
  if (!key) throw new Error("Missing SEEDANCE_API_KEY");
  return key;
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const preview = text.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(
      `Seedance API returned non-JSON (${res.status}): ${preview}`,
    );
  }
}

const STATUS_MAP: Record<string, VideoTask["status"]> = {
  IN_PROGRESS: "processing",
  PROCESSING: "processing",
  PENDING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};

export async function submitSeedanceVideoTask(
  params: VideoSubmitParams,
  userKey?: string,
): Promise<VideoTask> {
  const key = getApiKey(userKey);
  const publicImageUrl = toPublicUrl(params.imageUrl);
  const hasImage = Boolean(publicImageUrl);

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    mode: hasImage ? "image-to-video" : "text-to-video",
    aspect_ratio: params.aspectRatio ?? "16:9",
    resolution: "720p",
    duration: params.duration ?? 8,
    enable_audio: params.generateAudio ?? false,
    lock_camera: params.lockCamera ?? false,
  };
  if (publicImageUrl) {
    body.image_url = publicImageUrl;
  }

  console.log(`[SeedanceAPI] Submitting video task to: ${SEEDANCE_BASE}/generate`);
  console.log(`[SeedanceAPI] Request body:`, JSON.stringify(body, null, 2));

  const res = await fetch(`${SEEDANCE_BASE}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log(`[SeedanceAPI] Response status: ${res.status}`);

  const json = await parseJsonSafe(res);
  if (!res.ok || (json.code !== undefined && json.code !== 200)) {
    console.error(`[SeedanceAPI] Error response:`, json);
    throw new Error(
      String(json.message ?? `Seedance API error ${res.status}`),
    );
  }

  const data = json.data as Record<string, unknown> | undefined;
  const taskId = data?.task_id ?? data?.id;
  if (!taskId) {
    throw new Error("Seedance API did not return a task ID");
  }

  return {
    id: String(taskId),
    model: params.modelId,
    status: "processing",
    outputs: [],
    createdAt: new Date().toISOString(),
  };
}

export async function getSeedanceVideoTask(
  taskId: string,
  userKey?: string,
): Promise<VideoTask> {
  const key = getApiKey(userKey);
  const url = `${SEEDANCE_BASE}/status?task_id=${encodeURIComponent(taskId)}`;

  console.log(`[SeedanceAPI] Polling task status from: ${url}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });

  console.log(`[SeedanceAPI] Poll response status: ${res.status}`);

  const json = await parseJsonSafe(res);
  if (!res.ok || (json.code !== undefined && json.code !== 200)) {
    const msg = String(json.message ?? "");
    console.error(`[SeedanceAPI] Error polling task:`, json);
    // Treat transient errors as still processing
    if (msg.toLowerCase().includes("not finished") || msg.toLowerCase().includes("in progress")) {
      return { id: taskId, model: "", status: "processing", outputs: [], createdAt: "" };
    }
    throw new Error(msg || `Seedance API error ${res.status}`);
  }

  const data = json.data as Record<string, unknown> | undefined;
  const rawStatus = String(data?.status ?? "IN_PROGRESS").toUpperCase();
  const status = STATUS_MAP[rawStatus] ?? "processing";
  const response = data?.response as string[] | undefined;

  return {
    id: taskId,
    model: "",
    status,
    outputs: status === "completed" && response?.length ? [response[0]] : [],
    error: status === "failed" ? String(data?.message ?? json.message ?? "Generation failed") : undefined,
    createdAt: "",
  };
}

// ── Model definitions ────────────────────────────────────────────────────────

export const SEEDANCE_VIDEO_MODELS = [
  {
    id: "seedance-2.0/text-to-video",
    label: "Seedance 2.0",
    description: "Latest Seedance 2.0 · up to 12s · audio + lock camera",
    tier: "premium" as const,
    supportsAudio: true,
    durations: [4, 8, 12],
  },
];

export const SEEDANCE_I2V_MODELS = [
  {
    id: "seedance-2.0/image-to-video",
    label: "Seedance 2.0 i2v",
    description: "Image to video · up to 12s · audio + lock camera",
    tier: "premium" as const,
    supportsAudio: true,
    durations: [4, 8, 12],
  },
];
