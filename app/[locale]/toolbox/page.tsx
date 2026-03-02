"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

interface StudioModel {
  id: string;
  label: string;
  description: string;
  tier: "fast" | "standard" | "premium";
  supportsAudio?: boolean;
  durations?: number[];
}

// ── Image-to-video models ─────────────────────────────────────────────────────
const I2V_MODELS: StudioModel[] = [
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
];

// ── Video models ──────────────────────────────────────────────────────────────
const VIDEO_MODELS: StudioModel[] = [
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
];

// ── Image models ──────────────────────────────────────────────────────────────
const IMAGE_MODELS_T2I: StudioModel[] = [
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

const IMAGE_MODELS_I2I: StudioModel[] = [
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

// Durations are per-model (see model definitions above)

const ASPECT_RATIOS: { label: string; value: string }[] = [
  { label: "9:16 竖版 (社交)", value: "9:16" },
  { label: "16:9 横版", value: "16:9" },
  { label: "1:1 正方", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
];

type Tab = "video" | "image";
type TaskStatus = "idle" | "generating" | "processing" | "completed" | "failed";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type SegmentStatus = "queued" | "generating" | "completed" | "failed";

interface LongVideoSegment {
  index: number;
  prompt: string;
  taskId: string | null;
  pollUrl: string | null;
  status: SegmentStatus;
  outputUrl: string | null;
  error: string | null;
}

const TIER_COLORS: Record<string, string> = {
  fast: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  standard: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  premium:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const CLIENT_DEFAULT_MARKUP_MULTIPLIER = 60; // For OpenAI
const CLIENT_DEFAULT_WAVESPEED_MULTIPLIER = 2; // For Wavespeed
const CLIENT_WAVESPEED_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_CHARGE_MULTIPLIER ??
    CLIENT_DEFAULT_WAVESPEED_MULTIPLIER,
);
const CLIENT_WAVESPEED_IMAGE_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_IMAGE_CHARGE_MULTIPLIER ??
    CLIENT_WAVESPEED_CHARGE_MULTIPLIER,
);
const CLIENT_WAVESPEED_VIDEO_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_VIDEO_CHARGE_MULTIPLIER ??
    CLIENT_WAVESPEED_CHARGE_MULTIPLIER,
);

const CLIENT_WAVESPEED_MODEL_BASE_COST_CENTS: Record<string, number> = {
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
};

function inferMediaTypeFromModelId(modelId: string): "image" | "video" {
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

function getEstimatedBaseCostCents(
  modelId: string,
  mediaType: "image" | "video",
) {
  return (
    CLIENT_WAVESPEED_MODEL_BASE_COST_CENTS[modelId] ??
    (mediaType === "video" ? 30 : 5)
  );
}

function getEstimatedChargeCents(
  modelId: string,
  mediaType: "image" | "video",
) {
  const baseCostCents = getEstimatedBaseCostCents(modelId, mediaType);
  const multiplier =
    mediaType === "video"
      ? CLIENT_WAVESPEED_VIDEO_CHARGE_MULTIPLIER
      : CLIENT_WAVESPEED_IMAGE_CHARGE_MULTIPLIER;
  return Math.max(1, Math.ceil(baseCostCents * multiplier));
}

function formatUsdFromCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const DEFAULT_INPUT_CLEANUP_DELAY_MINUTES = 15;
const INPUT_CLEANUP_DELAY_MINUTES = Math.max(
  1,
  Number(
    process.env.NEXT_PUBLIC_INPUT_CLEANUP_DELAY_MINUTES ??
      DEFAULT_INPUT_CLEANUP_DELAY_MINUTES,
  ),
);
const INPUT_CLEANUP_DELAY_MS = INPUT_CLEANUP_DELAY_MINUTES * 60 * 1000;

/** Maps t2v model IDs to their i2v counterparts for seamless segment continuity. */
const T2V_TO_I2V: Record<string, string> = {
  "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast":
    "wavespeed-ai/wan-2.2/i2v-480p-ultra-fast",
  "wavespeed-ai/wan-2.2/t2v-720p": "wavespeed-ai/wan-2.2/i2v-720p",
  "bytedance/seedance-v1.5-pro/text-to-video":
    "bytedance/seedance-v1.5-pro/image-to-video",
};

/** Extracts the last frame of a video URL as a JPEG Blob (client-side, via canvas). */
async function extractLastFrame(proxyUrl: string): Promise<Blob> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
  document.body.appendChild(video);
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => reject(new Error("Failed to load video for frame extraction")),
        { once: true },
      );
      video.src = proxyUrl;
      video.load();
    });
    video.currentTime = Math.max(0, video.duration - 0.1);
    await new Promise<void>((resolve) => {
      video.addEventListener("seeked", () => resolve(), { once: true });
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.92,
      );
    });
  } finally {
    document.body.removeChild(video);
  }
}

function getImageModePath(mode: "t2i" | "i2i" | "i2i_text") {
  switch (mode) {
    case "t2i":
      return "/toolbox?tab=image&mode=t2i";
    case "i2i":
      return "/toolbox?tab=image&mode=i2i";
    case "i2i_text":
      return "/toolbox?tab=image&mode=i2i_text";
    default:
      return "/toolbox?tab=image";
  }
}

function getToolboxVisitingPath(
  tab: Tab,
  videoMode: "t2v" | "i2v",
  imageMode: "t2i" | "i2i" | "i2i_text",
) {
  if (tab === "video") {
    return `/toolbox?tab=video&mode=${videoMode}`;
  }
  return `/toolbox?tab=image&mode=${imageMode}`;
}

