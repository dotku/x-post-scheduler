"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

// ── Video models ──────────────────────────────────────────────────────────────
const VIDEO_MODELS = [
  {
    id: "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast",
    label: "Wan 2.2 — 480p Ultra Fast",
    description: "~5s · $0.05/video",
    tier: "fast",
  },
  {
    id: "wavespeed-ai/wan-2.2/t2v-720p",
    label: "Wan 2.2 — 720p",
    description: "Higher resolution · $0.30/video",
    tier: "standard",
  },
  {
    id: "alibaba/wan-2.6/text-to-video",
    label: "Wan 2.6",
    description: "Latest Wan with audio",
    tier: "standard",
  },
  {
    id: "bytedance/seedance-v1.5-pro/text-to-video",
    label: "Seedance 1.5 Pro",
    description: "Cinematic quality",
    tier: "premium",
  },
  {
    id: "kwaivgi/kling-video-o3-std/text-to-video",
    label: "Kling Video O3",
    description: "Best motion quality",
    tier: "premium",
  },
];

// ── Image models ──────────────────────────────────────────────────────────────
const IMAGE_MODELS = [
  {
    id: "bytedance/seedream-v4.5",
    label: "Seedream 4.5",
    description: "最新版 · 原生中英双语 · 最高 4K · $0.04/张",
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
];

const DURATIONS = [5, 8];

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

const TIER_COLORS: Record<string, string> = {
  fast: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  standard: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  premium: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function ToolboxPage() {
  const [tab, setTab] = useState<Tab>("image");

  // shared
  const [prompt, setPrompt] = useState("");
  const [aspectIdx, setAspectIdx] = useState(1); // default 16:9
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // video-specific
  const [videoModelId, setVideoModelId] = useState(VIDEO_MODELS[0].id);
  const [duration, setDuration] = useState(5);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [wsPollUrl, setWsPollUrl] = useState<string | null>(null);

  // image-specific
  const [imageModelId, setImageModelId] = useState(IMAGE_MODELS[0].id);

  // gallery save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
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

  const pollVideo = (id: string, pollUrl?: string, onComplete?: (url: string) => void) => {
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
        } else if (task.status === "failed") {
          stopTimer();
          setStatus("failed");
          setError(task.error ?? "Generation failed");
        } else {
          pollVideo(id, pollUrl, onComplete);
        }
      } catch (err) {
        stopTimer();
        setStatus("failed");
        setError(err instanceof Error ? err.message : "Polling error");
      }
    }, 3000);
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) return;
    setError("");
    setOutputUrl(null);
    setTaskId(null);
    setWsPollUrl(null);
    setStatus("generating");
    startTimer();

    try {
      const res = await fetch("/api/toolbox/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: videoModelId,
          prompt,
          duration,
          aspectRatio: ASPECT_RATIOS[aspectIdx].value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const id = data.task.id;
      const pollUrl: string | undefined = data.task?.urls?.get;
      setTaskId(id);
      setWsPollUrl(pollUrl ?? null);
      setStatus("processing");
      const model = VIDEO_MODELS.find((m) => m.id === videoModelId)!;
      pollVideo(id, pollUrl, (outUrl) => {
        saveToGallery("video", videoModelId, model.label, outUrl, ASPECT_RATIOS[aspectIdx].value);
      });
    } catch (err) {
      stopTimer();
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;
    setError("");
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
        const model = IMAGE_MODELS.find((m) => m.id === imageModelId)!;
        saveToGallery("image", imageModelId, model.label, imgUrl, ASPECT_RATIOS[aspectIdx].value);
      } else if (data.task?.urls?.get) {
        // sync mode didn't complete yet — fall back to polling
        const id = data.task.id;
        const pollUrl: string = data.task.urls.get;
        setTaskId(id);
        setWsPollUrl(pollUrl);
        setStatus("processing");
        const model = IMAGE_MODELS.find((m) => m.id === imageModelId)!;
        pollVideo(id, pollUrl, (outUrl) => {
          saveToGallery("image", imageModelId, model.label, outUrl, ASPECT_RATIOS[aspectIdx].value);
        });
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
    aspectRatio: string
  ) => {
    setSaveStatus("saving");
    setSavedItemId(null);
    setSaveError("");
    fetch("/api/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, modelId, modelLabel, prompt, sourceUrl: outputUrl, aspectRatio }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({} as { error?: string; item?: { id?: string } }));
        if (!r.ok) {
          throw new Error(d.error || "保存失败");
        }
        if (d.item?.id) {
          setSaveStatus("saved");
          setSavedItemId(d.item.id);
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
    setSaveError("");
  };

  const handleTabChange = (t: Tab) => {
    handleReset();
    setPrompt("");
    setTab(t);
    setAspectIdx(t === "image" ? 0 : 1); // image defaults 9:16, video defaults 16:9
  };

  const isRunning = status === "generating" || status === "processing";
  const currentModels = tab === "video" ? VIDEO_MODELS : IMAGE_MODELS;
  const currentModelId = tab === "video" ? videoModelId : imageModelId;
  const selectedModel = currentModels.find((m) => m.id === currentModelId)!;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Media Studio
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Generate images and videos with WaveSpeed
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/gallery"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm"
              >
                Gallery Feed
              </Link>
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm"
              >
                ← Dashboard Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
            {/* Model selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Model
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      tab === "video"
                        ? setVideoModelId(m.id)
                        : setImageModelId(m.id)
                    }
                    disabled={isRunning}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                      currentModelId === m.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {m.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {m.description}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[m.tier]}`}
                    >
                      {m.tier}
                    </span>
                  </button>
                ))}
              </div>
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
                    ? "描述你想要的图片，支持中英文..."
                    : "Describe the video you want to generate..."
                }
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                disabled={isRunning}
              />
            </div>

            {/* Aspect ratio + Duration (video only) */}
            <div className={`grid gap-4 ${tab === "video" ? "grid-cols-2" : "grid-cols-1"}`}>
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
                    {DURATIONS.map((d) => (
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

            {/* Generate button */}
            <button
              onClick={tab === "image" ? handleGenerateImage : handleGenerateVideo}
              disabled={!prompt.trim() || isRunning}
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
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
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
                  <div className="flex gap-3">
                    <a
                      href={outputUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      下载图片
                    </a>
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                    >
                      再生成
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
                  <div className="flex gap-3">
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
