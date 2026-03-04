"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import ToolboxHeader from "@/components/toolbox/ToolboxHeader";

// ── Types ────────────────────────────────────────────────────────────────────

interface StitchClip {
  id: string;
  uploadedUrl: string;
  fileName: string;
  duration: number;
  trimStart: number;
  trimEnd: number;
  thumbnailUrl?: string;
  uploading: boolean;
  uploadError?: string;
}

type BgmMode = "none" | "upload" | "ai";
type JobStatus = "idle" | "uploading" | "submitting" | "processing" | "completed" | "failed";

// ── Cost calculation ─────────────────────────────────────────────────────────

function getStitchEstimateCents(clipCount: number): number {
  return 10 + 5 * clipCount;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VideoStitchPage() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  const t = isZh
    ? {
        title: "视频拼接",
        subtitle: "上传多个视频片段，裁剪并拼接为完整视频",
        galleryFeed: "作品社区",
        videoJobs: "📊 视频任务",
        videoStitch: "✂️ 视频拼接",
        modelDocs: "📖 模型文档",
        dashboardHome: "← 仪表盘",
        loadingBalance: "余额加载中...",
        balance: "余额",
        add: "+ 充值",
        backToToolbox: "← 返回工具箱",
        uploadZone: "拖拽视频到此处，或点击选择文件",
        uploadHint: "支持 MP4, WebM, MOV, AVI · 每文件最大 200MB",
        addClips: "+ 添加视频片段",
        reorderHint: "↕ 拖拽调整顺序",
        clipCount: "片段数",
        totalDuration: "总时长",
        trimStart: "开始",
        trimEnd: "结束",
        remove: "删除",
        crossfade: "转场时长 (秒)",
        bgmTitle: "背景音乐",
        bgmNone: "无",
        bgmUpload: "上传",
        bgmAi: "AI 生成",
        bgmPrompt: "描述音乐风格...",
        bgmVolume: "音乐音量",
        generateBgm: "生成",
        generatingBgm: "生成中...",
        estimatedCost: "预估费用",
        stitch: "开始拼接",
        stitching: "拼接中...",
        download: "下载视频",
        stitchAgain: "重新拼接",
        needClips: "请至少上传 2 个视频片段",
        elapsed: "已用时",
        error: "拼接失败",
        success: "拼接完成！",
        sec: "秒",
      }
    : {
        title: "Video Stitch",
        subtitle: "Upload multiple clips, trim and stitch them into one video",
        galleryFeed: "Gallery Feed",
        videoJobs: "📊 Video Jobs",
        videoStitch: "✂️ Video Stitch",
        modelDocs: "📖 Model Docs",
        dashboardHome: "← Dashboard Home",
        loadingBalance: "Loading balance...",
        balance: "Balance",
        add: "+ Add",
        backToToolbox: "← Back to Toolbox",
        uploadZone: "Drag & drop videos here, or click to select",
        uploadHint: "MP4, WebM, MOV, AVI supported · 200MB max per file",
        addClips: "+ Add Clips",
        reorderHint: "↕ Drag to reorder",
        clipCount: "Clips",
        totalDuration: "Total Duration",
        trimStart: "Start",
        trimEnd: "End",
        remove: "Remove",
        crossfade: "Crossfade (sec)",
        bgmTitle: "Background Music",
        bgmNone: "None",
        bgmUpload: "Upload",
        bgmAi: "AI Generate",
        bgmPrompt: "Describe music style...",
        bgmVolume: "BGM Volume",
        generateBgm: "Generate",
        generatingBgm: "Generating...",
        estimatedCost: "Est. Cost",
        stitch: "Start Stitch",
        stitching: "Stitching...",
        download: "Download Video",
        stitchAgain: "Stitch Again",
        needClips: "Upload at least 2 clips",
        elapsed: "Elapsed",
        error: "Stitch failed",
        success: "Stitch complete!",
        sec: "s",
      };

  // ── State ────────────────────────────────────────────────────────────────────

  const [clips, setClips] = useState<StitchClip[]>([]);
  const [crossfade, setCrossfade] = useState(0.5);
  const [bgmMode, setBgmMode] = useState<BgmMode>("none");
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bgmAudioUrl, setBgmAudioUrl] = useState<string | null>(null);
  const [bgmPrompt, setBgmPrompt] = useState("");
  const [bgmVolume, setBgmVolume] = useState(30);
  const [isGeneratingBgm, setIsGeneratingBgm] = useState(false);

  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditLoading, setCreditLoading] = useState(true);
  const [isTrial, setIsTrial] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  // ── Browser title ────────────────────────────────────────────────────────────

  useEffect(() => {
    document.title = isZh ? "视频拼接 | xPilot" : "Video Stitch | xPilot";
  }, [isZh]);

  // ── Fetch credit balance ─────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/usage");
        const data = await res.json();
        if (res.ok && data.creditBalance !== undefined) {
          setCreditBalance(data.creditBalance);
          setCreditLoading(false);
          return;
        }
      } catch {}
      try {
        const res = await fetch("/api/landing/balance");
        const data = await res.json();
        if (res.ok && data.remainingCents !== undefined) {
          setCreditBalance(data.remainingCents);
          setIsTrial(true);
        }
      } catch {}
      setCreditLoading(false);
    })();
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const genId = () => crypto.randomUUID();

  const getTotalDuration = () => {
    return clips.reduce((sum, c) => sum + (c.trimEnd - c.trimStart), 0);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Generate thumbnail from video ────────────────────────────────────────────

  const generateThumbnail = (url: string): Promise<string> =>
    new Promise((resolve) => {
      const vid = document.createElement("video");
      vid.crossOrigin = "anonymous";
      vid.muted = true;
      vid.preload = "metadata";
      vid.src = url;
      vid.addEventListener("loadeddata", () => {
        vid.currentTime = Math.min(1, vid.duration * 0.1);
      });
      vid.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        canvas.getContext("2d")!.drawImage(vid, 0, 0, 160, 90);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      });
      vid.addEventListener("error", () => resolve(""));
    });

  // ── Get video duration ───────────────────────────────────────────────────────

  const getVideoDuration = (url: string): Promise<number> =>
    new Promise((resolve) => {
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.src = url;
      vid.addEventListener("loadedmetadata", () => resolve(vid.duration || 0));
      vid.addEventListener("error", () => resolve(0));
    });

  // ── Upload file ──────────────────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File) => {
    const id = genId();
    const clip: StitchClip = {
      id,
      uploadedUrl: "",
      fileName: file.name,
      duration: 0,
      trimStart: 0,
      trimEnd: 0,
      uploading: true,
    };
    setClips((prev) => [...prev, clip]);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/toolbox/upload-video", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      const url = data.url as string;
      const proxyUrl = `/api/toolbox/proxy?url=${encodeURIComponent(url)}`;
      const [dur, thumb] = await Promise.all([
        getVideoDuration(proxyUrl),
        generateThumbnail(proxyUrl),
      ]);

      setClips((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, uploadedUrl: url, duration: dur, trimEnd: dur, thumbnailUrl: thumb, uploading: false }
            : c,
        ),
      );
    } catch (err) {
      setClips((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, uploading: false, uploadError: err instanceof Error ? err.message : "Upload failed" }
            : c,
        ),
      );
    }
  }, []);

  // ── File handlers ────────────────────────────────────────────────────────────

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) => f.type.startsWith("video/"));
      arr.forEach(uploadFile);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  // ── Clip reorder (DnD) ──────────────────────────────────────────────────────

  const onDragStart = (idx: number) => {
    dragIdxRef.current = idx;
  };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdxRef.current === null || dragIdxRef.current === idx) return;
    setClips((prev) => {
      const next = [...prev];
      const [item] = next.splice(dragIdxRef.current!, 1);
      next.splice(idx, 0, item);
      dragIdxRef.current = idx;
      return next;
    });
  };

  const onDragEnd = () => {
    dragIdxRef.current = null;
  };

  // ── Remove clip ──────────────────────────────────────────────────────────────

  const removeClip = (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
  };

  // ── Update trim ──────────────────────────────────────────────────────────────

  const updateTrim = (id: string, field: "trimStart" | "trimEnd", val: number) => {
    setClips((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === "trimStart") return { ...c, trimStart: Math.max(0, Math.min(val, c.trimEnd - 0.5)) };
        return { ...c, trimEnd: Math.max(c.trimStart + 0.5, Math.min(val, c.duration)) };
      }),
    );
  };

  // ── Upload BGM file ──────────────────────────────────────────────────────────

  const handleBgmFileUpload = async (file: File) => {
    const url = URL.createObjectURL(file);
    setBgmFile(file);
    setBgmAudioUrl(url);
  };

  // ── Generate BGM via AI ──────────────────────────────────────────────────────

  const handleGenerateBgm = async () => {
    if (!bgmPrompt.trim() || clips.length === 0) return;
    setIsGeneratingBgm(true);
    try {
      const firstClipUrl = clips[0].uploadedUrl;
      const res = await fetch("/api/toolbox/bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: firstClipUrl,
          prompt: bgmPrompt,
          duration: Math.min(30, getTotalDuration()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "BGM generation failed");

      // Poll for BGM task completion
      const taskId = data.task?.id;
      if (!taskId) throw new Error("No task ID returned");

      const pollBgm = async () => {
        const pollRes = await fetch(`/api/toolbox/bgm?taskId=${encodeURIComponent(taskId)}`);
        const pollData = await pollRes.json();
        if (pollData.task?.status === "completed" && pollData.task?.outputs?.[0]) {
          const audioUrl = `/api/toolbox/proxy?url=${encodeURIComponent(pollData.task.outputs[0])}`;
          setBgmAudioUrl(audioUrl);
          setIsGeneratingBgm(false);
        } else if (pollData.task?.status === "failed") {
          throw new Error(pollData.task.error || "BGM generation failed");
        } else {
          setTimeout(pollBgm, 3000);
        }
      };
      await pollBgm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "BGM generation failed");
      setIsGeneratingBgm(false);
    }
  };

  // ── Submit stitch ────────────────────────────────────────────────────────────

  const handleStitch = async () => {
    const readyClips = clips.filter((c) => c.uploadedUrl && !c.uploading && !c.uploadError);
    if (readyClips.length < 2) return;

    setJobStatus("submitting");
    setError("");
    setResultUrl(null);
    setElapsed(0);

    try {
      // Upload BGM file to blob if it's a local file
      let bgmPayload: { url: string; volume: number } | undefined;
      if (bgmMode === "upload" && bgmFile) {
        const form = new FormData();
        form.append("file", bgmFile);
        const uploadRes = await fetch("/api/toolbox/upload-image", { method: "POST", body: form });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "BGM upload failed");
        bgmPayload = { url: uploadData.url, volume: bgmVolume };
      } else if (bgmMode === "ai" && bgmAudioUrl) {
        // bgmAudioUrl is a proxy URL, need to get the original URL
        const urlParam = new URLSearchParams(bgmAudioUrl.split("?")[1]).get("url");
        if (urlParam) bgmPayload = { url: urlParam, volume: bgmVolume };
      }

      const body = {
        clips: readyClips.map((c) => ({
          url: c.uploadedUrl,
          trimStart: c.trimStart > 0 ? c.trimStart : undefined,
          trimEnd: c.trimEnd < c.duration ? c.trimEnd : undefined,
        })),
        crossfadeDuration: crossfade,
        bgm: bgmPayload,
      };

      const res = await fetch("/api/toolbox/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");

      setJobId(data.jobId);
      setJobStatus("processing");

      // Deduct from local balance display
      if (creditBalance !== null) {
        setCreditBalance(creditBalance - data.costCents);
      }

      // Start timer
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

      // Start polling
      const poll = async () => {
        try {
          const pollRes = await fetch(`/api/toolbox/stitch?jobId=${data.jobId}`);
          const pollData = await pollRes.json();

          if (pollData.status === "completed" && pollData.resultUrl) {
            setResultUrl(pollData.resultUrl);
            setJobStatus("completed");
            if (timerRef.current) clearInterval(timerRef.current);
            return;
          }
          if (pollData.status === "failed") {
            setError(pollData.error || t.error);
            setJobStatus("failed");
            if (timerRef.current) clearInterval(timerRef.current);
            return;
          }
          pollRef.current = setTimeout(poll, 3000);
        } catch {
          pollRef.current = setTimeout(poll, 5000);
        }
      };
      pollRef.current = setTimeout(poll, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stitch failed");
      setJobStatus("failed");
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setJobStatus("idle");
    setJobId(null);
    setResultUrl(null);
    setError("");
    setElapsed(0);
    if (pollRef.current) clearTimeout(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const readyClips = clips.filter((c) => c.uploadedUrl && !c.uploading && !c.uploadError);
  const canStitch = readyClips.length >= 2 && jobStatus === "idle";
  const isRunning = jobStatus === "submitting" || jobStatus === "processing";
  const costCents = getStitchEstimateCents(readyClips.length);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToolboxHeader
        uiText={{ ...t }}
        prefix={prefix}
        locale={locale}
        creditLoading={creditLoading}
        creditBalance={creditBalance}
        isTrial={isTrial}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Back link */}
        <a
          href={`${prefix}/toolbox`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t.backToToolbox}
        </a>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Clip Manager ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Upload zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors bg-white dark:bg-gray-800"
            >
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">{t.uploadZone}</p>
              <p className="text-xs text-gray-400 mt-1">{t.uploadHint}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* Clip list */}
            {clips.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t.clipCount}: {readyClips.length} · {t.totalDuration}: {formatTime(getTotalDuration())}
                  </span>
                  <span className="text-xs text-gray-400">{t.reorderHint}</span>
                </div>

                {clips.map((clip, idx) => (
                  <div
                    key={clip.id}
                    draggable={!clip.uploading}
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    onDragEnd={onDragEnd}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing"
                  >
                    {/* Number + drag handle */}
                    <div className="text-gray-400 text-sm font-mono w-6 text-center select-none">
                      {idx + 1}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-24 h-14 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                      {clip.thumbnailUrl ? (
                        <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : clip.uploading ? (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 animate-pulse">
                          ...
                        </div>
                      ) : null}
                    </div>

                    {/* Info + trim */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{clip.fileName}</p>
                      {clip.uploading ? (
                        <p className="text-xs text-blue-500 animate-pulse">Uploading...</p>
                      ) : clip.uploadError ? (
                        <p className="text-xs text-red-500">{clip.uploadError}</p>
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                          <label className="text-xs text-gray-400">{t.trimStart}</label>
                          <input
                            type="number"
                            min={0}
                            max={clip.trimEnd - 0.5}
                            step={0.1}
                            value={clip.trimStart.toFixed(1)}
                            onChange={(e) => updateTrim(clip.id, "trimStart", parseFloat(e.target.value) || 0)}
                            className="w-16 text-xs px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                          />
                          <label className="text-xs text-gray-400">{t.trimEnd}</label>
                          <input
                            type="number"
                            min={clip.trimStart + 0.5}
                            max={clip.duration}
                            step={0.1}
                            value={clip.trimEnd.toFixed(1)}
                            onChange={(e) => updateTrim(clip.id, "trimEnd", parseFloat(e.target.value) || clip.duration)}
                            className="w-16 text-xs px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                          />
                          <span className="text-xs text-gray-400">
                            / {formatTime(clip.duration)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeClip(clip.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors text-lg"
                      title={t.remove}
                    >
                      &times;
                    </button>
                  </div>
                ))}

                {/* Add more */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  {t.addClips}
                </button>
              </div>
            )}
          </div>

          {/* ── Right: Settings & Output ──────────────────────────────────── */}
          <div className="space-y-4">
            {/* Settings card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              {/* Crossfade */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.crossfade}
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={crossfade}
                    onChange={(e) => setCrossfade(parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-10 text-right">
                    {crossfade.toFixed(1)}{t.sec}
                  </span>
                </div>
              </div>

              {/* BGM */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.bgmTitle}
                </label>
                <div className="flex gap-2 mt-1">
                  {(["none", "upload", "ai"] as BgmMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => { setBgmMode(mode); setBgmAudioUrl(null); setBgmFile(null); }}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        bgmMode === mode
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400"
                      }`}
                    >
                      {mode === "none" ? t.bgmNone : mode === "upload" ? t.bgmUpload : t.bgmAi}
                    </button>
                  ))}
                </div>

                {bgmMode === "upload" && (
                  <div className="mt-2">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => e.target.files?.[0] && handleBgmFileUpload(e.target.files[0])}
                      className="text-xs"
                    />
                    {bgmAudioUrl && (
                      <audio controls src={bgmAudioUrl} className="w-full mt-2 h-8" />
                    )}
                  </div>
                )}

                {bgmMode === "ai" && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={bgmPrompt}
                      onChange={(e) => setBgmPrompt(e.target.value)}
                      placeholder={t.bgmPrompt}
                      className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    />
                    <button
                      onClick={handleGenerateBgm}
                      disabled={isGeneratingBgm || !bgmPrompt.trim() || clips.length === 0}
                      className="text-xs px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGeneratingBgm ? t.generatingBgm : t.generateBgm}
                    </button>
                    {bgmAudioUrl && (
                      <audio controls src={bgmAudioUrl} className="w-full h-8" />
                    )}
                  </div>
                )}

                {bgmMode !== "none" && (
                  <div className="mt-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">{t.bgmVolume}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={bgmVolume}
                        onChange={(e) => setBgmVolume(parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500 w-8 text-right">{bgmVolume}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cost estimate */}
              {readyClips.length >= 2 && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{t.estimatedCost}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      ${(costCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Stitch button */}
              <button
                onClick={handleStitch}
                disabled={!canStitch}
                className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  canStitch
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isRunning ? t.stitching : readyClips.length < 2 ? t.needClips : t.stitch}
              </button>
            </div>

            {/* Running status */}
            {isRunning && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t.stitching} {t.elapsed}: {elapsed}{t.sec}
                </p>
              </div>
            )}

            {/* Error */}
            {jobStatus === "failed" && error && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">{t.error}</p>
                <p className="text-xs text-red-500 mt-1">{error}</p>
                <button
                  onClick={handleReset}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  {t.stitchAgain}
                </button>
              </div>
            )}

            {/* Result */}
            {jobStatus === "completed" && resultUrl && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4 space-y-3">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">{t.success}</p>
                <video
                  controls
                  src={resultUrl}
                  className="w-full rounded-lg"
                  style={{ maxHeight: 300 }}
                />
                <div className="flex gap-2">
                  <a
                    href={resultUrl}
                    download="stitched-video.mp4"
                    className="flex-1 text-center py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    {t.download}
                  </a>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t.stitchAgain}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
