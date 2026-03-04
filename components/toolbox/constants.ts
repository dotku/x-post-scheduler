export interface StudioModel {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "standard" | "premium";
  supportsAudio?: boolean;
  durations?: number[];
  /** If true, model is hidden from trial (unauthenticated) users. */
  requiresAuth?: boolean;
}

export type Tab = "video" | "image";
export type TaskStatus = "idle" | "generating" | "processing" | "completed" | "failed";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type SegmentStatus = "queued" | "generating" | "completed" | "failed";

export interface LongVideoSegment {
  index: number;
  prompt: string;
  taskId: string | null;
  pollUrl: string | null;
  status: SegmentStatus;
  outputUrl: string | null;
  error: string | null;
}

// ── Image-to-video models ─────────────────────────────────────────────────────
export const I2V_MODELS: StudioModel[] = [
  {
    id: "wavespeed-ai/wan-2.2/i2v-480p-ultra-fast",
    label: "Wan 2.2 i2v — 480p Fast",
    description:
      "Fast & cheap · final charge follows current pricing multiplier",
    tier: "fast",
    supportsAudio: false,
    durations: [5, 8],
  },
  {
    id: "wavespeed-ai/wan-2.2/i2v-720p",
    label: "Wan 2.2 i2v — 720p",
    description:
      "Higher resolution · final charge follows current pricing multiplier",
    tier: "standard",
    supportsAudio: false,
    durations: [5, 8],
  },
  {
    id: "bytedance/seedance-v1.5-pro/image-to-video",
    label: "Seedance 1.5 Pro i2v",
    description: "Cinematic quality · ByteDance",
    tier: "premium",
    supportsAudio: true,
    durations: [5, 8],
  },
  {
    id: "seedance-2.0/image-to-video",
    label: "Seedance 2.0 i2v",
    description: "Latest Seedance 2.0 · up to 12s · audio + lock camera",
    tier: "premium",
    supportsAudio: true,
    durations: [4, 8, 12],
  },
];

// ── Video models ──────────────────────────────────────────────────────────────
export const VIDEO_MODELS: StudioModel[] = [
  {
    id: "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast",
    label: "Wan 2.2 — 480p Ultra Fast",
    description: "~5s · final charge follows current pricing multiplier",
    tier: "fast",
    supportsAudio: false,
    durations: [5, 8],
  },
  {
    id: "wavespeed-ai/wan-2.2/t2v-720p",
    label: "Wan 2.2 — 720p",
    description:
      "Higher resolution · final charge follows current pricing multiplier",
    tier: "standard",
    supportsAudio: false,
    durations: [5, 8],
  },
  {
    id: "alibaba/wan-2.6/text-to-video",
    label: "Wan 2.6",
    description: "Latest Wan with audio",
    tier: "standard",
    supportsAudio: true,
    durations: [5, 8],
  },
  {
    id: "bytedance/seedance-v1.5-pro/text-to-video",
    label: "Seedance 1.5 Pro",
    description: "Cinematic quality",
    tier: "premium",
    supportsAudio: true,
    durations: [5, 8],
  },
  {
    id: "kwaivgi/kling-video-o3-std/text-to-video",
    label: "Kling Video O3",
    description: "Best motion quality",
    tier: "premium",
    supportsAudio: false,
    durations: [5, 10],
  },
  {
    id: "seedance-2.0/text-to-video",
    label: "Seedance 2.0",
    description: "Latest Seedance 2.0 · up to 12s · audio + lock camera",
    tier: "premium",
    supportsAudio: true,
    durations: [4, 8, 12],
  },
];

// ── Image models ──────────────────────────────────────────────────────────────
export const IMAGE_MODELS_T2I: StudioModel[] = [
  {
    id: "bytedance/seedream-v4.5",
    label: "Seedream 4.5",
    description: "最新版 · 原生中英双语 · 最高 4K · 计费按当前倍率",
    tier: "standard",
  },
  {
    id: "bytedance/seedream-v4",
    label: "Seedream 4",
    description: "高质量 · 中英双语",
    tier: "fast",
  },
  {
    id: "bytedance/dreamina-v3.1/text-to-image",
    label: "Dreamina 3.1",
    description: "高保真美学 · ByteDance · 计费按当前倍率",
    tier: "premium",
  },
  {
    id: "wavespeed-ai/qwen-image/text-to-image",
    label: "Qwen Image",
    description: "Alibaba 20B · 中文文字渲染强 · 计费按当前倍率",
    tier: "standard",
  },
  {
    id: "alibaba/wan-2.6/text-to-image",
    label: "Wan 2.6 Image",
    description: "Alibaba Wan 图片版 · 计费按当前倍率",
    tier: "fast",
  },
];

