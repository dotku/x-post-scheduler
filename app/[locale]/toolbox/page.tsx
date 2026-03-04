"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import {
  type Tab,
  type TaskStatus,
  type SaveStatus,
  type LongVideoSegment,
  I2V_MODELS,
  VIDEO_MODELS,
  IMAGE_MODELS_T2I,
  IMAGE_MODELS_I2I,
  ASPECT_RATIOS,
  T2V_TO_I2V,
  INPUT_CLEANUP_DELAY_MS,
} from "@/components/toolbox/constants";
import {
  getEstimatedBaseCostCents,
  getEstimatedChargeCents,
  getToolboxVisitingPath,
} from "@/components/toolbox/utils";
import { stitchProxyUrls, extractLastFrame } from "@/components/toolbox/video-stitcher";
import ToolboxHeader from "@/components/toolbox/ToolboxHeader";
import TabSelector from "@/components/toolbox/TabSelector";
import ConfigCard from "@/components/toolbox/ConfigCard";
import ResultsCard from "@/components/toolbox/ResultsCard";

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
        textToVideo: "文本转视频",
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
  const [isTrial, setIsTrial] = useState(false);

  // shared
  const [prompt, setPrompt] = useState("");
  const [aspectIdx, setAspectIdx] = useState(0);
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
  const [imageInputUrls, setImageInputUrls] = useState<string[]>([]);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");

  // video audio
  const [generateAudio, setGenerateAudio] = useState(false);
  const [lockCamera, setLockCamera] = useState(false);
  const [enableLongVideo, setEnableLongVideo] = useState(false);
  const [longVideoSegmentsCount, setLongVideoSegmentsCount] = useState(3);
  const [longVideoSegments, setLongVideoSegments] = useState<LongVideoSegment[]>([]);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);
  const [isStitching, setIsStitching] = useState(false);
  const [stitchProgress, setStitchProgress] = useState<{ current: number; total: number } | null>(null);

  // audio mixing
  const [audioMode, setAudioMode] = useState<"voiceover" | "bgm" | "both" | null>(null);
  const [voiceoverText, setVoiceoverText] = useState("");
  const [ttsVoice, setTtsVoice] = useState<"alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer">("nova");
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
      setAspectIdx(0);
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

  // Fetch credit balance (authenticated → /api/usage, fallback → /api/landing/balance for trial)
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
          setCreditLoading(false);
          return;
        }
      } catch {
        // Not authenticated — try trial balance
      }
      try {
        const res = await fetch("/api/landing/balance");
        const data = await res.json();
        if (res.ok && data.remainingCents !== undefined) {
          setCreditBalance(data.remainingCents);
          setIsTrial(true);
        }
      } catch {
        // ignore
      }
      setCreditLoading(false);
    };
    fetchBalance();
  }, []);

  // ── Helper functions ──────────────────────────────────────────────────────

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
      }).catch(() => {});
    }, INPUT_CLEANUP_DELAY_MS);
    cleanupTimerRefs.current.push(timerId);
  };

  const pollVideo = (
    id: string,
    pollUrl?: string,
    onComplete?: (url: string) => void,
    cleanupInputUrl?: string | null,
    provider?: "wavespeed" | "seedance",
  ) => {
    pollRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (pollUrl) params.set("pollUrl", pollUrl);
        if (provider) params.set("provider", provider);
        const qs = params.toString() ? `?${params.toString()}` : "";
        const url = `/api/toolbox/video/${id}${qs}`;
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
          pollVideo(id, pollUrl, onComplete, cleanupInputUrl, provider);
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
    target: "i2v" | "i2i",
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
    target: "i2v" | "i2i",
  ) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    await handlePastedImage(file, target);
    input.value = "";
  };

  const onMultiImageFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const pollVideoSync = (id: string, pollUrl?: string, provider?: "wavespeed" | "seedance") =>
    new Promise<string>((resolve, reject) => {
      const tick = async () => {
        try {
          const params = new URLSearchParams();
          if (pollUrl) params.set("pollUrl", pollUrl);
          if (provider) params.set("provider", provider);
          const qs = params.toString() ? `?${params.toString()}` : "";
          const url = `/api/toolbox/video/${id}${qs}`;
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

  // ── Core generation handlers ──────────────────────────────────────────────

  const saveToGallery = (
    type: "image" | "video",
    modelId: string,
    modelLabel: string,
    galleryOutputUrl: string,
    aspectRatio: string,
    options?: { inputImageUrl?: string; generationMeta?: Record<string, unknown> },
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
        sourceUrl: galleryOutputUrl,
        inputImageUrl: options?.inputImageUrl,
        generationMeta: options?.generationMeta,
        aspectRatio,
        isPublic: saveAsPublic,
      }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}) as { error?: string; item?: { id?: string } });
        if (!r.ok) throw new Error(d.error || "保存失败");
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

  const handleGenerateLongVideo = async () => {
    if (!prompt.trim()) return;
    if (videoMode === "i2v" && !i2vImageUrl) return;

    const activeModelId = videoMode === "i2v" ? i2vModelId : videoModelId;
    const activeModels = videoMode === "i2v" ? I2V_MODELS : VIDEO_MODELS;
    const activeModel = activeModels.find((m) => m.id === activeModelId);
    const segmentCount = Math.max(2, Math.min(8, longVideoSegmentsCount));

    const initialSegments: LongVideoSegment[] = Array.from({ length: segmentCount }).map((_, idx) => ({
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
      if (!submitRes.ok) throw new Error(submitData.error || "Failed to submit job");

      const jobId = submitData.jobId;
      setTaskId(jobId);

      const pollJob = async () => {
        try {
          const res = await fetch(`/api/toolbox/video/long-gen/${jobId}`);
          const jobData = await res.json();
          if (!res.ok) throw new Error(jobData.error || "Failed to fetch job status");

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

          if (jobData.status === "completed") {
            stopTimer();
            setStatus("completed");
            setOutputUrl(jobData.completedUrls?.[jobData.completedUrls.length - 1] ?? null);

            if (jobData.completedUrls?.length >= 2) {
              setIsStitching(true);
              try {
                const proxyUrls = jobData.completedUrls.map(
                  (url: string) => `/api/toolbox/proxy?url=${encodeURIComponent(url)}`,
                );
                const stitchedUrl = await stitchProxyUrls(proxyUrls, (current, total) =>
                  setStitchProgress({ current, total }),
                );
                setStitchedVideoUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return stitchedUrl;
                });
                setOutputUrl(stitchedUrl);
              } catch (stitchErr) {
                setError(stitchErr instanceof Error ? stitchErr.message : "Auto-stitch failed");
              } finally {
                setIsStitching(false);
                setStitchProgress(null);
              }
            }

            if (jobData.completedUrls?.length > 0 && activeModel) {
              saveToGallery("video", activeModelId, `${activeModel.label} (long-video segment)`, jobData.completedUrls[0], ASPECT_RATIOS[aspectIdx].value, {
                inputImageUrl: videoMode === "i2v" ? (i2vImageUrl ?? undefined) : undefined,
                generationMeta: { provider: "wavespeed", kind: "video", mode: videoMode, longVideo: true, segmentCount, duration, generateAudio },
              });
            }
          } else if (jobData.status === "failed") {
            stopTimer();
            setStatus("failed");
            setError(jobData.error || "Job failed");
          } else {
            setTimeout(pollJob, 3000);
          }
        } catch (err) {
          stopTimer();
          setStatus("failed");
          setError(err instanceof Error ? err.message : "Polling error");
        }
      };

      pollJob();
    } catch (err) {
      stopTimer();
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Failed to start job");
    }
  };

  const handleStitch = async () => {
    const completedSegments = longVideoSegments.filter((s) => s.status === "completed" && s.outputUrl);
    if (completedSegments.length < 2) {
      setError("Need at least 2 completed segments to stitch.");
      return;
    }
    setIsStitching(true);
    setStitchProgress({ current: 0, total: completedSegments.length });
    setError("");
    try {
      const proxyUrls = completedSegments.map((s) => `/api/toolbox/proxy?url=${encodeURIComponent(s.outputUrl!)}`);
      const objectUrl = await stitchProxyUrls(proxyUrls, (current, total) => setStitchProgress({ current, total }));
      setStitchedVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
      setOutputUrl(objectUrl);
      setStatus("completed");

      const activeModelId = videoMode === "i2v" ? i2vModelId : videoModelId;
      const activeModels = videoMode === "i2v" ? I2V_MODELS : VIDEO_MODELS;
      const activeModel = activeModels.find((m) => m.id === activeModelId);
      if (activeModel && objectUrl) {
        saveToGallery("video", activeModelId, `${activeModel.label} (stitched ${completedSegments.length} segments)`, objectUrl, ASPECT_RATIOS[aspectIdx].value, {
          inputImageUrl: videoMode === "i2v" ? (i2vImageUrl ?? undefined) : undefined,
          generationMeta: { provider: "wavespeed", kind: "video", mode: videoMode, longVideo: true, segmentCount: completedSegments.length, duration, generateAudio, stitched: true },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stitch segments");
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
    if (needsVoiceover && !voiceoverText.trim()) { setAudioError("请输入旁白文本"); return; }
    if (needsBgm && bgmSource === "upload" && !bgmFile) { setAudioError("请选择背景音乐文件"); return; }
    if (needsBgm && bgmSource === "ai" && !bgmAudioUrl) { setAudioError("请先点击「AI 生成背景音乐」"); return; }

    setIsMixing(true);
    setAudioError("");
    const audioCtx = new AudioContext();
    const cleanupEls: HTMLElement[] = [];
    const blobUrls: string[] = [];

    try {
      await audioCtx.resume();

      let ttsBlob: Blob | null = null;
      if (needsVoiceover) {
        const res = await fetch("/api/toolbox/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: voiceoverText.trim(), voice: ttsVoice }) });
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j as { error?: string }).error || "TTS generation failed"); }
        ttsBlob = await res.blob();
      }

      const videoSrc = sourceUrl.startsWith("blob:") ? sourceUrl : `/api/toolbox/proxy?url=${encodeURIComponent(sourceUrl)}`;
      const videoEl = document.createElement("video");
      videoEl.playsInline = true;
      videoEl.muted = true;
      videoEl.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
      document.body.appendChild(videoEl);
      cleanupEls.push(videoEl);

      await new Promise<void>((resolve, reject) => {
        videoEl.addEventListener("loadedmetadata", () => resolve(), { once: true });
        videoEl.addEventListener("error", () => reject(new Error("视频加载失败")), { once: true });
        videoEl.src = videoSrc;
        videoEl.load();
      });

      const dest = audioCtx.createMediaStreamDestination();
      const audioPlayEls: HTMLAudioElement[] = [];

      const addAudioTrack = async (blobOrFile: Blob | File, volume: number, loop: boolean) => {
        const objUrl = URL.createObjectURL(blobOrFile);
        blobUrls.push(objUrl);
        const el = document.createElement("audio");
        el.src = objUrl;
        el.loop = loop;
        document.body.appendChild(el);
        cleanupEls.push(el);
        await new Promise<void>((resolve, reject) => {
          el.addEventListener("canplaythrough", () => resolve(), { once: true });
          el.addEventListener("error", () => reject(new Error("音频加载失败")), { once: true });
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

      const captureVideo = videoEl as HTMLVideoElement & { captureStream?: () => MediaStream };
      const videoStream = captureVideo.captureStream?.();
      if (!videoStream) throw new Error("captureStream 不支持，请使用 Chrome 浏览器");

      const combined = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      const mimeType = candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
      if (!mimeType) throw new Error("当前浏览器不支持 WebM 录制");

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(combined, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.start(100);
      await Promise.all([videoEl.play(), ...audioPlayEls.map((el) => el.play())]);
      await new Promise<void>((resolve, reject) => {
        videoEl.addEventListener("ended", () => resolve(), { once: true });
        videoEl.addEventListener("error", () => reject(new Error("播放出错")), { once: true });
      });
      for (const el of audioPlayEls) el.pause();

      const blob = await new Promise<Blob>((resolve, reject) => {
        recorder.addEventListener("stop", () => {
          if (chunks.length === 0) { reject(new Error("录制无数据，请检查视频是否可正常播放")); return; }
          resolve(new Blob(chunks, { type: mimeType }));
        });
        recorder.addEventListener("error", () => reject(new Error("Recorder error")));
        recorder.stop();
      });

      const url = URL.createObjectURL(blob);
      setMixedVideoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "Audio mixing failed");
    } finally {
      for (const el of cleanupEls) { try { document.body.removeChild(el); } catch { /* ok */ } }
      for (const u of blobUrls) URL.revokeObjectURL(u);
      audioCtx.close().catch(() => {});
      setIsMixing(false);
    }
  };

  const handleTtsPreview = async () => {
    if (!voiceoverText.trim()) { setAudioError("请输入旁白文本再预览"); return; }
    setIsTtsPreviewing(true);
    setAudioError("");
    try {
      const res = await fetch("/api/toolbox/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: voiceoverText.trim(), voice: ttsVoice }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j as { error?: string }).error || "TTS preview failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setTtsPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "TTS preview failed");
    } finally {
      setIsTtsPreviewing(false);
    }
  };

  const handleGenerateBgm = async () => {
    const sourceUrl = mixedVideoUrl || stitchedVideoUrl || outputUrl;
    if (!sourceUrl) { setAudioError("请先生成视频"); return; }
    if (!bgmPrompt.trim()) { setAudioError("请输入音乐风格描述"); return; }
    setIsGeneratingBgm(true);
    setAudioError("");

    let videoUrl = sourceUrl;
    if (sourceUrl.startsWith("blob:")) {
      videoUrl = outputUrl && !outputUrl.startsWith("blob:") ? outputUrl : sourceUrl;
    }

    try {
      const submitRes = await fetch("/api/toolbox/bgm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoUrl, prompt: bgmPrompt.trim() }) });
      const submitData = (await submitRes.json()) as { task?: { id: string; urls?: { get?: string } }; error?: string };
      if (!submitRes.ok) throw new Error(submitData.error ?? "BGM submission failed");

      const bgmTaskId = submitData.task!.id;
      const bgmPollUrl = submitData.task!.urls?.get ?? null;

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(`/api/toolbox/bgm?taskId=${encodeURIComponent(bgmPollUrl ?? bgmTaskId)}`);
        const pollData = (await pollRes.json()) as { task?: { status: string; outputs: string[] }; error?: string };
        if (!pollRes.ok) throw new Error(pollData.error ?? "Poll failed");
        const task = pollData.task!;
        if (task.status === "completed" && task.outputs.length > 0) {
          const proxyUrl = `/api/toolbox/proxy?url=${encodeURIComponent(task.outputs[0])}`;
          const audioBlob = await fetch(proxyUrl).then((r) => r.blob());
          const url = URL.createObjectURL(audioBlob);
          setBgmAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
          break;
        }
        if (task.status === "failed") throw new Error("BGM generation failed");
      }
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : "BGM generation failed");
    } finally {
      setIsGeneratingBgm(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) return;
    if (videoMode === "i2v" && !i2vImageUrl) return;
    setError("");
    setLongVideoSegments([]);
    if (stitchedVideoUrl) { URL.revokeObjectURL(stitchedVideoUrl); setStitchedVideoUrl(null); }
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
          modelId: activeModelId, prompt, duration,
          aspectRatio: ASPECT_RATIOS[aspectIdx].value,
          ...(videoMode === "i2v" && i2vImageUrl ? { imageUrl: i2vImageUrl } : {}),
          ...(generateAudio ? { generateAudio: true } : {}),
          ...(lockCamera ? { lockCamera: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const id = data.task.id;
      const videoPollUrl: string | undefined = data.task?.urls?.get;
      const videoProvider = activeModelId.startsWith("seedance-2.0/") ? "seedance" as const : "wavespeed" as const;
      setTaskId(id);
      setWsPollUrl(videoPollUrl ?? null);
      setStatus("processing");
      const model = activeModels.find((m) => m.id === activeModelId)!;
      pollVideo(id, videoPollUrl, (outUrl) => {
        saveToGallery("video", activeModelId, model.label, outUrl, ASPECT_RATIOS[aspectIdx].value, {
          inputImageUrl: videoMode === "i2v" ? (i2vImageUrl ?? undefined) : undefined,
          generationMeta: { provider: videoProvider, kind: "video", mode: videoMode, duration, generateAudio, taskId: id, pollUrl: videoPollUrl ?? null },
        });
      }, videoMode === "i2v" ? i2vImageUrl : null, videoProvider);
    } catch (err) {
      stopTimer();
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  const handleGenerateImage = async () => {
    if ((imageMode === "t2i" || imageMode === "i2i_text") && !prompt.trim()) return;
    const isMultiModel = imageModelId === "wavespeed-ai/flux-kontext-pro/multi";
    if ((imageMode === "i2i" || imageMode === "i2i_text") && !imageInputUrl && (!isMultiModel || imageInputUrls.length === 0)) return;
    setError("");
    setLongVideoSegments([]);
    if (stitchedVideoUrl) { URL.revokeObjectURL(stitchedVideoUrl); setStitchedVideoUrl(null); }
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
          modelId: imageModelId, prompt, mode: imageMode,
          imageUrl: isMultiModel ? undefined : imageInputUrl,
          imageUrls: isMultiModel ? imageInputUrls : undefined,
          aspectRatio: ASPECT_RATIOS[aspectIdx].value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const imgUrl = data.task?.outputs?.[0];
      if (imgUrl) {
        stopTimer();
        setStatus("completed");
        setOutputUrl(imgUrl);
        const model = [...IMAGE_MODELS_T2I, ...IMAGE_MODELS_I2I].find((m) => m.id === imageModelId)!;
        saveToGallery("image", imageModelId, model.label, imgUrl, ASPECT_RATIOS[aspectIdx].value, {
          inputImageUrl: imageInputUrl || undefined,
          generationMeta: { provider: "wavespeed", kind: "image", mode: imageMode, syncMode: true, taskId: data.task?.id ?? null },
        });
        cleanupTempInput(imageMode === "i2i" || imageMode === "i2i_text" ? imageInputUrl : null);
      } else if (data.task?.urls?.get) {
        const id = data.task.id;
        const imgPollUrl: string = data.task.urls.get;
        setTaskId(id);
        setWsPollUrl(imgPollUrl);
        setStatus("processing");
        const model = [...IMAGE_MODELS_T2I, ...IMAGE_MODELS_I2I].find((m) => m.id === imageModelId)!;
        pollVideo(id, imgPollUrl, (outUrl) => {
          saveToGallery("image", imageModelId, model.label, outUrl, ASPECT_RATIOS[aspectIdx].value, {
            inputImageUrl: imageInputUrl || undefined,
            generationMeta: { provider: "wavespeed", kind: "image", mode: imageMode, syncMode: false, taskId: id, pollUrl: imgPollUrl },
          });
        }, imageMode === "i2i" || imageMode === "i2i_text" ? imageInputUrl : null);
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

  // ── UI handlers ──────────────────────────────────────────────────────────

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
    if (stitchedVideoUrl) URL.revokeObjectURL(stitchedVideoUrl);
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
    setAspectIdx(0);
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
    if (stitchedVideoUrl) URL.revokeObjectURL(stitchedVideoUrl);
    setStitchedVideoUrl(null);
    setIsStitching(false);
    setAspectIdx(0);
  };

  const handleSelectModel = (modelId: string, model: any) => {
    if (tab === "video") {
      videoMode === "i2v" ? setI2vModelId(modelId) : setVideoModelId(modelId);
      setGenerateAudio(!!model.supportsAudio);
      const supported = model.durations ?? [5, 8];
      if (!supported.includes(duration)) setDuration(supported[0]);
    } else {
      setImageModelId(modelId);
    }
  };

  // ── Computed values ───────────────────────────────────────────────────────

  const isRunning = status === "generating" || status === "processing";
  const currentImageModels = imageMode === "t2i" ? IMAGE_MODELS_T2I : IMAGE_MODELS_I2I;
  const currentModels = tab === "video" ? (videoMode === "i2v" ? I2V_MODELS : VIDEO_MODELS) : currentImageModels;
  const currentModelId = tab === "video" ? (videoMode === "i2v" ? i2vModelId : videoModelId) : imageModelId;
  const selectedModel = currentModels.find((m) => m.id === currentModelId) ?? currentModels[0];
  const selectedMediaType: "image" | "video" = tab === "video" ? "video" : "image";
  const durationFactor = tab === "video" ? Math.max(1, duration / 5) : 1;
  const runCount = tab === "video" && enableLongVideo ? longVideoSegmentsCount : 1;
  const estimatedPromptTokens = Math.max(0, Math.ceil((prompt.trim().length || 0) / 4) * (tab === "video" && enableLongVideo ? longVideoSegmentsCount : 1));
  const estimatedSingleBaseCostCents = Math.round(getEstimatedBaseCostCents(currentModelId, selectedMediaType) * durationFactor);
  const estimatedSingleChargeCents = Math.round(getEstimatedChargeCents(currentModelId, selectedMediaType) * durationFactor);
  const estimatedTotalBaseCostCents = estimatedSingleBaseCostCents * runCount;
  const estimatedTotalChargeCents = estimatedSingleChargeCents * runCount;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToolboxHeader
        uiText={uiText}
        prefix={prefix}
        locale={locale}
        creditLoading={creditLoading}
        creditBalance={creditBalance}
        isTrial={isTrial}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <TabSelector tab={tab} onTabChange={handleTabChange} uiText={uiText} />

        <ConfigCard
          tab={tab}
          videoMode={videoMode}
          imageMode={imageMode}
          currentModels={currentModels}
          currentModelId={currentModelId}
          selectedModel={selectedModel}
          prompt={prompt}
          aspectIdx={aspectIdx}
          duration={duration}
          generateAudio={generateAudio}
          lockCamera={lockCamera}
          saveAsPublic={saveAsPublic}
          enableLongVideo={enableLongVideo}
          longVideoSegmentsCount={longVideoSegmentsCount}
          subscriptionTier={subscriptionTier}
          i2vImageUrl={i2vImageUrl}
          imageInputUrl={imageInputUrl}
          imageInputUrls={imageInputUrls}
          imageUploadLoading={imageUploadLoading}
          imageUploadError={imageUploadError}
          imageModelId={imageModelId}
          isRunning={isRunning}
          isZh={isZh}
          locale={locale}
          prefix={prefix}
          estimatedPromptTokens={estimatedPromptTokens}
          estimatedSingleChargeCents={estimatedSingleChargeCents}
          estimatedSingleBaseCostCents={estimatedSingleBaseCostCents}
          estimatedTotalChargeCents={estimatedTotalChargeCents}
          estimatedTotalBaseCostCents={estimatedTotalBaseCostCents}
          runCount={runCount}
          durationFactor={durationFactor}
          uiText={uiText}
          onSetVideoMode={setVideoMode}
          onSetImageMode={setImageMode}
          onSetPrompt={setPrompt}
          onSetAspectIdx={setAspectIdx}
          onSetDuration={setDuration}
          onSetGenerateAudio={setGenerateAudio}
          onSetLockCamera={setLockCamera}
          onSetSaveAsPublic={setSaveAsPublic}
          onSetEnableLongVideo={setEnableLongVideo}
          onSetLongVideoSegmentsCount={setLongVideoSegmentsCount}
          onSelectModel={handleSelectModel}
          onSetI2vImageUrl={setI2vImageUrl}
          onSetImageInputUrl={setImageInputUrl}
          onSetImageInputUrls={setImageInputUrls}
          onPasteImage={(e, target) => void onPasteImageForTarget(e, target)}
          onFilePicked={(e, target) => void onFilePickedForTarget(e, target)}
          onMultiFilePicked={(e) => void onMultiImageFilesPicked(e)}
          onGenerate={tab === "image" ? handleGenerateImage : enableLongVideo ? handleGenerateLongVideo : handleGenerateVideo}
        />

        {(isRunning || status === "completed" || status === "failed") && (
          <ResultsCard
            tab={tab}
            status={status}
            isRunning={isRunning}
            error={error}
            elapsed={elapsed}
            taskId={taskId}
            outputUrl={outputUrl}
            selectedModel={selectedModel}
            enableLongVideo={enableLongVideo}
            prefix={prefix}
            isZh={isZh}
            saveStatus={saveStatus}
            saveError={saveError}
            savedBlobUrl={savedBlobUrl}
            longVideoSegments={longVideoSegments}
            isStitching={isStitching}
            stitchProgress={stitchProgress}
            stitchedVideoUrl={stitchedVideoUrl}
            audioMode={audioMode}
            voiceoverText={voiceoverText}
            ttsVoice={ttsVoice}
            voiceoverVolume={voiceoverVolume}
            bgmSource={bgmSource}
            bgmFile={bgmFile}
            bgmVolume={bgmVolume}
            bgmPrompt={bgmPrompt}
            bgmAudioUrl={bgmAudioUrl}
            isGeneratingBgm={isGeneratingBgm}
            isMixing={isMixing}
            isTtsPreviewing={isTtsPreviewing}
            ttsPreviewUrl={ttsPreviewUrl}
            mixedVideoUrl={mixedVideoUrl}
            audioError={audioError}
            onReset={handleReset}
            onMakeVideo={handleMakeVideo}
            onStitch={handleStitch}
            onMixAudio={handleMixAudio}
            onTtsPreview={handleTtsPreview}
            onGenerateBgm={handleGenerateBgm}
            onSetAudioMode={setAudioMode}
            onSetVoiceoverText={setVoiceoverText}
            onSetTtsVoice={setTtsVoice as (v: string) => void}
            onSetVoiceoverVolume={setVoiceoverVolume}
            onSetBgmSource={setBgmSource as (s: string) => void}
            onSetBgmFile={setBgmFile}
            onSetBgmVolume={setBgmVolume}
            onSetBgmPrompt={setBgmPrompt}
          />
        )}
      </main>
    </div>
  );
}
