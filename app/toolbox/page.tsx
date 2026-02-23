"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

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
    description: "Fast & cheap · final charge follows current pricing multiplier",
    tier: "fast",
    supportsAudio: false,
    durations: [5, 8],
  },
  {
    id: "wavespeed-ai/wan-2.2/i2v-720p",
    label: "Wan 2.2 i2v — 720p",
    description: "Higher resolution · final charge follows current pricing multiplier",
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
    description: "Higher resolution · final charge follows current pricing multiplier",
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
    id: "wavespeed-ai/uno",
    label: "UNO",
    description: "WaveSpeed 图像编辑（i2i / 图文）",
    tier: "standard",
  },
  {
    id: "wavespeed-ai/real-esrgan",
    label: "Real-ESRGAN",
    description: "WaveSpeed 图像增强/超分（i2i）",
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
  premium: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const CLIENT_DEFAULT_MARKUP_MULTIPLIER = 60;
const CLIENT_WAVESPEED_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_CHARGE_MULTIPLIER ??
    process.env.NEXT_PUBLIC_MARKUP_MULTIPLIER ??
    CLIENT_DEFAULT_MARKUP_MULTIPLIER
);
const CLIENT_WAVESPEED_IMAGE_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_IMAGE_CHARGE_MULTIPLIER ??
    CLIENT_WAVESPEED_CHARGE_MULTIPLIER
);
const CLIENT_WAVESPEED_VIDEO_CHARGE_MULTIPLIER = Number(
  process.env.NEXT_PUBLIC_WAVESPEED_VIDEO_CHARGE_MULTIPLIER ??
    CLIENT_WAVESPEED_CHARGE_MULTIPLIER
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

function getEstimatedBaseCostCents(modelId: string, mediaType: "image" | "video") {
  return (
    CLIENT_WAVESPEED_MODEL_BASE_COST_CENTS[modelId] ??
    (mediaType === "video" ? 30 : 5)
  );
}

function getEstimatedChargeCents(modelId: string, mediaType: "image" | "video") {
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
  Number(process.env.NEXT_PUBLIC_INPUT_CLEANUP_DELAY_MINUTES ?? DEFAULT_INPUT_CLEANUP_DELAY_MINUTES)
);
const INPUT_CLEANUP_DELAY_MS = INPUT_CLEANUP_DELAY_MINUTES * 60 * 1000;

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
  imageMode: "t2i" | "i2i" | "i2i_text"
) {
  if (tab === "video") {
    return `/toolbox?tab=video&mode=${videoMode}`;
  }
  return `/toolbox?tab=image&mode=${imageMode}`;
}

