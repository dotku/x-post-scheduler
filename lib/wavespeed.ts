const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";

function getApiKey(): string {
  const key = process.env.WAVESPEED_API_KEY;
  if (!key) throw new Error("Missing WAVESPEED_API_KEY");
  return key;
}

export interface VideoSubmitParams {
  modelId: string;
  prompt: string;
  /** Duration in seconds */
  duration?: number;
  /** Canonical aspect ratio: "16:9" | "9:16" | "1:1" */
  aspectRatio?: string;
  /** Input image URL for image-to-video models */
  imageUrl?: string;
  /** Whether to generate audio/sound */
  generateAudio?: boolean;
}

export interface VideoTask {
  id: string;
  model: string;
  status: "created" | "processing" | "completed" | "failed";
  outputs: string[];
  error?: string;
  createdAt: string;
  timings?: { inference?: number };
  /** Poll URL returned by the submit response */
  urls?: { get?: string };
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const preview = text.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`WaveSpeed returned non-JSON (${res.status}): ${preview}`);
  }
}

/**
 * Build model-specific request body from canonical params.
 * Each model family uses different parameter names.
 */
function buildRequestBody(
  modelId: string,
  prompt: string,
  duration?: number,
  aspectRatio?: string,
  imageUrl?: string,
  generateAudio?: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt };
  const ratio = aspectRatio ?? "16:9";

  if (modelId.startsWith("wavespeed-ai/wan-")) {
    // WAN 2.2 models — no audio support
    const sizeMap: Record<string, Record<string, string>> = {
      "16:9": { "480p": "832*480", "720p": "1280*720" },
      "9:16": { "480p": "480*832", "720p": "720*1280" },
      "1:1":  { "480p": "480*480", "720p": "720*720" },
    };
    const res = modelId.includes("480p") ? "480p" : "720p";
    body.size = sizeMap[ratio]?.[res] ?? (res === "480p" ? "832*480" : "1280*720");
    if (duration) body.duration = duration;
    if (imageUrl) body.image = imageUrl;
    body.seed = -1;
  } else if (modelId.startsWith("alibaba/wan-")) {
    // Alibaba WAN models (Wan 2.6) — supports audio
    const sizeMap: Record<string, string> = {
      "16:9": "1280*720",
      "9:16": "720*1280",
      "1:1":  "720*720",
    };
    body.size = sizeMap[ratio] ?? "1280*720";
    if (duration) body.duration = duration;
    if (imageUrl) body.image = imageUrl;
    if (generateAudio) body.generate_audio = true;
    body.seed = -1;
  } else if (modelId.startsWith("bytedance/seedance-")) {
    // Seedance — supports audio via generate_audio
    body.aspect_ratio = ratio;
    body.resolution = modelId.includes("fast") ? "480p" : "720p";
    if (duration) body.duration = duration;
    if (imageUrl) body.image_url = imageUrl;
    body.generate_audio = generateAudio ?? false;
    body.seed = -1;
  } else if (modelId.startsWith("kwaivgi/")) {
    // Kling uses aspect_ratio
    body.aspect_ratio = ratio;
    if (duration) body.duration = duration;
    if (imageUrl) body.image = imageUrl;
    body.seed = -1;
  } else {
    // Generic fallback
    if (duration) body.duration = duration;
    if (aspectRatio) body.aspect_ratio = aspectRatio;
    if (imageUrl) body.image_url = imageUrl;
    body.seed = -1;
  }

  return body;
}