export default function ToolboxPage() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";
  const uiText = isZh
    ? {
        title: "媒体工作室",
        subtitle: "使用 AI 生成图片与视频",
        galleryFeed: "作品社区",
        videoJobs: "📊 视频任务",
        modelDocs: "📖 模型文档",
        dashboardHome: "← 仪表盘",
        loadingBalance: "余额加载中...",
        balance: "余额",
        add: "+ 充值",
        balanceUnavailable: "余额不可用",
        image: "图片",
        video: "视频",
        imageGeneration: "图片生成",
        videoGeneration: "视频生成",
        textToVideo: "文字转视频",
        imageToVideo: "图片转视频",
      }
    : {
        title: "Media Studio",
        subtitle: "Generate images and videos with AI",
        galleryFeed: "Gallery Feed",
        videoJobs: "📊 Video Jobs",
        modelDocs: "📖 Model Docs",
        dashboardHome: "← Dashboard Home",
        loadingBalance: "Loading balance...",
        balance: "Balance",
        add: "+ Add",
        balanceUnavailable: "Balance unavailable",
        image: "Image",
        video: "Video",
        imageGeneration: "Image Generation",
        videoGeneration: "Video Generation",
        textToVideo: "Text to Video",
        imageToVideo: "Image to Video",
      };

  const [tab, setTab] = useState<Tab>("image");

  // Credit balance & subscription
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditLoading, setCreditLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);

  // shared
  const [prompt, setPrompt] = useState("");
  const [aspectIdx, setAspectIdx] = useState(0); // default 9:16 (portrait)
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // video-specific
  const [videoModelId, setVideoModelId] = useState(VIDEO_MODELS[0].id);
  const [videoMode, setVideoMode] = useState<"t2v" | "i2v">("t2v");
  const [i2vImageUrl, setI2vImageUrl] = useState<string | null>(null);
  const [i2vModelId, setI2vModelId] = useState(I2V_MODELS[0].id);
  const [duration, setDuration] = useState(5);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [wsPollUrl, setWsPollUrl] = useState<string | null>(null);

  // image-specific
  const [imageMode, setImageMode] = useState<"t2i" | "i2i" | "i2i_text">("t2i");
  const [imageModelId, setImageModelId] = useState(IMAGE_MODELS_T2I[0].id);
  const [imageInputUrl, setImageInputUrl] = useState<string | null>(null);
  const [imageInputUrls, setImageInputUrls] = useState<string[]>([]); // for multi-image models
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");

  // video audio
  const [generateAudio, setGenerateAudio] = useState(false);
  const [enableLongVideo, setEnableLongVideo] = useState(false);
  const [longVideoSegmentsCount, setLongVideoSegmentsCount] = useState(3);
  const [longVideoSegments, setLongVideoSegments] = useState<
    LongVideoSegment[]
  >([]);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);
  const [isStitching, setIsStitching] = useState(false);
  const [stitchProgress, setStitchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // audio mixing
  const [audioMode, setAudioMode] = useState<
    "voiceover" | "bgm" | "both" | null
  >(null);
  const [voiceoverText, setVoiceoverText] = useState("");
  const [ttsVoice, setTtsVoice] = useState<
    "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
  >("nova");
  const [voiceoverVolume, setVoiceoverVolume] = useState(90);
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmVolume, setBgmVolume] = useState(30);
  const [bgmSource, setBgmSource] = useState<"upload" | "ai">("ai");
  const [bgmPrompt, setBgmPrompt] = useState("");
  const [isGeneratingBgm, setIsGeneratingBgm] = useState(false);
  const [bgmAudioUrl, setBgmAudioUrl] = useState<string | null>(null);
  const [isMixing, setIsMixing] = useState(false);
  const [mixedVideoUrl, setMixedVideoUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState("");
  const [ttsPreviewUrl, setTtsPreviewUrl] = useState<string | null>(null);
  const [isTtsPreviewing, setIsTtsPreviewing] = useState(false);
  const bgmFileRef = useRef<HTMLInputElement | null>(null);

  // gallery save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [savedBlobUrl, setSavedBlobUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [saveAsPublic, setSaveAsPublic] = useState(true);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimerRefs = useRef<number[]>([]);

  // Read tab/mode from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    const mode = params.get("mode");
    if (t === "video") {
      setTab("video");
      setAspectIdx(0); // 9:16 portrait default
      if (mode === "i2v" || mode === "t2v") {
        setVideoMode(mode);
      }
    } else if (t === "image") {
      setTab("image");
      setAspectIdx(0);
      if (mode === "t2i" || mode === "i2i" || mode === "i2i_text") {
        setImageMode(mode);
        const modelList = mode === "t2i" ? IMAGE_MODELS_T2I : IMAGE_MODELS_I2I;
        setImageModelId(modelList[0].id);
      }
    }
  }, []);

  useEffect(() => {
    const nextPath = getToolboxVisitingPath(tab, videoMode, imageMode);
    window.history.replaceState(null, "", nextPath);
  }, [tab, videoMode, imageMode]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupTimerRefs.current.forEach((id) => window.clearTimeout(id));
      cleanupTimerRefs.current = [];
    };
  }, []);

  // Fetch credit balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch("/api/usage");
        const data = await res.json();
        if (res.ok && data.creditBalance !== undefined) {
          setCreditBalance(data.creditBalance);
          if (data.subscriptionTier) {
            setSubscriptionTier(data.subscriptionTier);
          }
        }
      } catch (err) {
        console.error("Failed to fetch credit balance:", err);
      } finally {
        setCreditLoading(false);
      }
    };
    fetchBalance();
  }, []);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupTempInput = (inputUrl?: string | null) => {
    if (!inputUrl) return;
    const timerId = window.setTimeout(() => {
      fetch("/api/toolbox/cleanup-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputUrl }),
      }).catch(() => {
        // best-effort cleanup
      });
    }, INPUT_CLEANUP_DELAY_MS);
    cleanupTimerRefs.current.push(timerId);
  };

  const pollVideo = (
    id: string,
    pollUrl?: string,
    onComplete?: (url: string) => void,
    cleanupInputUrl?: string | null,
  ) => {
    pollRef.current = setTimeout(async () => {
      try {
        const url = pollUrl
          ? `/api/toolbox/video/${id}?pollUrl=${encodeURIComponent(pollUrl)}`
          : `/api/toolbox/video/${id}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const task = data.task;
        if (task.status === "completed") {
          stopTimer();
          setStatus("completed");
          const outUrl = task.outputs?.[0] ?? null;
          setOutputUrl(outUrl);
          if (outUrl) onComplete?.(outUrl);
          cleanupTempInput(cleanupInputUrl);
        } else if (task.status === "failed") {
          stopTimer();
          setStatus("failed");
          setError(task.error ?? "Generation failed");
          cleanupTempInput(cleanupInputUrl);
        } else {
          pollVideo(id, pollUrl, onComplete, cleanupInputUrl);
        }
      } catch (err) {
        stopTimer();
        setStatus("failed");
        setError(err instanceof Error ? err.message : "Polling error");
      }
    }, 3000);
  };

  const uploadImageFile = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/toolbox/upload-image", {
      method: "POST",
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!res.ok || !data.url) {
      throw new Error(data.error || "Failed to upload image");
    }
    return data.url;
  };

  const handlePastedImage = async (file: File, target: "i2v" | "i2i") => {
    setImageUploadError("");
    setImageUploadLoading(true);
    try {
      const url = await uploadImageFile(file);
      if (target === "i2v") {
        setI2vImageUrl(url);
      } else {
        setImageInputUrl(url);
      }
    } catch (err) {
      setImageUploadError(
        err instanceof Error ? err.message : "Failed to upload image",
      );
    } finally {
      setImageUploadLoading(false);
    }
  };

  const onPasteImageForTarget = async (
    e: React.ClipboardEvent<HTMLDivElement>,
    target: "i2v" | "i2i",
  ) => {
    const item = Array.from(e.clipboardData.items).find((it) =>
      it.type.startsWith("image/"),
    );
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    await handlePastedImage(file, target);
  };

  const onFilePickedForTarget = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "i2v" | "i2i",
  ) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await handlePastedImage(file, target);
    input.value = "";
  };

  const onMultiImageFilesPicked = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.currentTarget.files ?? []);
    if (!files.length) return;
    e.currentTarget.value = "";
    setImageUploadError("");
    setImageUploadLoading(true);
    try {
      const urls = await Promise.all(files.map((f) => uploadImageFile(f)));
      setImageInputUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImageUploadLoading(false);
    }
  };

  const pollVideoSync = (id: string, pollUrl?: string) =>
    new Promise<string>((resolve, reject) => {
      const tick = async () => {
        try {
          const url = pollUrl
            ? `/api/toolbox/video/${id}?pollUrl=${encodeURIComponent(pollUrl)}`
            : `/api/toolbox/video/${id}`;
          const res = await fetch(url);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Polling failed");
          const task = data.task;
          if (task.status === "completed") {
            const outUrl = task.outputs?.[0];
            if (!outUrl) throw new Error("Task completed but output is empty");
            resolve(outUrl);
            return;
          }
          if (task.status === "failed") {
            throw new Error(task.error || "Generation failed");
          }
          setTimeout(tick, 3000);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Polling failed"));
        }
      };
      void tick();
    });

  const handleGenerateLongVideo = async () => {
    if (!prompt.trim()) return;
    if (videoMode === "i2v" && !i2vImageUrl) return;

    const activeModelId = videoMode === "i2v" ? i2vModelId : videoModelId;
    const activeModels = videoMode === "i2v" ? I2V_MODELS : VIDEO_MODELS;
    const activeModel = activeModels.find((m) => m.id === activeModelId);
    const segmentCount = Math.max(2, Math.min(8, longVideoSegmentsCount));

    // Initialize UI state
    const initialSegments: LongVideoSegment[] = Array.from({
      length: segmentCount,
    }).map((_, idx) => ({
      index: idx + 1,
      prompt: prompt.trim(),
      taskId: null,
      pollUrl: null,
      status: "queued",
      outputUrl: null,
      error: null,
    }));

    setError("");
    setStitchedVideoUrl(null);
    setOutputUrl(null);
    setTaskId(null);
    setWsPollUrl(null);
    setLongVideoSegments(initialSegments);
    setStatus("generating");
    startTimer();

    try {
      // Submit background job
      const submitRes = await fetch("/api/toolbox/video/long-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: activeModelId,
          modelLabel: activeModel?.label || activeModelId,
          videoMode,
          prompt: prompt.trim(),
          segmentCount,
          duration,
          aspectRatio: ASPECT_RATIOS[aspectIdx].value,
          generateAudio,
          i2vImageUrl: videoMode === "i2v" ? i2vImageUrl : undefined,
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitData.error || "Failed to submit job");
      }

      const jobId = submitData.jobId;
      setTaskId(jobId); // Store jobId for reference

      // Poll job status until completion
      const pollJob = async () => {
        try {
          const res = await fetch(`/api/toolbox/video/long-gen/${jobId}`);
          const jobData = await res.json();

          if (!res.ok) {
            throw new Error(jobData.error || "Failed to fetch job status");
          }

          // Update segment states from job
          const jobSegments = jobData.segments || [];
          setLongVideoSegments(
            jobSegments.map((seg: any) => ({
              index: seg.index,
              prompt: seg.prompt || prompt.trim(),
              taskId: seg.taskId,
              pollUrl: seg.pollUrl,
              status: seg.status,
              outputUrl: seg.outputUrl,
              error: seg.error,
            })),
          );

          // Update overall status
          if (jobData.status === "completed") {
            stopTimer();
            setStatus("completed");
            setOutputUrl(
              jobData.completedUrls?.[jobData.completedUrls.length - 1] ?? null,
            );

            // Auto-stitch if we have 2+ completed segments
            if (jobData.completedUrls?.length >= 2) {
              setIsStitching(true);
              try {
                // Client-side stitch (as before)
                const proxyUrls = jobData.completedUrls.map(
                  (url: string) =>
                    `/api/toolbox/proxy?url=${encodeURIComponent(url)}`,
                );
                const stitchedUrl = await stitchProxyUrls(
                  proxyUrls,
                  (current, total) => setStitchProgress({ current, total }),
                );
                setStitchedVideoUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return stitchedUrl;
                });
                setOutputUrl(stitchedUrl);
              } catch (stitchErr) {
                setError(
                  stitchErr instanceof Error
                    ? stitchErr.message
                    : "Auto-stitch failed",
                );
              } finally {
                setIsStitching(false);
                setStitchProgress(null);
              }
            }

            // Save to gallery
            if (jobData.completedUrls?.length > 0 && activeModel) {
              saveToGallery(
                "video",
                activeModelId,
                `${activeModel.label} (long-video segment)`,
                jobData.completedUrls[0],
                ASPECT_RATIOS[aspectIdx].value,
                {
                  inputImageUrl:
                    videoMode === "i2v"
                      ? (i2vImageUrl ?? undefined)
                      : undefined,
                  generationMeta: {
                    provider: "wavespeed",
                    kind: "video",
                    mode: videoMode,
                    longVideo: true,
                    segmentCount,
                    duration,
                    generateAudio,
                  },
                },
              );
            }
          } else if (jobData.status === "processing") {
            // Continue polling
            setTimeout(pollJob, 3000);
          } else if (jobData.status === "failed") {
            stopTimer();
            setStatus("failed");
            setError(jobData.error || "Job failed");
          } else {
            // Still pending, keep polling
            setTimeout(pollJob, 3000);
          }
        } catch (err) {
          stopTimer();
          setStatus("failed");
          setError(err instanceof Error ? err.message : "Polling error");
        }
      };

      // Start polling
      pollJob();
    } catch (err) {
      stopTimer();
      setStatus("failed");
      const message =
        err instanceof Error ? err.message : "Failed to start job";
      setError(message);
    }
  };

  // Legacy method - kept for reference but not used
  const _legacyHandleGenerateLongVideo = async () => {
    if (!prompt.trim()) return;
    if (videoMode === "i2v" && !i2vImageUrl) return;

    const activeModelId = videoMode === "i2v" ? i2vModelId : videoModelId;
    const activeModels = videoMode === "i2v" ? I2V_MODELS : VIDEO_MODELS;
    const activeModel = activeModels.find((m) => m.id === activeModelId);
    const segmentCount = Math.max(2, Math.min(8, longVideoSegmentsCount));
    const basePrompt = prompt.trim();
    // i2v equivalent for seamless chaining; null means no visual handoff available
    const i2vContinuityModelId = T2V_TO_I2V[activeModelId] ?? null;

    const initialSegments: LongVideoSegment[] = Array.from({
      length: segmentCount,
    }).map((_, idx) => ({
      index: idx + 1,
      prompt: basePrompt,
      taskId: null,
      pollUrl: null,
      status: "queued",
      outputUrl: null,
      error: null,
    }));

    setError("");
    setStitchedVideoUrl(null);
    setOutputUrl(null);
    setTaskId(null);
    setWsPollUrl(null);
    setLongVideoSegments(initialSegments);
    setStatus("generating");
    startTimer();

    try {
      const completedUrls: string[] = [];
      // prevFrameUrl: the uploaded URL of the last frame from the previous segment
      let prevFrameUrl: string | null =
        videoMode === "i2v" ? i2vImageUrl : null;

      for (const segment of initialSegments) {
        setLongVideoSegments((prev) =>
          prev.map((item) =>
            item.index === segment.index
              ? { ...item, status: "generating", error: null }
              : item,
          ),
        );

        try {
          // For segments after the first: use i2v model with last frame for visual continuity
          const isFirstSeg = segment.index === 1;
          const segModelId =
            !isFirstSeg && prevFrameUrl && i2vContinuityModelId
              ? i2vContinuityModelId
              : activeModelId;
          const segImageUrl =
            !isFirstSeg && prevFrameUrl
              ? prevFrameUrl
              : videoMode === "i2v"
                ? i2vImageUrl
                : undefined;

          const submitRes = await fetch("/api/toolbox/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              modelId: segModelId,
              prompt: segment.prompt,
              duration,
              aspectRatio: ASPECT_RATIOS[aspectIdx].value,
              ...(segImageUrl ? { imageUrl: segImageUrl } : {}),
              ...(generateAudio ? { generateAudio: true } : {}),
            }),
          });
          const submitData = await submitRes.json();
          if (!submitRes.ok) {
            throw new Error(
              submitData.error || `Segment ${segment.index} submission failed`,
            );
          }

          const segTaskId: string = submitData.task.id;
          const segPollUrl: string | null = submitData.task?.urls?.get ?? null;
          setLongVideoSegments((prev) =>
            prev.map((item) =>
              item.index === segment.index
                ? {
                    ...item,
                    taskId: segTaskId,
                    pollUrl: segPollUrl,
                    status: "generating",
                  }
                : item,
            ),
          );
          setTaskId(segTaskId);
          setWsPollUrl(segPollUrl);
          setStatus("processing");

          const segOutputUrl = await pollVideoSync(
            segTaskId,
            segPollUrl ?? undefined,
          );
          completedUrls.push(segOutputUrl);
          setLongVideoSegments((prev) =>
            prev.map((item) =>
              item.index === segment.index
                ? {
                    ...item,
                    status: "completed",
                    outputUrl: segOutputUrl,
                    error: null,
                  }
                : item,
            ),
          );

          // Extract last frame for next segment's visual handoff (skip for the last segment)
          if (segment.index < segmentCount) {
            try {
              const proxyUrl = `/api/toolbox/proxy?url=${encodeURIComponent(segOutputUrl)}`;
              const frameBlob = await extractLastFrame(proxyUrl);
              const form = new FormData();
              form.append("file", frameBlob, "frame.jpg");
              const uploadRes = await fetch("/api/toolbox/upload-image", {
                method: "POST",
                body: form,
              });
              if (uploadRes.ok) {
                const uploadData = (await uploadRes.json()) as { url?: string };
                prevFrameUrl = uploadData.url ?? null;
              }
            } catch {
              // Non-fatal: fall back to text-only continuity for next segment
              prevFrameUrl = null;
            }
          }
        } catch (segErr) {
          const segError =
            segErr instanceof Error
              ? segErr.message
              : `Segment ${segment.index} generation failed`;
          console.error(`Segment ${segment.index} failed:`, segErr);
          setLongVideoSegments((prev) =>
            prev.map((item) =>
              item.index === segment.index
                ? { ...item, status: "failed", error: segError }
                : item,
            ),
          );
          // Continue to next segment instead of aborting entire generation
        }
      }

      stopTimer();
      // Mark as completed only if we have at least 2 completed segments to stitch
      if (completedUrls.length >= 2) {
        setStatus("completed");
      } else if (completedUrls.length === 1) {
        setStatus("completed");
      } else {
        setStatus("failed");
        setError("No segments completed successfully. Please try again.");
      }
      setOutputUrl(completedUrls[completedUrls.length - 1] ?? null);

      // Auto-stitch all segments into one long video
      if (completedUrls.length >= 2) {
        const failedCount = segmentCount - completedUrls.length;
        if (failedCount > 0) {
          setError(
            `⚠️ ${failedCount} segment(s) failed, but stitching ${completedUrls.length} successful ones.`,
          );
        }
        setIsStitching(true);
        setStitchProgress({ current: 0, total: completedUrls.length });
        try {
          const proxyUrls = completedUrls.map(
            (url) => `/api/toolbox/proxy?url=${encodeURIComponent(url)}`,
          );
          const stitchedUrl = await stitchProxyUrls(
            proxyUrls,
            (current, total) => setStitchProgress({ current, total }),
          );
          setStitchedVideoUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return stitchedUrl;
          });
          setOutputUrl(stitchedUrl);
        } catch (stitchErr) {
          // Non-fatal: segments are still accessible individually
          setError(
            stitchErr instanceof Error
              ? stitchErr.message
              : "Auto-stitch failed",
          );
        } finally {
          setIsStitching(false);
          setStitchProgress(null);
        }
      }

      if (completedUrls.length > 0 && activeModel) {
        saveToGallery(
          "video",
          activeModelId,
          `${activeModel.label} (long-video segment)`,
          completedUrls[0],
          ASPECT_RATIOS[aspectIdx].value,
          {
            inputImageUrl:
              videoMode === "i2v" ? (i2vImageUrl ?? undefined) : undefined,
            generationMeta: {
              provider: "wavespeed",
              kind: "video",
              mode: videoMode,
              longVideo: true,
              segmentCount,
              duration,
              generateAudio,
            },
          },
        );
      }
      cleanupTempInput(videoMode === "i2v" ? i2vImageUrl : null);
    } catch (err) {
      stopTimer();
      setStatus("failed");
      const message =
        err instanceof Error ? err.message : "Long video generation failed";
      setError(message);
      cleanupTempInput(videoMode === "i2v" ? i2vImageUrl : null);
    }
  };

  /** Core stitch logic: plays proxy URLs sequentially through a hidden video and records to WebM. */
  const stitchProxyUrls = async (
    proxyUrls: string[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<string> => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.muted = true;
    video.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
    document.body.appendChild(video);

    try {
      const captureVideo = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };

      await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadedmetadata", () => resolve(), {
          once: true,
        });
        video.addEventListener(
          "error",
          () => reject(new Error("Failed to load first segment")),
          { once: true },
        );
        video.src = proxyUrls[0];
        video.load();
      });

      const stream =
        typeof captureVideo.captureStream === "function"
          ? captureVideo.captureStream()
          : captureVideo.mozCaptureStream?.();
      if (!stream)
        throw new Error("captureStream is not supported (Chrome required).");

      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType =
        candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
      if (!mimeType)
        throw new Error("MediaRecorder webm not supported in this browser.");

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const waitForEnd = () =>
        new Promise<void>((resolve, reject) => {
          video.addEventListener("ended", () => resolve(), { once: true });
          video.addEventListener(
            "error",
            () => reject(new Error("Failed while playing segment")),
            { once: true },
          );
        });

      recorder.start(100);
      for (let i = 0; i < proxyUrls.length; i++) {
        if (i > 0) {
          video.src = proxyUrls[i];
          video.load();
          await new Promise<void>((resolve, reject) => {
            video.addEventListener("loadedmetadata", () => resolve(), {
              once: true,
            });
            video.addEventListener(
              "error",
              () => reject(new Error(`Failed to load segment ${i + 1}`)),
              { once: true },
            );
          });
        }
        const endPromise = waitForEnd();
        await video.play();
        await endPromise;
        onProgress?.(i + 1, proxyUrls.length);
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener("stop", () => {
          if (chunks.length === 0) {
            reject(new Error("No recorded data generated."));
            return;
          }
          resolve(new Blob(chunks, { type: mimeType }));
        });
        recorder.addEventListener("error", () =>
          reject(new Error("Recorder error")),
        );
        recorder.stop();
      });

      return URL.createObjectURL(blob);
    } finally {
      document.body.removeChild(video);
    }
  };

  const handleStitch = async () => {
    const completedSegments = longVideoSegments.filter(
      (s) => s.status === "completed" && s.outputUrl,
    );
    if (completedSegments.length < 2) {
      setError("Need at least 2 completed segments to stitch.");
      return;
    }
    setIsStitching(true);
    setStitchProgress({ current: 0, total: completedSegments.length });
    setError("");
    try {
      const proxyUrls = completedSegments.map(
        (s) => `/api/toolbox/proxy?url=${encodeURIComponent(s.outputUrl!)}`,
      );
      const objectUrl = await stitchProxyUrls(proxyUrls, (current, total) =>
        setStitchProgress({ current, total }),
      );
      setStitchedVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
      setOutputUrl(objectUrl);
      setStatus("completed");

      // Save stitched video to gallery
      const activeModelId = videoMode === "i2v" ? i2vModelId : videoModelId;
      const activeModels = videoMode === "i2v" ? I2V_MODELS : VIDEO_MODELS;
      const activeModel = activeModels.find((m) => m.id === activeModelId);
      if (activeModel && objectUrl) {
        saveToGallery(
          "video",
          activeModelId,
          `${activeModel.label} (stitched ${completedSegments.length} segments)`,
          objectUrl,
          ASPECT_RATIOS[aspectIdx].value,
          {
            inputImageUrl:
              videoMode === "i2v" ? (i2vImageUrl ?? undefined) : undefined,
            generationMeta: {
              provider: "wavespeed",
              kind: "video",
              mode: videoMode,
              longVideo: true,
              segmentCount: completedSegments.length,
              duration,
              generateAudio,
              stitched: true,
            },
          },
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to stitch segments",
      );
    } finally {
      setIsStitching(false);
      setStitchProgress(null);
    }
  };

  const handleMixAudio = async () => {
    const sourceUrl = mixedVideoUrl || stitchedVideoUrl || outputUrl;
    if (!sourceUrl) return;
    const needsVoiceover = audioMode === "voiceover" || audioMode === "both";
    const needsBgm = audioMode === "bgm" || audioMode === "both";
    if (needsVoiceover && !voiceoverText.trim()) {
      setAudioError("请输入旁白文字");
      return;
    }
    if (needsBgm && bgmSource === "upload" && !bgmFile) {
      setAudioError("请选择背景音乐文件");
      return;
    }
    if (needsBgm && bgmSource === "ai" && !bgmAudioUrl) {
      setAudioError("请先点击「AI 生成背景音乐」");
      return;
    }

    setIsMixing(true);
    setAudioError("");

    // AudioContext must be created synchronously during the user-gesture handler,
    // before any await, otherwise Chrome suspends it.
    const audioCtx = new AudioContext();
    const cleanupEls: HTMLElement[] = [];
    const blobUrls: string[] = [];

    try {
      await audioCtx.resume();

      // 1. Fetch TTS audio blob (if needed)
      let ttsBlob: Blob | null = null;
      if (needsVoiceover) {
        const res = await fetch("/api/toolbox/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: voiceoverText.trim(), voice: ttsVoice }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(
            (j as { error?: string }).error || "TTS generation failed",
          );
        }
        ttsBlob = await res.blob();
      }

      // 2. Video source (proxy if remote)
      const videoSrc = sourceUrl.startsWith("blob:")
        ? sourceUrl
        : `/api/toolbox/proxy?url=${encodeURIComponent(sourceUrl)}`;

      // 3. Hidden video element — load and wait for metadata
      const videoEl = document.createElement("video");
      videoEl.playsInline = true;
      videoEl.muted = true; // required for captureStream autoplay
      videoEl.style.cssText =
        "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
      document.body.appendChild(videoEl);
      cleanupEls.push(videoEl);

      await new Promise<void>((resolve, reject) => {
        videoEl.addEventListener("loadedmetadata", () => resolve(), {
          once: true,
        });
        videoEl.addEventListener(
          "error",
          () => reject(new Error("视频加载失败")),
          { once: true },
        );
        videoEl.src = videoSrc;
        videoEl.load();
      });

      // 4. Build audio graph: each source → gain → destination
      const dest = audioCtx.createMediaStreamDestination();
      const audioPlayEls: HTMLAudioElement[] = [];

      const addAudioTrack = async (
        blobOrFile: Blob | File,
        volume: number,
        loop: boolean,
      ) => {
        const objUrl = URL.createObjectURL(blobOrFile);
        blobUrls.push(objUrl);
        const el = document.createElement("audio");
        el.src = objUrl;
        el.loop = loop;
        document.body.appendChild(el);
        cleanupEls.push(el);
        // Wait until audio can be decoded
        await new Promise<void>((resolve, reject) => {
          el.addEventListener("canplaythrough", () => resolve(), {
            once: true,
          });
          el.addEventListener(
            "error",
            () => reject(new Error("音频加载失败")),
            { once: true },
          );
          el.load();
        });
        const source = audioCtx.createMediaElementSource(el);
        const gain = audioCtx.createGain();
        gain.gain.value = volume / 100;
        source.connect(gain);
        gain.connect(dest);
        audioPlayEls.push(el);
      };

      if (ttsBlob) await addAudioTrack(ttsBlob, voiceoverVolume, false);
      if (needsBgm) {
        if (bgmSource === "ai" && bgmAudioUrl) {
          const audioBlob = await fetch(bgmAudioUrl).then((r) => r.blob());
          await addAudioTrack(audioBlob, bgmVolume, true);
        } else if (bgmSource === "upload" && bgmFile) {
          await addAudioTrack(bgmFile, bgmVolume, true);
        }
      }

      // 5. Capture video frames + mixed audio tracks
      const captureVideo = videoEl as HTMLVideoElement & {
        captureStream?: () => MediaStream;
      };
      const videoStream = captureVideo.captureStream?.();
      if (!videoStream)
        throw new Error("captureStream 不支持，请使用 Chrome 浏览器");

      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType =
        candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
      if (!mimeType) throw new Error("当前浏览器不支持 WebM 录制");

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(combined, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // 6. Start recording, then play video + all audio simultaneously
      recorder.start(100);
      await Promise.all([
        videoEl.play(),
        ...audioPlayEls.map((el) => el.play()),
      ]);

      await new Promise<void>((resolve, reject) => {
        videoEl.addEventListener("ended", () => resolve(), { once: true });
        videoEl.addEventListener("error", () => reject(new Error("播放出错")), {
          once: true,
        });
      });

      for (const el of audioPlayEls) el.pause();

      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener("stop", () => {
          if (chunks.length === 0) {
            reject(new Error("录制无数据，请检查视频是否可正常播放"));
            return;
          }
          resolve(new Blob(chunks, { type: mimeType }));
        });
        recorder.addEventListener("error", () =>
          reject(new Error("Recorder error")),
        );
        recorder.stop();
      });

      const url = URL.createObjectURL(blob);
      setMixedVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Audio mixing failed");
    } finally {
      for (const el of cleanupEls) {
        try {
          document.body.removeChild(el);
        } catch {
          /* ok */
        }
      }
      for (const u of blobUrls) URL.revokeObjectURL(u);
      audioCtx.close().catch(() => {});
      setIsMixing(false);
    }
  };

  const handleTtsPreview = async () => {
    if (!voiceoverText.trim()) {
      setAudioError("请输入旁白文字再预览");
      return;
    }
    setIsTtsPreviewing(true);
    setAudioError("");
    try {
      const res = await fetch("/api/toolbox/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voiceoverText.trim(), voice: ttsVoice }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error || "TTS preview failed",
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setTtsPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "TTS preview failed");
    } finally {
      setIsTtsPreviewing(false);
    }
  };

  const handleGenerateBgm = async () => {
    const sourceUrl = mixedVideoUrl || stitchedVideoUrl || outputUrl;
    if (!sourceUrl) {
      setAudioError("请先生成视频");
      return;
    }
    if (!bgmPrompt.trim()) {
      setAudioError("请输入音乐风格描述");
      return;
    }
    setIsGeneratingBgm(true);
    setAudioError("");

    // Resolve a public video URL for MMAudio (blob URLs won't work as MMAudio input)
    let videoUrl = sourceUrl;
    if (sourceUrl.startsWith("blob:")) {
      // Upload the blob to Vercel Blob first so MMAudio can access it
      try {
        const blobData = await fetch(sourceUrl).then((r) => r.blob());
        const form = new FormData();
        // MMAudio accepts video; upload as a dummy "image" endpoint won't work — use a video upload or skip
        // Fallback: use the last WaveSpeed outputUrl if available
        videoUrl =
          outputUrl && !outputUrl.startsWith("blob:") ? outputUrl : sourceUrl;
        void blobData; // unused if we fall back
      } catch {
        videoUrl =
          outputUrl && !outputUrl.startsWith("blob:") ? outputUrl : sourceUrl;
      }
    }

    try {
      // Submit MMAudio v2 task
      const submitRes = await fetch("/api/toolbox/bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, prompt: bgmPrompt.trim() }),
      });
      const submitData = (await submitRes.json()) as {
        task?: { id: string; urls?: { get?: string } };
        error?: string;
      };
      if (!submitRes.ok)
        throw new Error(submitData.error ?? "BGM submission failed");

      const taskId = submitData.task!.id;
      const pollUrl = submitData.task!.urls?.get ?? null;

      // Poll until done
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(
          `/api/toolbox/bgm?taskId=${encodeURIComponent(pollUrl ?? taskId)}`,
        );
        const pollData = (await pollRes.json()) as {
          task?: { status: string; outputs: string[] };
          error?: string;
        };
        if (!pollRes.ok) throw new Error(pollData.error ?? "Poll failed");
        const task = pollData.task!;
        if (task.status === "completed" && task.outputs.length > 0) {
          // Download the audio via proxy and create a blob URL
          const proxyUrl = `/api/toolbox/proxy?url=${encodeURIComponent(task.outputs[0])}`;
          const audioBlob = await fetch(proxyUrl).then((r) => r.blob());
          const url = URL.createObjectURL(audioBlob);
          setBgmAudioUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          break;
        }
        if (task.status === "failed") throw new Error("BGM generation failed");
      }
    } catch (err) {
      setAudioError(
        err instanceof Error ? err.message : "BGM generation failed",
      );
    } finally {
      setIsGeneratingBgm(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) return;
    if (videoMode === "i2v" && !i2vImageUrl) return;
    setError("");
    setLongVideoSegments([]);
    if (stitchedVideoUrl) {
      URL.revokeObjectURL(stitchedVideoUrl);
      setStitchedVideoUrl(null);
    }
    setOutputUrl(null);
    setTaskId(null);
    setWsPollUrl(null);
    setStatus("generating");
    startTimer();

    const activeModelId = videoMode === "i2v" ? i2vModelId : videoModelId;
    const activeModels = videoMode === "i2v" ? I2V_MODELS : VIDEO_MODELS;

    try {
      const res = await fetch("/api/toolbox/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: activeModelId,
          prompt,
          duration,
          aspectRatio: ASPECT_RATIOS[aspectIdx].value,
          ...(videoMode === "i2v" && i2vImageUrl
            ? { imageUrl: i2vImageUrl }
            : {}),
          ...(generateAudio ? { generateAudio: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const id = data.task.id;
      const pollUrl: string | undefined = data.task?.urls?.get;
      setTaskId(id);
      setWsPollUrl(pollUrl ?? null);
      setStatus("processing");
      const model = activeModels.find((m) => m.id === activeModelId)!;
      pollVideo(
        id,
        pollUrl,
        (outUrl) => {
          saveToGallery(
            "video",
            activeModelId,
            model.label,
            outUrl,
            ASPECT_RATIOS[aspectIdx].value,
            {
              inputImageUrl:
                videoMode === "i2v" ? (i2vImageUrl ?? undefined) : undefined,
              generationMeta: {
                provider: "wavespeed",
                kind: "video",
                mode: videoMode,
                duration,
                generateAudio,
                taskId: id,
                pollUrl: pollUrl ?? null,
              },
            },
          );
        },
        videoMode === "i2v" ? i2vImageUrl : null,
      );
    } catch (err) {
      stopTimer();
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const handleGenerateImage = async () => {
    if ((imageMode === "t2i" || imageMode === "i2i_text") && !prompt.trim())
      return;
    const isMultiModel = imageModelId === "wavespeed-ai/flux-kontext-pro/multi";
    if (
      (imageMode === "i2i" || imageMode === "i2i_text") &&
      !imageInputUrl &&
      (!isMultiModel || imageInputUrls.length === 0)
    )
      return;
    setError("");
    setLongVideoSegments([]);
    if (stitchedVideoUrl) {
      URL.revokeObjectURL(stitchedVideoUrl);
      setStitchedVideoUrl(null);
    }
    setOutputUrl(null);
    setTaskId(null);
    setWsPollUrl(null);
    setStatus("generating");
    startTimer();

    try {
      const res = await fetch("/api/toolbox/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: imageModelId,
          prompt,
          mode: imageMode,
          imageUrl:
            imageModelId === "wavespeed-ai/flux-kontext-pro/multi"
              ? undefined
              : imageInputUrl,
          imageUrls:
            imageModelId === "wavespeed-ai/flux-kontext-pro/multi"
              ? imageInputUrls
              : undefined,
          aspectRatio: ASPECT_RATIOS[aspectIdx].value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const imgUrl = data.task?.outputs?.[0];
      if (imgUrl) {
        // sync mode returned result immediately
        stopTimer();
        setStatus("completed");
        setOutputUrl(imgUrl);
        const model = [...IMAGE_MODELS_T2I, ...IMAGE_MODELS_I2I].find(
          (m) => m.id === imageModelId,
        )!;
        saveToGallery(
          "image",
          imageModelId,
          model.label,
          imgUrl,
          ASPECT_RATIOS[aspectIdx].value,
          {
            inputImageUrl: imageInputUrl || undefined,
            generationMeta: {
              provider: "wavespeed",
              kind: "image",
              mode: imageMode,
              syncMode: true,
              taskId: data.task?.id ?? null,
            },
          },
        );
        cleanupTempInput(
          imageMode === "i2i" || imageMode === "i2i_text"
            ? imageInputUrl
            : null,
        );
      } else if (data.task?.urls?.get) {
        // sync mode didn't complete yet — fall back to polling
        const id = data.task.id;
        const pollUrl: string = data.task.urls.get;
        setTaskId(id);
        setWsPollUrl(pollUrl);
        setStatus("processing");
        const model = [...IMAGE_MODELS_T2I, ...IMAGE_MODELS_I2I].find(
          (m) => m.id === imageModelId,
        )!;
        pollVideo(
          id,
          pollUrl,
          (outUrl) => {
            saveToGallery(
              "image",
              imageModelId,
              model.label,
              outUrl,
              ASPECT_RATIOS[aspectIdx].value,
              {
                inputImageUrl: imageInputUrl || undefined,
                generationMeta: {
                  provider: "wavespeed",
                  kind: "image",
                  mode: imageMode,
                  syncMode: false,
                  taskId: id,
                  pollUrl,
                },
              },
            );
          },
          imageMode === "i2i" || imageMode === "i2i_text"
            ? imageInputUrl
            : null,
        );
      } else {
        stopTimer();
        setStatus("failed");
        setError("No image returned");
      }
    } catch (err) {
      stopTimer();
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  };

  const saveToGallery = (
    type: "image" | "video",
    modelId: string,
    modelLabel: string,
    outputUrl: string,
    aspectRatio: string,
    options?: {
      inputImageUrl?: string;
      generationMeta?: Record<string, unknown>;
    },
  ) => {
    setSaveStatus("saving");
    setSavedItemId(null);
    setSavedBlobUrl(null);
    setSaveError("");
    fetch("/api/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        modelId,
        modelLabel,
        prompt,
        sourceUrl: outputUrl,
        inputImageUrl: options?.inputImageUrl,
        generationMeta: options?.generationMeta,
        aspectRatio,
        isPublic: saveAsPublic,
      }),
    })
      .then(async (r) => {
        const d = await r
          .json()
          .catch(() => ({}) as { error?: string; item?: { id?: string } });
        if (!r.ok) {
          throw new Error(d.error || "保存失败");
        }
        if (d.item?.id) {
          setSaveStatus("saved");
          setSavedItemId(d.item.id);
          setSavedBlobUrl(d.item.blobUrl ?? null);
          return;
        }
        throw new Error("保存失败");
      })
      .catch((err) => {
        setSaveStatus("error");
        setSaveError(err instanceof Error ? err.message : "保存失败");
      });
  };

  const handleReset = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    stopTimer();
    setStatus("idle");
    setOutputUrl(null);
    setTaskId(null);
    setWsPollUrl(null);
    setError("");
    setElapsed(0);
    setSaveStatus("idle");
    setSavedItemId(null);
    setSavedBlobUrl(null);
    setSaveError("");
    setLongVideoSegments([]);
    if (stitchedVideoUrl) {
      URL.revokeObjectURL(stitchedVideoUrl);
    }
    setStitchedVideoUrl(null);
    setIsStitching(false);
  };

  const handleMakeVideo = () => {
    const srcUrl = savedBlobUrl ?? outputUrl;
    if (!srcUrl) return;
    handleReset();
    setPrompt("");
    setTab("video");
    setVideoMode("i2v");
    setI2vImageUrl(srcUrl);
    setI2vModelId(I2V_MODELS[0].id);
    setAspectIdx(0); // 9:16 portrait default
  };

  const handleTabChange = (t: Tab) => {
    handleReset();
    setPrompt("");
    setTab(t);
    setVideoMode("t2v");
    setI2vImageUrl(null);
    setGenerateAudio(false);
    setImageMode("t2i");
    setImageInputUrl(null);
    setImageInputUrls([]);
    setImageUploadError("");
    setImageModelId(IMAGE_MODELS_T2I[0].id);
    setEnableLongVideo(false);
    setLongVideoSegmentsCount(3);
    setLongVideoSegments([]);
    if (stitchedVideoUrl) {
      URL.revokeObjectURL(stitchedVideoUrl);
    }
    setStitchedVideoUrl(null);
    setIsStitching(false);
    setAspectIdx(0); // always default to 9:16 portrait
  };

  const isRunning = status === "generating" || status === "processing";
  const currentImageModels =
    imageMode === "t2i" ? IMAGE_MODELS_T2I : IMAGE_MODELS_I2I;
  const currentModels =
    tab === "video"
      ? videoMode === "i2v"
        ? I2V_MODELS
        : VIDEO_MODELS
      : currentImageModels;
  const currentModelId =
    tab === "video"
      ? videoMode === "i2v"
        ? i2vModelId
        : videoModelId
      : imageModelId;
  const selectedModel =
    currentModels.find((m) => m.id === currentModelId) ?? currentModels[0];
  const selectedMediaType: "image" | "video" =
    tab === "video" ? "video" : "image";
  const durationFactor = tab === "video" ? Math.max(1, duration / 5) : 1;
  const runCount =
    tab === "video" && enableLongVideo ? longVideoSegmentsCount : 1;
  const estimatedPromptTokens = Math.max(
    0,
    Math.ceil((prompt.trim().length || 0) / 4) *
      (tab === "video" && enableLongVideo ? longVideoSegmentsCount : 1),
  );
  const estimatedSingleBaseCostCents = Math.round(
    getEstimatedBaseCostCents(currentModelId, selectedMediaType) *
      durationFactor,
  );
  const estimatedSingleChargeCents = Math.round(
    getEstimatedChargeCents(currentModelId, selectedMediaType) * durationFactor,
  );
  const estimatedTotalBaseCostCents = estimatedSingleBaseCostCents * runCount;
  const estimatedTotalChargeCents = estimatedSingleChargeCents * runCount;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {uiText.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {uiText.subtitle}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <Link
                  href={`${prefix}/gallery`}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {uiText.galleryFeed}
                </Link>
                <Link
                  href={`${prefix}/toolbox/video-jobs`}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {uiText.videoJobs}
                </Link>
                <Link
                  href={`${prefix}/docs/models`}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {uiText.modelDocs}
                </Link>
                <Link
                  href={`${prefix}/dashboard`}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {uiText.dashboardHome}
                </Link>
              </div>
              {creditLoading ? (
                <div className="text-xs text-gray-400">
                  {uiText.loadingBalance}
                </div>
              ) : creditBalance !== null ? (
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {uiText.balance}:{" "}
                    <span className="text-green-600 dark:text-green-400">
                      ${(creditBalance / 100).toFixed(2)}
                    </span>
                  </div>
                  <Link
                    href={`${prefix}/settings?tab=billing`}
                    className="text-xs px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
                  >
                    {uiText.add}
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  {uiText.balanceUnavailable}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Text navigator */}
        <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700 pb-3">
          {(["image", "video"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`text-sm font-medium transition-colors ${
                tab === t
                  ? "text-gray-900 dark:text-white underline underline-offset-8 decoration-2"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {t === "image" ? uiText.image : uiText.video}
            </button>
          ))}
        </div>

        {/* Config card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tab === "image"
                ? uiText.imageGeneration
                : uiText.videoGeneration}
            </h2>
          </div>
          <div className="p-6 space-y-5">
            {/* Video mode toggle (t2v / i2v) */}
            {tab === "video" && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setVideoMode("t2v");
                    setI2vImageUrl(null);
                  }}
                  disabled={isRunning}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    videoMode === "t2v"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {uiText.textToVideo}
                </button>
                <button
                  onClick={() => setVideoMode("i2v")}
                  disabled={isRunning}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    videoMode === "i2v"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  {uiText.imageToVideo}
                </button>
              </div>
            )}

            {/* i2v image input */}
            {tab === "video" && videoMode === "i2v" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Input Image
                </label>
                <div
                  onPaste={(e) => void onPasteImageForTarget(e, "i2v")}
                  className="mb-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400"
                >
                  Paste image here (Ctrl/Cmd+V), or upload from file.
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void onFilePickedForTarget(e, "i2v")}
                      disabled={isRunning || imageUploadLoading}
                      className="block w-full text-xs text-gray-500 dark:text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white"
                    />
                  </div>
                </div>
                {i2vImageUrl ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={i2vImageUrl}
                      alt="i2v input"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 object-contain"
                    />
                    <button
                      onClick={() => setI2vImageUrl(null)}
                      disabled={isRunning}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove image
                    </button>
                  </div>
                ) : (
                  <input
                    type="url"
                    placeholder="Paste image URL..."
                    disabled={isRunning}
                    onChange={(e) => setI2vImageUrl(e.target.value || null)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                )}
              </div>
            )}

            {/* Model selector */}
            {tab === "image" && (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    {
                      key: "t2i",
                      label: "Text to Image",
                      path: "/toolbox?tab=image&mode=t2i",
                    },
                    {
                      key: "i2i",
                      label: "Image to Image",
                      path: "/toolbox?tab=image&mode=i2i",
                    },
                    {
                      key: "i2i_text",
                      label: "Image + Text to Image",
                      path: "/toolbox?tab=image&mode=i2i_text",
                    },
                  ] as const
                ).map((modeOption) => (
                  <button
                    key={modeOption.key}
                    onClick={() => {
                      const nextMode = modeOption.key;
                      setImageMode(nextMode);
                      const modelList =
                        nextMode === "t2i"
                          ? IMAGE_MODELS_T2I
                          : IMAGE_MODELS_I2I;
                      setImageModelId(modelList[0].id);
                    }}
                    disabled={isRunning}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      imageMode === modeOption.key
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <span className="block">{modeOption.label}</span>
                    <span className="block text-[11px] mt-0.5 opacity-80">
                      {modeOption.path}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {tab === "image" &&
              (imageMode === "i2i" || imageMode === "i2i_text") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {imageModelId === "wavespeed-ai/flux-kontext-pro/multi"
                      ? "参考图片（可多张）"
                      : "Input Image URL"}
                  </label>

                  {imageModelId === "wavespeed-ai/flux-kontext-pro/multi" ? (
                    /* Multi-image upload UI */
                    <div className="space-y-3">
                      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400">
                        选择多张参考图片（最多 4 张）
                        <div className="mt-2">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => void onMultiImageFilesPicked(e)}
                            disabled={
                              isRunning ||
                              imageUploadLoading ||
                              imageInputUrls.length >= 4
                            }
                            className="block w-full text-xs text-gray-500 dark:text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white"
                          />
                        </div>
                      </div>
                      {imageInputUrls.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {imageInputUrls.map((url, idx) => (
                            <div key={idx} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`ref ${idx + 1}`}
                                className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                              />
                              <button
                                onClick={() =>
                                  setImageInputUrls((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                                disabled={isRunning}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Single-image upload UI */
                    <>
                      <div
                        onPaste={(e) => void onPasteImageForTarget(e, "i2i")}
                        className="mb-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400"
                      >
                        Paste image here (Ctrl/Cmd+V), or upload from file.
                        <div className="mt-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              void onFilePickedForTarget(e, "i2i")
                            }
                            disabled={isRunning || imageUploadLoading}
                            className="block w-full text-xs text-gray-500 dark:text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white"
                          />
                        </div>
                      </div>
                      {imageInputUrl ? (
                        <div className="space-y-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageInputUrl}
                            alt="i2i input"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 object-contain"
                          />
                          <button
                            onClick={() => setImageInputUrl(null)}
                            disabled={isRunning}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove image
                          </button>
                        </div>
                      ) : (
                        <input
                          type="url"
                          placeholder="Paste image URL..."
                          value={imageInputUrl ?? ""}
                          onChange={(e) =>
                            setImageInputUrl(e.target.value || null)
                          }
                          disabled={isRunning}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                        />
                      )}
                    </>
                  )}
                </div>
              )}

            {imageUploadLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Uploading image...
              </p>
            )}
            {imageUploadError && (
              <p className="text-xs text-red-500">{imageUploadError}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Model
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (tab === "video") {
                        videoMode === "i2v"
                          ? setI2vModelId(m.id)
                          : setVideoModelId(m.id);
                        if (!m.supportsAudio) setGenerateAudio(false);
                        // Clamp duration to what this model supports
                        const supported = m.durations ?? [5, 8];
                        if (!supported.includes(duration))
                          setDuration(supported[0]);
                      } else {
                        setImageModelId(m.id);
                      }
                    }}
                    disabled={isRunning}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                      currentModelId === m.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    {(() => {
                      const mediaType: "image" | "video" =
                        tab === "video"
                          ? "video"
                          : inferMediaTypeFromModelId(m.id);
                      const singleBaseCostCents = Math.round(
                        getEstimatedBaseCostCents(m.id, mediaType) *
                          (tab === "video" ? Math.max(1, duration / 5) : 1),
                      );
                      const singleChargeCents = Math.round(
                        getEstimatedChargeCents(m.id, mediaType) *
                          (tab === "video" ? Math.max(1, duration / 5) : 1),
                      );
                      return (
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {m.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {m.description}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                            Cost est: {formatUsdFromCents(singleChargeCents)}{" "}
                            charged · {formatUsdFromCents(singleBaseCostCents)}{" "}
                            model cost · token est ~
                            {Math.max(
                              0,
                              Math.ceil((prompt.trim().length || 0) / 4),
                            ).toLocaleString()}
                          </p>
                        </div>
                      );
                    })()}
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[m.tier]}`}
                    >
                      {m.tier}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 space-y-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Path Info
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                Visiting Path:{" "}
                <code className="text-gray-800 dark:text-gray-200">
                  {tab === "video"
                    ? `/toolbox?tab=video&mode=${videoMode}`
                    : getImageModePath(imageMode)}
                </code>
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
                Model Path:{" "}
                <code className="text-gray-800 dark:text-gray-200">
                  {selectedModel?.id ?? currentModelId}
                </code>
              </p>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prompt{" "}
                {tab === "image" && (
                  <span className="text-gray-400 font-normal">
                    （支持中文）
                  </span>
                )}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder={
                  tab === "image"
                    ? imageMode === "i2i"
                      ? "可选：描述希望优化方向（不填也可以）"
                      : imageMode === "i2i_text"
                        ? "描述修改内容，例如：修复图中的中文文字乱码，正确文字应为「…」，保持版式不变"
                        : "描述你想要的图片，支持中英文..."
                    : "Describe the video you want to generate..."
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                disabled={isRunning}
              />
              {tab === "image" &&
                imageMode === "i2i_text" &&
                (imageModelId === "wavespeed-ai/flux-kontext-pro" ||
                  imageModelId === "wavespeed-ai/flux-kontext-pro/multi") &&
                !prompt && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">修复中文文字提示模板：</span>{" "}
                    <button
                      type="button"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
                      onClick={() =>
                        setPrompt(
                          "请修复图片中所有乱码的中文文字，保持原有版式、字体颜色、字号和位置完全不变，只将乱码替换为正确的中文内容。正确的文字应该是：「在此填写正确文字」",
                        )
                      }
                    >
                      点击填入模板
                    </button>
                  </div>
                )}
            </div>

            {/* Aspect ratio + Duration (video only) */}
            <div
              className={`grid gap-4 ${tab === "video" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Aspect Ratio
                </label>
                <select
                  value={aspectIdx}
                  onChange={(e) => setAspectIdx(Number(e.target.value))}
                  disabled={isRunning}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  {ASPECT_RATIOS.map((r, i) => (
                    <option key={i} value={i}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              {tab === "video" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duration
                  </label>
                  <div className="flex gap-2">
                    {(selectedModel?.durations ?? [5, 8]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        disabled={isRunning}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          duration === d
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Audio toggle — only for models that support it */}
            {tab === "video" && selectedModel?.supportsAudio && (
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={generateAudio}
                  onChange={(e) => setGenerateAudio(e.target.checked)}
                  disabled={isRunning}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                Generate audio
              </label>
            )}

            {/* Long video generation — members only */}
            {tab === "video" && (
              <div className="space-y-2">
                {subscriptionTier ? (
                  <>
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={enableLongVideo}
                        onChange={(e) => setEnableLongVideo(e.target.checked)}
                        disabled={isRunning}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      {locale === "zh"
                        ? "生成长视频（多段拼接）"
                        : "Generate long video (multi-segment)"}
                    </label>
                    {enableLongVideo && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {locale === "zh" ? "段数:" : "Segments:"}
                        </span>
                        <select
                          value={longVideoSegmentsCount}
                          onChange={(e) =>
                            setLongVideoSegmentsCount(Number(e.target.value))
                          }
                          disabled={isRunning}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                            <option key={count} value={count}>
                              {count}
                            </option>
                          ))}
                        </select>
                        <span className="text-gray-400">
                          ({duration}s {locale === "zh" ? "每段" : "each"})
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                    <span>🔒</span>
                    <span>
                      {locale === "zh"
                        ? "长视频生成为会员专属功能"
                        : "Long video generation is a members-only feature"}
                    </span>
                    <Link
                      href={`/${locale}/settings`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {locale === "zh" ? "升级会员 →" : "Subscribe →"}
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 space-y-1.5">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Estimated Usage & Cost
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Model-side prompt tokens (est.): ~
                {estimatedPromptTokens.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                User charge (single run):{" "}
                {formatUsdFromCents(estimatedSingleChargeCents)}
                {tab === "video"
                  ? ` · duration factor x${durationFactor.toFixed(1)}`
                  : ""}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Model provider cost (single run):{" "}
                {formatUsdFromCents(estimatedSingleBaseCostCents)}
              </p>
              {runCount > 1 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Total for {runCount} runs:{" "}
                  {formatUsdFromCents(estimatedTotalChargeCents)} charged ·{" "}
                  {formatUsdFromCents(estimatedTotalBaseCostCents)} provider
                  cost
                </p>
              )}
              <p className="text-[11px] text-gray-500 dark:text-gray-500">
                Note: The image/video service is task-priced. Token estimate is
                prompt-length based and for reference only.
              </p>
            </div>

            {/* Generate button */}
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={saveAsPublic}
                onChange={(e) => setSaveAsPublic(e.target.checked)}
                disabled={isRunning}
                className="h-4 w-4 text-purple-600 border-gray-300 rounded"
              />
              Save to Gallery as public
            </label>

            <button
              onClick={
                tab === "image"
                  ? handleGenerateImage
                  : enableLongVideo
                    ? handleGenerateLongVideo
                    : handleGenerateVideo
              }
              disabled={
                isRunning ||
                (tab === "video" &&
                  (!prompt.trim() || (videoMode === "i2v" && !i2vImageUrl))) ||
                (tab === "image" &&
                  (imageMode === "t2i" || imageMode === "i2i_text") &&
                  !prompt.trim()) ||
                (tab === "image" &&
                  (imageMode === "i2i" || imageMode === "i2i_text") &&
                  !imageInputUrl &&
                  !(
                    imageModelId === "wavespeed-ai/flux-kontext-pro/multi" &&
                    imageInputUrls.length > 0
                  ))
              }
              className="w-full py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning
                ? tab === "image"
                  ? "生成中..."
                  : status === "generating"
                    ? "Submitting..."
                    : "Generating..."
                : tab === "image"
                  ? "生成图片"
                  : "Generate Video"}
            </button>
          </div>
        </div>

        {/* Result / Status */}
        {(isRunning || status === "completed" || status === "failed") && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {status === "completed"
                    ? tab === "image"
                      ? "图片生成完成"
                      : "Video Ready"
                    : status === "failed"
                      ? "Generation Failed"
                      : tab === "image"
                        ? "生成中…"
                        : "Generating…"}
                </h2>
                {saveStatus === "saving" && (
                  <span className="text-xs text-gray-400">保存中…</span>
                )}
                {saveStatus === "saved" && (
                  <a
                    href={`${prefix}/gallery`}
                    className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full hover:underline"
                  >
                    已保存到 Gallery ✓
                  </a>
                )}
                {saveStatus === "error" && (
                  <span className="text-xs text-red-400">
                    保存失败{saveError ? `：${saveError}` : ""}
                  </span>
                )}
              </div>
              {(status === "completed" || status === "failed") && (
                <button
                  onClick={handleReset}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {tab === "image" ? "再生成一张" : "New video"}
                </button>
              )}
            </div>
            <div className="p-6">
              {isRunning && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <svg
                    className="w-14 h-14 animate-spin text-purple-500"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-gray-700 dark:text-gray-300 font-medium">
                      {tab === "image"
                        ? `使用 ${selectedModel.label} 生成图片…`
                        : `Generating with ${selectedModel.label}…`}
                    </p>
                    {tab === "video" && taskId && (
                      <p className="text-xs text-gray-400 mt-1">
                        Task: {taskId}
                      </p>
                    )}
                    {elapsed > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {elapsed}s
                        {tab === "video"
                          ? " — video generation typically takes 1–3 minutes"
                          : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {status === "failed" && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-700 dark:text-red-400 text-sm">
                    {error}
                  </p>
                </div>
              )}

              {status === "completed" && outputUrl && tab === "image" && (
                <div className="space-y-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={outputUrl}
                    alt="Generated image"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[70vh] object-contain mx-auto"
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={outputUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      Download
                    </a>
                    <a
                      href={`${prefix}/schedule?mediaUrl=${encodeURIComponent(savedBlobUrl ?? outputUrl)}`}
                      className="flex-1 text-center py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Use in Post
                    </a>
                    <button
                      onClick={handleMakeVideo}
                      className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      Make Video
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                    >
                      Regenerate
                    </button>
                  </div>
                  {elapsed > 0 && (
                    <p className="text-xs text-center text-gray-400">
                      用时 {elapsed}s · {selectedModel.label}
                    </p>
                  )}
                </div>
              )}

              {status === "completed" &&
                outputUrl &&
                tab === "video" &&
                !enableLongVideo && (
                  <div className="space-y-4">
                    <video
                      key={outputUrl}
                      src={outputUrl}
                      controls
                      autoPlay
                      loop
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] mx-auto"
                    />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <a
                        href={outputUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-sm"
                      >
                        Download Video
                      </a>
                      <button
                        onClick={handleReset}
                        className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                      >
                        Generate Another
                      </button>
                    </div>
                    {elapsed > 0 && (
                      <p className="text-xs text-center text-gray-400">
                        Generated in {elapsed}s using {selectedModel.label}
                      </p>
                    )}
                  </div>
                )}

              {tab === "video" && longVideoSegments.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Long Video Segments
                      </h3>
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                        {
                          longVideoSegments.filter(
                            (s) => s.status === "completed",
                          ).length
                        }
                        /{longVideoSegments.length} completed
                      </span>
                    </div>
                    {isStitching && stitchProgress ? (
                      <div className="flex items-center gap-2 min-w-35">
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.round((stitchProgress.current / stitchProgress.total) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {stitchProgress.current}/{stitchProgress.total}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={handleStitch}
                        disabled={
                          isStitching ||
                          longVideoSegments.filter(
                            (s) => s.status === "completed",
                          ).length < 2
                        }
                        className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-50"
                      >
                        Stitch Segments
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {longVideoSegments.map((segment) => (
                      <div
                        key={segment.index}
                        className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-gray-700 dark:text-gray-200">
                            Segment {segment.index}
                          </p>
                          <p
                            className={`text-xs ${
                              segment.status === "completed"
                                ? "text-green-600"
                                : segment.status === "failed"
                                  ? "text-red-500"
                                  : segment.status === "generating"
                                    ? "text-blue-500"
                                    : "text-gray-400"
                            }`}
                          >
                            {segment.status}
                          </p>
                        </div>
                        {segment.taskId && (
                          <p className="text-xs text-gray-400 mt-1">
                            Task: {segment.taskId}
                          </p>
                        )}
                        {segment.outputUrl && (
                          <a
                            href={segment.outputUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                          >
                            Open segment video
                          </a>
                        )}
                        {segment.error && (
                          <p className="text-xs text-red-500 mt-1">
                            {segment.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(stitchedVideoUrl || isStitching) && tab === "video" && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      长视频
                    </h3>
                    {isStitching && stitchProgress && (
                      <div className="flex items-center gap-2 flex-1 ml-4">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.round((stitchProgress.current / stitchProgress.total) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                          {Math.round(
                            (stitchProgress.current / stitchProgress.total) *
                              100,
                          )}
                          % （{stitchProgress.current}/{stitchProgress.total}{" "}
                          段）
                        </span>
                      </div>
                    )}
                  </div>
                  {isStitching && !stitchProgress && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      合并中，请稍等…
                    </p>
                  )}
                  {!isStitching &&
                    !stitchedVideoUrl &&
                    longVideoSegments.some((s) => s.status === "completed") && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        合并失败，可在下方手动合并各段。
                      </p>
                    )}
                  {!isStitching && stitchedVideoUrl && (
                    <>
                      <video
                        key={stitchedVideoUrl}
                        src={stitchedVideoUrl}
                        controls
                        autoPlay
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] mx-auto"
                      />
                      <a
                        href={stitchedVideoUrl}
                        download="long-video.webm"
                        className="inline-flex text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                      >
                        下载长视频
                      </a>
                    </>
                  )}
                </div>
              )}

              {/* Audio mixing panel — shown when video is ready */}
              {tab === "video" &&
                (stitchedVideoUrl || (outputUrl && status === "completed")) && (
                  <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setAudioMode((prev) => (prev ? null : "voiceover"))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750"
                    >
                      <span>🎙 添加旁白 / 背景音乐</span>
                      <span className="text-gray-400">
                        {audioMode ? "▲" : "▼"}
                      </span>
                    </button>

                    {audioMode && (
                      <div className="p-4 space-y-4">
                        {/* Mode selector */}
                        <div className="flex gap-2">
                          {(["voiceover", "bgm", "both"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setAudioMode(m)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                audioMode === m
                                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                                  : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                              }`}
                            >
                              {m === "voiceover"
                                ? "🎙 旁白"
                                : m === "bgm"
                                  ? "🎵 背景音乐"
                                  : "两者都加"}
                            </button>
                          ))}
                        </div>

                        {/* Voiceover section */}
                        {(audioMode === "voiceover" ||
                          audioMode === "both") && (
                          <div className="space-y-3">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                              旁白文字
                            </label>
                            <textarea
                              value={voiceoverText}
                              onChange={(e) => setVoiceoverText(e.target.value)}
                              rows={3}
                              placeholder="输入旁白内容，支持中英文（最多 4096 字）…"
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                            />
                            <div className="flex flex-wrap gap-3 items-center">
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                  音色
                                </label>
                                <div className="flex items-center gap-2">
                                  <select
                                    value={ttsVoice}
                                    onChange={(e) => {
                                      setTtsVoice(
                                        e.target.value as typeof ttsVoice,
                                      );
                                      setTtsPreviewUrl(null);
                                    }}
                                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                                  >
                                    {(
                                      [
                                        "nova",
                                        "shimmer",
                                        "alloy",
                                        "echo",
                                        "fable",
                                        "onyx",
                                      ] as const
                                    ).map((v) => (
                                      <option key={v} value={v}>
                                        {v}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={handleTtsPreview}
                                    disabled={isTtsPreviewing}
                                    className="text-xs px-2 py-1 rounded border border-purple-400 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                                  >
                                    {isTtsPreviewing ? "生成中…" : "试听"}
                                  </button>
                                </div>
                              </div>
                              <div className="flex-1 min-w-30">
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                  旁白音量 {voiceoverVolume}%
                                </label>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={voiceoverVolume}
                                  onChange={(e) =>
                                    setVoiceoverVolume(Number(e.target.value))
                                  }
                                  className="w-full"
                                />
                              </div>
                            </div>
                            {ttsPreviewUrl && (
                              <audio
                                key={ttsPreviewUrl}
                                src={ttsPreviewUrl}
                                controls
                                autoPlay
                                className="w-full mt-1"
                              />
                            )}
                          </div>
                        )}

                        {/* BGM section */}
                        {(audioMode === "bgm" || audioMode === "both") && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                背景音乐
                              </label>
                              <div className="flex gap-1">
                                {(["ai", "upload"] as const).map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setBgmSource(s)}
                                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                                      bgmSource === s
                                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                                        : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                                    }`}
                                  >
                                    {s === "ai" ? "🎵 AI 生成" : "📁 上传文件"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {bgmSource === "ai" ? (
                              <div className="space-y-2">
                                <textarea
                                  value={bgmPrompt}
                                  onChange={(e) => setBgmPrompt(e.target.value)}
                                  rows={2}
                                  placeholder="描述音乐风格，例如：轻柔钢琴背景音乐，舒缓温暖，无人声…"
                                  className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                                />
                                <button
                                  type="button"
                                  onClick={handleGenerateBgm}
                                  disabled={isGeneratingBgm}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {isGeneratingBgm
                                    ? "AI 生成中…"
                                    : bgmAudioUrl
                                      ? "重新生成"
                                      : "AI 生成背景音乐"}
                                </button>
                                {bgmAudioUrl && (
                                  <audio
                                    key={bgmAudioUrl}
                                    src={bgmAudioUrl}
                                    controls
                                    className="w-full"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => bgmFileRef.current?.click()}
                                    className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                                  >
                                    {bgmFile ? bgmFile.name : "选择音频文件"}
                                  </button>
                                  {bgmFile && (
                                    <button
                                      type="button"
                                      onClick={() => setBgmFile(null)}
                                      className="text-xs text-red-500"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                                <input
                                  ref={bgmFileRef}
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={(e) =>
                                    setBgmFile(e.target.files?.[0] ?? null)
                                  }
                                />
                              </div>
                            )}

                            <div>
                              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                音乐音量 {bgmVolume}%
                              </label>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={bgmVolume}
                                onChange={(e) =>
                                  setBgmVolume(Number(e.target.value))
                                }
                                className="w-full"
                              />
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleMixAudio}
                          disabled={isMixing}
                          className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          {isMixing
                            ? "混音中…（实时渲染，请耐心等待）"
                            : "生成带音频视频"}
                        </button>

                        {audioError && (
                          <p className="text-xs text-red-500 dark:text-red-400">
                            {audioError}
                          </p>
                        )}

                        {mixedVideoUrl && (
                          <div className="space-y-2">
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ✓ 混音完成
                            </p>
                            <video
                              src={mixedVideoUrl}
                              controls
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[60vh]"
                            />
                            <a
                              href={mixedVideoUrl}
                              download="video-with-audio.webm"
                              className="inline-flex text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                            >
                              下载带音频视频
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