export const IMAGE_MODELS_I2I: StudioModel[] = [
  {
    id: "wavespeed-ai/flux-kontext-pro",
    label: "FLUX Kontext Pro",
    description: "单图上下文编辑，修图 / 修文字首选",
    tier: "premium",
  },
  {
    id: "wavespeed-ai/uno",
    label: "UNO",
    description: "图像编辑（i2i / 图文）",
    tier: "standard",
  },
  {
    id: "wavespeed-ai/real-esrgan",
    label: "Real-ESRGAN",
    description: "图像增强/超分（i2i）",
    tier: "fast",
  },
  {
    id: "wavespeed-ai/flux-kontext-pro/multi",
    label: "FLUX Kontext Pro Multi",
    description: "多图上下文编辑（图文）",
    tier: "premium",
  },
];

export const ASPECT_RATIOS: { label: string; value: string }[] = [
  { label: "9:16 竖版 (社交)", value: "9:16" },
  { label: "16:9 横版", value: "16:9" },
  { label: "1:1 正方", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "21:9 超宽", value: "21:9" },
  { label: "9:21 超长竖版", value: "9:21" },
];

export const TIER_COLORS: Record<string, string> = {
  fast: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  standard: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  premium:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const CLIENT_DEFAULT_MARKUP_MULTIPLIER = 60; // For OpenAI
const CLIENT_DEFAULT_WAVESPEED_MULTIPLIER = 2; // For Wavespeed
export const CLIENT_WAVESPEED_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_CHARGE_MULTIPLIER ??
    CLIENT_DEFAULT_WAVESPEED_MULTIPLIER,
);
export const CLIENT_WAVESPEED_IMAGE_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_IMAGE_CHARGE_MULTIPLIER ??
    CLIENT_WAVESPEED_CHARGE_MULTIPLIER,
);
export const CLIENT_WAVESPEED_VIDEO_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_VIDEO_CHARGE_MULTIPLIER ??
    CLIENT_WAVESPEED_CHARGE_MULTIPLIER,
);

export const CLIENT_WAVESPEED_MODEL_BASE_COST_CENTS: Record<string, number> = {
  // image
  "bytedance/seedream-v4.5": 4,
  "bytedance/seedream-v4": 4,
  "wavespeed-ai/qwen-image/text-to-image": 5,
  "alibaba/wan-2.6/text-to-image": 8,
  "bytedance/dreamina-v3.1/text-to-image": 6,
  // image i2i
  "wavespeed-ai/uno": 5,
  "wavespeed-ai/real-esrgan": 5,
  "wavespeed-ai/flux-kontext-pro": 8,
  "wavespeed-ai/flux-kontext-pro/multi": 8,
  // video
  "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast": 5,
  "wavespeed-ai/wan-2.2/t2v-720p": 30,
  "alibaba/wan-2.6/text-to-video": 40,
  "bytedance/seedance-v1.5-pro/text-to-video": 50,
  "kwaivgi/kling-video-o3-std/text-to-video": 60,
  "wavespeed-ai/wan-2.2/i2v-480p-ultra-fast": 5,
  "wavespeed-ai/wan-2.2/i2v-720p": 30,
  "bytedance/seedance-v1.5-pro/image-to-video": 50,
  // Seedance 2.0 (via seedanceapi.org)
  "seedance-2.0/text-to-video": 60,
  "seedance-2.0/image-to-video": 60,
};

// Unused but kept for reference
export { CLIENT_DEFAULT_MARKUP_MULTIPLIER };

const DEFAULT_INPUT_CLEANUP_DELAY_MINUTES = 15;
const INPUT_CLEANUP_DELAY_MINUTES = Math.max(
  1,
  Number(
    process.env.NEXT_PUBLIC_INPUT_CLEANUP_DELAY_MINUTES ??
      DEFAULT_INPUT_CLEANUP_DELAY_MINUTES,
  ),
);
export const INPUT_CLEANUP_DELAY_MS = INPUT_CLEANUP_DELAY_MINUTES * 60 * 1000;

/** Maps t2v model IDs to their i2v counterparts for seamless segment continuity. */
export const T2V_TO_I2V: Record<string, string> = {
  "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast":
    "wavespeed-ai/wan-2.2/i2v-480p-ultra-fast",
  "wavespeed-ai/wan-2.2/t2v-720p": "wavespeed-ai/wan-2.2/i2v-720p",
  "bytedance/seedance-v1.5-pro/text-to-video":
    "bytedance/seedance-v1.5-pro/image-to-video",
  "seedance-2.0/text-to-video": "seedance-2.0/image-to-video",
};