export async function submitVideoTask(
  params: VideoSubmitParams
): Promise<VideoTask> {
  const key = getApiKey();
  const body = buildRequestBody(
    params.modelId,
    params.prompt,
    params.duration,
    params.aspectRatio,
    params.imageUrl,
    params.generateAudio
  );

  const res = await fetch(`${WAVESPEED_BASE}/${params.modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await parseJsonSafe(res);
  if (!res.ok || json.code !== 200) {
    throw new Error(String(json.message ?? `WaveSpeed error ${res.status}`));
  }
  return json.data as VideoTask;
}

/**
 * Poll task status. Pass either:
 * - The full `urls.get` URL returned in the submit response (preferred), or
 * - Just the task ID (constructs URL as fallback)
 */
export async function getVideoTask(taskIdOrUrl: string): Promise<VideoTask> {
  const key = getApiKey();
  const url = taskIdOrUrl.startsWith("http")
    ? taskIdOrUrl
    : `${WAVESPEED_BASE}/predictions/${taskIdOrUrl}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = await parseJsonSafe(res);
  if (!res.ok || json.code !== 200) {
    const msg = String(json.message ?? "");
    // WaveSpeed returns "not finished" when the task is still processing
    if (msg.toLowerCase().includes("not finished")) {
      return { status: "processing", outputs: [] } as unknown as VideoTask;
    }
    throw new Error(msg || `WaveSpeed error ${res.status}`);
  }
  return json.data as VideoTask;
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

export interface ImageSubmitParams {
  modelId: string;
  prompt: string;
  /** "t2i"=text-to-image, "i2i"=image-to-image, "i2i_text"=image+text-to-image */
  mode?: "t2i" | "i2i" | "i2i_text";
  /** Input image URL for image-to-image style models */
  imageUrl?: string;
  /** Canonical aspect ratio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" */
  aspectRatio?: string;
}

/** Seedream size map: canonical ratio → "width*height" */
const SEEDREAM_SIZE: Record<string, string> = {
  "1:1":  "1024*1024",
  "16:9": "1344*768",
  "9:16": "768*1344",
  "4:3":  "1152*896",
  "3:4":  "896*1152",
};

/** Wan 2.6 image models require >= 3,686,400 pixels (e.g. 1920x1920). */
const WAN_IMAGE_SIZE: Record<string, string> = {
  "1:1":  "1920*1920",
  "16:9": "2560*1440",
  "9:16": "1440*2560",
  "4:3":  "2240*1664",
  "3:4":  "1664*2240",
};

/** Seedream 4.5 currently enforces the same minimum pixel requirement. */
const SEEDREAM_45_SIZE: Record<string, string> = {
  "1:1":  "1920*1920",
  "16:9": "2560*1440",
  "9:16": "1440*2560",
  "4:3":  "2240*1664",
  "3:4":  "1664*2240",
};

function needsLargeImageSize(modelId: string): boolean {
  return (
    modelId === "alibaba/wan-2.6/text-to-image" ||
    modelId === "bytedance/seedream-v4.5"
  );
}

function getImageSize(modelId: string, ratio: string): string {
  if (modelId === "bytedance/seedream-v4.5") {
    return SEEDREAM_45_SIZE[ratio] ?? SEEDREAM_45_SIZE["1:1"];
  }
  if (modelId === "alibaba/wan-2.6/text-to-image") {
    return WAN_IMAGE_SIZE[ratio] ?? WAN_IMAGE_SIZE["1:1"];
  }
  return SEEDREAM_SIZE[ratio] ?? SEEDREAM_SIZE["1:1"];
}

function buildImageRequestBodies(params: {
  modelId: string;
  prompt: string;
  mode: "t2i" | "i2i" | "i2i_text";
  imageUrl?: string;
  ratio: string;
}): Record<string, unknown>[] {
  const size = getImageSize(params.modelId, params.ratio);
  const prompt = params.prompt?.trim();
  const imageUrl = params.imageUrl?.trim();
  const hasPrompt = Boolean(prompt);
  const hasImage = Boolean(imageUrl);

  // t2i: existing behavior
  if (params.mode === "t2i" || !hasImage) {
    return [{ prompt: prompt ?? "", size }];
  }

  // i2i / i2i_text: provider endpoints differ in image field naming.
  const bodies: Record<string, unknown>[] = [];
  const withPrompt = params.mode === "i2i_text" && hasPrompt;

  const basePayloads: Record<string, unknown>[] = [
    { image: imageUrl, size },
    { image_url: imageUrl, size },
    { input_image: imageUrl, size },
    { images: [imageUrl], size },
    { image_urls: [imageUrl], size },
  ];

  for (const payload of basePayloads) {
    if (withPrompt) {
      bodies.push({ prompt, ...payload });
    } else {
      bodies.push(payload);
    }
  }

  // Some models may still require prompt even for i2i.
  if (!withPrompt && hasPrompt) {
    for (const payload of basePayloads) {
      bodies.push({ prompt, ...payload });
    }
  }

  return bodies;
}

/**
 * Submit an image generation task (always async — caller must poll urls.get).
 */
export async function submitImageTask(
  params: ImageSubmitParams
): Promise<VideoTask> {
  const key = getApiKey();
  const ratio = params.aspectRatio ?? "1:1";
  const mode = params.mode ?? "t2i";
  const bodies = buildImageRequestBodies({
    modelId: params.modelId,
    prompt: params.prompt,
    mode,
    imageUrl: params.imageUrl,
    ratio,
  });

  let lastError = "Failed to generate image";
  for (const body of bodies) {
    let res = await fetch(`${WAVESPEED_BASE}/${params.modelId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let json = await parseJsonSafe(res);
    if (res.ok && json.code === 200) {
      return json.data as VideoTask;
    }

    const msg = String(json.message ?? `WaveSpeed error ${res.status}`);
    lastError = msg;
    const lowerMsg = msg.toLowerCase();
    const requiresLargeSize =
      lowerMsg.includes("image size must be at least 3686400 pixels");

    // Safety retry for providers that recently increased minimum image size.
    if (requiresLargeSize && !needsLargeImageSize(params.modelId)) {
      const upgradedBody = {
        ...body,
        size: WAN_IMAGE_SIZE[ratio] ?? WAN_IMAGE_SIZE["1:1"],
      };
      res = await fetch(`${WAVESPEED_BASE}/${params.modelId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(upgradedBody),
      });
      json = await parseJsonSafe(res);
      if (res.ok && json.code === 200) {
        return json.data as VideoTask;
      }
      lastError = String(json.message ?? `WaveSpeed error ${res.status}`);
    }
  }

  throw new Error(lastError);
}

export const IMAGE_MODELS: {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "standard" | "premium";
  mode?: "t2i" | "i2i" | "i2i_text";
}[] = [
  {
    id: "bytedance/seedream-v4.5",
    label: "Seedream 4.5",
    description: "最新版 · 原生中英双语 · 4K · $0.04/张",
    tier: "standard",
  },
  {
    id: "bytedance/seedream-v4",
    label: "Seedream 4",
    description: "上一代 · 高质量 · 中英双语",
    tier: "fast",
  },
  {
    id: "bytedance/dreamina-v3.1/text-to-image",
    label: "Dreamina 3.1",
    description: "高保真美学 · ByteDance",
    tier: "premium",
  },
  {
    id: "wavespeed-ai/qwen-image/text-to-image",
    label: "Qwen Image",
    description: "Alibaba 20B · 中文文字渲染强",
    tier: "standard",
  },
  {
    id: "alibaba/wan-2.6/text-to-image",
    label: "Wan 2.6 Image",
    description: "Alibaba Wan 图片版",
    tier: "fast",
  },
  {
    id: "wavespeed-ai/uno",
    label: "UNO",
    description: "WaveSpeed 图像编辑（i2i / 图文）",
    tier: "standard",
    mode: "i2i_text",
  },
  {
    id: "wavespeed-ai/real-esrgan",
    label: "Real-ESRGAN",
    description: "WaveSpeed 图像增强/超分（i2i）",
    tier: "fast",
    mode: "i2i",
  },
  {
    id: "wavespeed-ai/flux-kontext-pro/multi",
    label: "FLUX Kontext Pro Multi",
    description: "多图上下文编辑（图文）",
    tier: "premium",
    mode: "i2i_text",
  },
];

export const I2V_MODELS: {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "standard" | "premium";
  supportsAudio?: boolean;
}[] = [
  {
    id: "wavespeed-ai/wan-2.2/i2v-480p-ultra-fast",
    label: "Wan 2.2 i2v — 480p Fast",
    description: "Fast & cheap · $0.05/video",
    tier: "fast",
  },
  {
    id: "wavespeed-ai/wan-2.2/i2v-720p",
    label: "Wan 2.2 i2v — 720p",
    description: "Higher resolution · $0.30/video",
    tier: "standard",
  },
  {
    id: "bytedance/seedance-v1.5-pro/image-to-video",
    label: "Seedance 1.5 Pro i2v",
    description: "Cinematic quality · ByteDance",
    tier: "premium",
    supportsAudio: true,
  },
];

export const VIDEO_MODELS: {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "standard" | "premium";
  supportsAudio?: boolean;
}[] = [
  {
    id: "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast",
    label: "Wan 2.2 — 480p Ultra Fast",
    description: "~5s generation · $0.05/video",
    tier: "fast",
  },
  {
    id: "wavespeed-ai/wan-2.2/t2v-720p",
    label: "Wan 2.2 — 720p",
    description: "High resolution · $0.30/video",
    tier: "standard",
  },
  {
    id: "alibaba/wan-2.6/text-to-video",
    label: "Wan 2.6",
    description: "Latest Wan with audio · best quality",
    tier: "standard",
    supportsAudio: true,
  },
  {
    id: "bytedance/seedance-v1.5-pro/text-to-video",
    label: "Seedance 1.5 Pro",
    description: "Cinematic quality · ByteDance",
    tier: "premium",
    supportsAudio: true,
  },
  {
    id: "kwaivgi/kling-video-o3-std/text-to-video",
    label: "Kling Video O3",
    description: "Best motion quality · Kuaishou",
    tier: "premium",
  },
];