export default function ToolboxPage() {
  const [tab, setTab] = useState<Tab>("image");

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
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");

  // video audio
  const [generateAudio, setGenerateAudio] = useState(false);
  const [enableLongVideo, setEnableLongVideo] = useState(false);
  const [longVideoSegmentsCount, setLongVideoSegmentsCount] = useState(3);
  const [longVideoSegments, setLongVideoSegments] = useState<LongVideoSegment[]>([]);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);
  const [isStitching, setIsStitching] = useState(false);

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
      setAspectIdx(1); // 16:9 for video
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
    cleanupInputUrl?: string | null
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
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
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
      setImageUploadError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setImageUploadLoading(false);
    }
  };

  const onPasteImageForTarget = async (
    e: React.ClipboardEvent<HTMLDivElement>,
    target: "i2v" | "i2i"
  ) => {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    await handlePastedImage(file, target);
  };

  const onFilePickedForTarget = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "i2v" | "i2i"
  ) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await handlePastedImage(file, target);
    input.value = "";
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
    const basePrompt = prompt.trim();

    const initialSegments: LongVideoSegment[] = Array.from({ length: segmentCount }).map(
      (_, idx) => ({
        index: idx + 1,
        prompt: `${basePrompt}. Segment ${idx + 1}/${segmentCount}, keep continuity with the previous segment.`,
        taskId: null,
        pollUrl: null,
        status: "queued",
        outputUrl: null,
        error: null,
      })
    );

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
      for (const segment of initialSegments) {
        setLongVideoSegments((prev) =>
          prev.map((item) =>
            item.index === segment.index ? { ...item, status: "generating", error: null } : item
          )
        );

        const submitRes = await fetch("/api/toolbox/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: activeModelId,
            prompt: segment.prompt,
            duration,
            aspectRatio: ASPECT_RATIOS[aspectIdx].value,
            ...(videoMode === "i2v" && i2vImageUrl ? { imageUrl: i2vImageUrl } : {}),
            ...(generateAudio ? { generateAudio: true } : {}),
          }),
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok) {
          throw new Error(submitData.error || `Segment ${segment.index} submission failed`);
        }

        const segTaskId: string = submitData.task.id;
        const segPollUrl: string | null = submitData.task?.urls?.get ?? null;
        setLongVideoSegments((prev) =>
          prev.map((item) =>
            item.index === segment.index
              ? { ...item, taskId: segTaskId, pollUrl: segPollUrl, status: "generating" }
              : item
          )
        );
        setTaskId(segTaskId);
        setWsPollUrl(segPollUrl);
        setStatus("processing");

        const segOutputUrl = await pollVideoSync(segTaskId, segPollUrl ?? undefined);
        completedUrls.push(segOutputUrl);
        setLongVideoSegments((prev) =>
          prev.map((item) =>
            item.index === segment.index
              ? { ...item, status: "completed", outputUrl: segOutputUrl, error: null }
              : item
          )
        );
      }

      stopTimer();
      setStatus("completed");
      setOutputUrl(completedUrls[completedUrls.length - 1] ?? null);
      if (completedUrls.length > 0 && activeModel) {
        saveToGallery(
          "video",
          activeModelId,
          `${activeModel.label} (long-video segment)`,
          completedUrls[0],
          ASPECT_RATIOS[aspectIdx].value,
          {
            inputImageUrl: videoMode === "i2v" ? (i2vImageUrl ?? undefined) : undefined,
            generationMeta: {
              provider: "wavespeed",
              kind: "video",
              mode: videoMode,
              longVideo: true,
              segmentCount,
              duration,
              generateAudio,
            },
          }
        );
      }
      cleanupTempInput(videoMode === "i2v" ? i2vImageUrl : null);
    } catch (err) {
      stopTimer();
      setStatus("failed");
      const message = err instanceof Error ? err.message : "Long video generation failed";
      setError(message);
      setLongVideoSegments((prev) => {
        const active = prev.find((item) => item.status === "generating");
        if (!active) return prev;
        return prev.map((item) =>
          item.index === active.index ? { ...item, status: "failed", error: message } : item
        );
      });
      cleanupTempInput(videoMode === "i2v" ? i2vImageUrl : null);
    }
  };

  const handleStitch = async () => {
    const completedSegments = longVideoSegments.filter(
      (segment) => segment.status === "completed" && segment.outputUrl
    );
    if (completedSegments.length < 2) {
      setError("Need at least 2 completed segments to stitch.");
      return;
    }

    setIsStitching(true);
    setError("");
    try {
      const proxyUrls = completedSegments.map(
        (segment) => `/api/toolbox/proxy?url=${encodeURIComponent(segment.outputUrl!)}`
      );

      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.playsInline = true;
      video.muted = false;

      const captureVideo = video as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const stream =
        typeof captureVideo.captureStream === "function"
          ? captureVideo.captureStream()
          : captureVideo.mozCaptureStream?.();

      if (!stream) {
        throw new Error("captureStream is not supported in this browser.");
      }

      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType =
        candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";

      if (!mimeType) {
        throw new Error("MediaRecorder webm is not supported in this browser.");
      }

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const waitVideoEvent = (eventName: "ended" | "loadedmetadata" | "error") =>
        new Promise<void>((resolve, reject) => {
          const onDone = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("Failed while processing segment stream."));
          };
          const cleanup = () => {
            video.removeEventListener(eventName, onDone as EventListener);
            video.removeEventListener("error", onError);
          };
          video.addEventListener(eventName, onDone as EventListener, { once: true });
          video.addEventListener("error", onError, { once: true });
        });

      recorder.start();
      for (const proxyUrl of proxyUrls) {
        video.src = proxyUrl;
        await waitVideoEvent("loadedmetadata");
        await video.play();
        await waitVideoEvent("ended");
      }

      const stitchedBlob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener("stop", () => {
          if (chunks.length === 0) {
            reject(new Error("No recorded data generated."));
            return;
          }
          resolve(new Blob(chunks, { type: mimeType }));
        });
        recorder.addEventListener("error", () => reject(new Error("Recorder error")));
        recorder.stop();
      });

      const objectUrl = URL.createObjectURL(stitchedBlob);
      setStitchedVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
      setOutputUrl(objectUrl);
      setStatus("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stitch segments");
    } finally {
      setIsStitching(false);
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
          ...(videoMode === "i2v" && i2vImageUrl ? { imageUrl: i2vImageUrl } : {}),
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
      pollVideo(id, pollUrl, (outUrl) => {
        saveToGallery(
          "video",
          activeModelId,
          model.label,
          outUrl,
          ASPECT_RATIOS[aspectIdx].value,
          {
            inputImageUrl: videoMode === "i2v" ? (i2vImageUrl ?? undefined) : undefined,
            generationMeta: {
              provider: "wavespeed",
              kind: "video",
              mode: videoMode,
              duration,
              generateAudio,
              taskId: id,
              pollUrl: pollUrl ?? null,
            },
          }
        );
      }, videoMode === "i2v" ? i2vImageUrl : null);
    } catch (err) {
      stopTimer();
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const handleGenerateImage = async () => {
    if ((imageMode === "t2i" || imageMode === "i2i_text") && !prompt.trim()) return;
    if ((imageMode === "i2i" || imageMode === "i2i_text") && !imageInputUrl) return;
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
          imageUrl: imageInputUrl,
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
        const model = [...IMAGE_MODELS_T2I, ...IMAGE_MODELS_I2I].find((m) => m.id === imageModelId)!;
        saveToGallery("image", imageModelId, model.label, imgUrl, ASPECT_RATIOS[aspectIdx].value, {
          inputImageUrl: imageInputUrl || undefined,
          generationMeta: {
            provider: "wavespeed",
            kind: "image",
            mode: imageMode,
            syncMode: true,
            taskId: data.task?.id ?? null,
          },
        });
        cleanupTempInput((imageMode === "i2i" || imageMode === "i2i_text") ? imageInputUrl : null);
      } else if (data.task?.urls?.get) {
        // sync mode didn't complete yet — fall back to polling
        const id = data.task.id;
        const pollUrl: string = data.task.urls.get;
        setTaskId(id);
        setWsPollUrl(pollUrl);
        setStatus("processing");
        const model = [...IMAGE_MODELS_T2I, ...IMAGE_MODELS_I2I].find((m) => m.id === imageModelId)!;
        pollVideo(id, pollUrl, (outUrl) => {
          saveToGallery("image", imageModelId, model.label, outUrl, ASPECT_RATIOS[aspectIdx].value, {
            inputImageUrl: imageInputUrl || undefined,
            generationMeta: {
              provider: "wavespeed",
              kind: "image",
              mode: imageMode,
              syncMode: false,
              taskId: id,
              pollUrl,
            },
          });
        }, (imageMode === "i2i" || imageMode === "i2i_text") ? imageInputUrl : null);
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
    }
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
        const d = await r.json().catch(() => ({} as { error?: string; item?: { id?: string } }));
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
    setAspectIdx(1); // 16:9 default for video
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
    setAspectIdx(t === "image" ? 0 : 1); // image defaults 9:16, video defaults 16:9
  };

  const isRunning = status === "generating" || status === "processing";
  const currentImageModels = imageMode === "t2i" ? IMAGE_MODELS_T2I : IMAGE_MODELS_I2I;
  const currentModels = tab === "video"
    ? (videoMode === "i2v" ? I2V_MODELS : VIDEO_MODELS)
    : currentImageModels;
  const currentModelId = tab === "video"
    ? (videoMode === "i2v" ? i2vModelId : videoModelId)
    : imageModelId;
  const selectedModel = currentModels.find((m) => m.id === currentModelId) ?? currentModels[0];
  const selectedMediaType: "image" | "video" = tab === "video" ? "video" : "image";
  const durationFactor = tab === "video" ? Math.max(1, duration / 5) : 1;
  const runCount = tab === "video" && enableLongVideo ? longVideoSegmentsCount : 1;
  const estimatedPromptTokens = Math.max(
    0,
    Math.ceil((prompt.trim().length || 0) / 4) * (tab === "video" && enableLongVideo ? longVideoSegmentsCount : 1)
  );
  const estimatedSingleBaseCostCents = Math.round(
    getEstimatedBaseCostCents(currentModelId, selectedMediaType) * durationFactor
  );
  const estimatedSingleChargeCents = Math.round(
    getEstimatedChargeCents(currentModelId, selectedMediaType) * durationFactor
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
                Media Studio
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Generate images and videos with WaveSpeed
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link
                href="/gallery"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Gallery Feed
              </Link>
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                ← Dashboard Home
              </Link>
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
              {t === "image" ? "Image" : "Video"}
            </button>
          ))}
        </div>

        {/* Config card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tab === "image" ? "Image Generation" : "Video Generation"}
            </h2>
          </div>
          <div className="p-6 space-y-5">
            {/* Video mode toggle (t2v / i2v) */}
            {tab === "video" && (
              <div className="flex gap-2">
                <button
                  onClick={() => { setVideoMode("t2v"); setI2vImageUrl(null); }}
                  disabled={isRunning}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    videoMode === "t2v"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  Text to Video
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
                  Image to Video
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
                {([
                  { key: "t2i", label: "Text to Image", path: "/toolbox?tab=image&mode=t2i" },
                  { key: "i2i", label: "Image to Image", path: "/toolbox?tab=image&mode=i2i" },
                  {
                    key: "i2i_text",
                    label: "Image + Text to Image",
                    path: "/toolbox?tab=image&mode=i2i_text",
                  },
                ] as const).map((modeOption) => (
                  <button
                    key={modeOption.key}
                    onClick={() => {
                      const nextMode = modeOption.key;
                      setImageMode(nextMode);
                      const modelList = nextMode === "t2i" ? IMAGE_MODELS_T2I : IMAGE_MODELS_I2I;
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

            {tab === "image" && (imageMode === "i2i" || imageMode === "i2i_text") && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Input Image URL
                </label>
                <div
                  onPaste={(e) => void onPasteImageForTarget(e, "i2i")}
                  className="mb-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400"
                >
                  Paste image here (Ctrl/Cmd+V), or upload from file.
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void onFilePickedForTarget(e, "i2i")}
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
                    onChange={(e) => setImageInputUrl(e.target.value || null)}
                    disabled={isRunning}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                )}
              </div>
            )}

            {imageUploadLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Uploading image...</p>
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
                        videoMode === "i2v" ? setI2vModelId(m.id) : setVideoModelId(m.id);
                        if (!m.supportsAudio) setGenerateAudio(false);
                        // Clamp duration to what this model supports
                        const supported = m.durations ?? [5, 8];
                        if (!supported.includes(duration)) setDuration(supported[0]);
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
                      const mediaType: "image" | "video" = tab === "video" ? "video" : inferMediaTypeFromModelId(m.id);
                      const singleBaseCostCents = Math.round(
                        getEstimatedBaseCostCents(m.id, mediaType) * (tab === "video" ? Math.max(1, duration / 5) : 1)
                      );
                      const singleChargeCents = Math.round(
                        getEstimatedChargeCents(m.id, mediaType) * (tab === "video" ? Math.max(1, duration / 5) : 1)
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
                        Cost est: {formatUsdFromCents(singleChargeCents)} charged ·{" "}
                        {formatUsdFromCents(singleBaseCostCents)} model cost · token est ~
                        {Math.max(0, Math.ceil((prompt.trim().length || 0) / 4)).toLocaleString()}
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
                Prompt {tab === "image" && <span className="text-gray-400 font-normal">（支持中文）</span>}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder={
                  tab === "image"
                    ? imageMode === "i2i"
                      ? "可选：描述希望优化方向（不填也可以）"
                      : "描述你想要的图片，支持中英文..."
                    : "Describe the video you want to generate..."
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                disabled={isRunning}
              />
            </div>

            {/* Aspect ratio + Duration (video only) */}
            <div className={`grid gap-4 ${tab === "video" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
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

            {/* Long video generation */}
            {tab === "video" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={enableLongVideo}
                    onChange={(e) => setEnableLongVideo(e.target.checked)}
                    disabled={isRunning}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  Generate long video (multi-segment)
                </label>
                {enableLongVideo && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Segments:</span>
                    <select
                      value={longVideoSegmentsCount}
                      onChange={(e) => setLongVideoSegmentsCount(Number(e.target.value))}
                      disabled={isRunning}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                    <span className="text-gray-400">({duration}s each)</span>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 space-y-1.5">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Estimated Usage & Cost
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Model-side prompt tokens (est.): ~{estimatedPromptTokens.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                User charge (single run): {formatUsdFromCents(estimatedSingleChargeCents)}
                {tab === "video" ? ` · duration factor x${durationFactor.toFixed(1)}` : ""}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Model provider cost (single run): {formatUsdFromCents(estimatedSingleBaseCostCents)}
              </p>
              {runCount > 1 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Total for {runCount} runs: {formatUsdFromCents(estimatedTotalChargeCents)} charged ·{" "}
                  {formatUsdFromCents(estimatedTotalBaseCostCents)} provider cost
                </p>
              )}
              <p className="text-[11px] text-gray-500 dark:text-gray-500">
                Note: WaveSpeed is task-priced. Token estimate is prompt-length based and for reference only.
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
                (tab === "video" && (!prompt.trim() || (videoMode === "i2v" && !i2vImageUrl))) ||
                (tab === "image" &&
                  ((imageMode === "t2i" || imageMode === "i2i_text") &&
                    !prompt.trim())) ||
                (tab === "image" &&
                  (imageMode === "i2i" || imageMode === "i2i_text") &&
                  !imageInputUrl)
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
                    ? tab === "image" ? "图片生成完成" : "Video Ready"
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
                    href="/gallery"
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
                <button onClick={handleReset} className="text-sm text-blue-600 hover:underline">
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div className="text-center">
                    <p className="text-gray-700 dark:text-gray-300 font-medium">
                      {tab === "image"
                        ? `使用 ${selectedModel.label} 生成图片…`
                        : `Generating with ${selectedModel.label}…`}
                    </p>
                    {tab === "video" && taskId && (
                      <p className="text-xs text-gray-400 mt-1">Task: {taskId}</p>
                    )}
                    {elapsed > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {elapsed}s{tab === "video" ? " — video generation typically takes 1–3 minutes" : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {status === "failed" && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
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
                      href={`/schedule?mediaUrl=${encodeURIComponent(savedBlobUrl ?? outputUrl)}`}
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

              {status === "completed" && outputUrl && tab === "video" && (
                <div className="space-y-4">
                  <video
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
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Long Video Segments
                    </h3>
                    <button
                      onClick={handleStitch}
                      disabled={
                        isStitching ||
                        longVideoSegments.filter((segment) => segment.status === "completed").length < 2
                      }
                      className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-50"
                    >
                      {isStitching ? "Stitching..." : "Stitch Segments"}
                    </button>
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
                          <p className="text-xs text-gray-400 mt-1">Task: {segment.taskId}</p>
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
                          <p className="text-xs text-red-500 mt-1">{segment.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stitchedVideoUrl && tab === "video" && (
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Stitched Result
                  </h3>
                  <video
                    src={stitchedVideoUrl}
                    controls
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] mx-auto"
                  />
                  <a
                    href={stitchedVideoUrl}
                    download="long-video.webm"
                    className="inline-flex text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >
                    Download Stitched Video
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
