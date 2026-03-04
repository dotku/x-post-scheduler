"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/wavespeed";
import { TEXT_MODELS, DEFAULT_TEXT_MODEL } from "@/lib/ai-models";

export default function LandingEditor({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";

  // --- Editor-related state ---
  const [trialTopic, setTrialTopic] = useState("");
  const [trialLanguage, setTrialLanguage] = useState("English");
  const [trialTone, setTrialTone] = useState("");
  const [trialGoal, setTrialGoal] = useState("");
  const [trialOutput, setTrialOutput] = useState("");
  const [trialTextModelId, setTrialTextModelId] = useState(
    DEFAULT_TEXT_MODEL.id,
  );
  const [trialGenerating, setTrialGenerating] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialRemainingCents, setTrialRemainingCents] = useState<number | null>(
    null,
  );
  const [xKeysOpen, setXKeysOpen] = useState(false);
  const [xApiKey, setXApiKey] = useState("");
  const [xApiSecret, setXApiSecret] = useState("");
  const [xAccessToken, setXAccessToken] = useState("");
  const [xAccessTokenSecret, setXAccessTokenSecret] = useState("");
  const [xPublishing, setXPublishing] = useState(false);
  const [xPublishResult, setXPublishResult] = useState<{
    success?: boolean;
    tweetUrl?: string;
    error?: string;
  } | null>(null);
  // Editor mode tabs
  const [editorMode, setEditorMode] = useState<
    "text" | "image" | "video" | "voice"
  >("text");
  // Voice (TTS) generation state
  const [voiceText, setVoiceText] = useState("");
  const [voiceVoice, setVoiceVoice] = useState<
    "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
  >("nova");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceGenerating, setVoiceGenerating] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Image generation state
  const t2iModels = useMemo(
    () => IMAGE_MODELS.filter((m) => !m.mode || m.mode === "t2i"),
    [],
  );
  const [imgModelId, setImgModelId] = useState("bytedance/seedream-v4.5");
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgAspect, setImgAspect] = useState("1:1");
  const [imgGenerating, setImgGenerating] = useState(false);
  const [imgOutput, setImgOutput] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  // Video generation state
  const t2vModels = useMemo(() => [...VIDEO_MODELS], []);
  const [vidModelId, setVidModelId] = useState(
    "wavespeed-ai/wan-2.2/t2v-480p-ultra-fast",
  );
  const [vidPrompt, setVidPrompt] = useState("");
  const [vidAspect, setVidAspect] = useState("16:9");
  const [vidDuration, setVidDuration] = useState(5);
  const [vidGenerating, setVidGenerating] = useState(false);
  const [vidOutput, setVidOutput] = useState<string | null>(null);
  const [vidError, setVidError] = useState<string | null>(null);
  const vidPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Editor-related useEffects ---

  // Cleanup poll timers on unmount
  useEffect(() => {
    return () => {
      if (vidPollRef.current) clearTimeout(vidPollRef.current);
    };
  }, []);

  // Auto-save generated images to community gallery
  useEffect(() => {
    if (!imgOutput) return;
    const model = t2iModels.find((m) => m.id === imgModelId);
    fetch("/api/landing/save-gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "image",
        modelId: imgModelId,
        modelLabel: model?.label ?? imgModelId,
        prompt: imgPrompt,
        sourceUrl: imgOutput,
        aspectRatio: imgAspect,
      }),
    }).catch(() => {}); // fire-and-forget
  }, [imgOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save generated videos to community gallery
  useEffect(() => {
    if (!vidOutput) return;
    const model = t2vModels.find((m) => m.id === vidModelId);
    fetch("/api/landing/save-gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "video",
        modelId: vidModelId,
        modelLabel: model?.label ?? vidModelId,
        prompt: vidPrompt,
        sourceUrl: vidOutput,
        aspectRatio: vidAspect,
      }),
    }).catch(() => {}); // fire-and-forget
  }, [vidOutput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch trial/user credit balance on load
  useEffect(() => {
    fetch("/api/landing/balance")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.remainingCents === "number") {
          setTrialRemainingCents(data.remainingCents);
        }
      })
      .catch(() => {});
  }, []);

  // Session storage restore
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem("landing-editor-draft");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        topic?: string;
        xHandle?: string;
        xCredentials?: {
          apiKey: string;
          apiSecret: string;
          accessToken: string;
          accessTokenSecret: string;
        };
        language?: string;
        tone?: string;
        goal?: string;
        output?: string;
      };
      setTrialTopic(parsed.topic ?? "");
      setTrialLanguage(parsed.language ?? "English");
      setTrialTone(parsed.tone ?? "");
      setTrialGoal(parsed.goal ?? "");
      setTrialOutput(parsed.output ?? "");
    } catch {
      // ignore invalid session payload
    }
  }, []);

  // Session storage save
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      "landing-editor-draft",
      JSON.stringify({
        topic: trialTopic,
        language: trialLanguage,
        tone: trialTone,
        goal: trialGoal,
        output: trialOutput,
      }),
    );
  }, [trialTopic, trialLanguage, trialTone, trialGoal, trialOutput]);

  // --- Editor-related handler functions ---

  async function handleGenerateTrialPost() {
    const topic = trialTopic.trim();
    const tone = trialTone.trim();
    const goal = trialGoal.trim();

    if (!topic || !tone || !goal) return;

    setTrialGenerating(true);
    setTrialError(null);
    setXPublishResult(null);

    try {
      const res = await fetch("/api/landing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          tone,
          goal,
          language: trialLanguage,
          model: trialTextModelId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "trial_exhausted") {
          setTrialError(
            locale === "zh"
              ? "今日 $1 免费额度已用完。注册后赠送 $5 正式额度。"
              : "Your free trial ($1/day) is used up. Sign up to get $5 free credits.",
          );
        } else {
          setTrialError(data.message || data.error || "Generation failed");
        }
        return;
      }

      setTrialOutput(data.content ?? "");
      if (typeof data.remainingCents === "number") {
        setTrialRemainingCents(data.remainingCents);
      }
    } catch {
      setTrialError(
        locale === "zh"
          ? "生成失败，请重试"
          : "Generation failed, please try again",
      );
    } finally {
      setTrialGenerating(false);
    }
  }

  async function handlePublishToX() {
    if (!trialOutput.trim()) return;
    setXPublishing(true);
    setXPublishResult(null);
    try {
      const res = await fetch("/api/landing/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trialOutput,
          xApiKey,
          xApiSecret,
          xAccessToken,
          xAccessTokenSecret,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setXPublishResult({
          success: false,
          error: data.error || "Publish failed",
        });
      } else {
        setXPublishResult({ success: true, tweetUrl: data.tweetUrl });
      }
    } catch {
      setXPublishResult({
        success: false,
        error:
          locale === "zh"
            ? "发布失败，请重试"
            : "Publish failed, please try again",
      });
    } finally {
      setXPublishing(false);
    }
  }

  function handleInsufficientCredits(data: { error?: string }) {
    const exhaustedMsg =
      locale === "zh"
        ? "今日 $1 免费额度已用完。注册后赠送 $5 正式额度。"
        : "Your free trial ($1/day) is used up. Sign up to get $5 free credits.";
    return data.error?.includes("INSUFFICIENT") ||
      data.error?.includes("trial_exhausted")
      ? exhaustedMsg
      : data.error ||
          (locale === "zh" ? "生成失败，请重试" : "Generation failed");
  }

  async function handleGenerateImage() {
    if (!imgPrompt.trim()) return;
    setImgGenerating(true);
    setImgOutput(null);
    setImgError(null);
    try {
      const res = await fetch("/api/toolbox/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: imgModelId,
          prompt: imgPrompt,
          aspectRatio: imgAspect,
          mode: "t2i",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImgError(handleInsufficientCredits(data));
        return;
      }

      // Update balance from response
      if (typeof data.remainingCents === "number") {
        setTrialRemainingCents(data.remainingCents);
      }

      // Sync: outputs returned immediately
      let output = data.task?.outputs?.[0] ?? null;
      if (output) {
        setImgOutput(output);
        return;
      }

      // Async: poll until completed (max ~2 min)
      const taskId = data.task?.id;
      const pollUrl = data.task?.urls?.get;
      if (!taskId) {
        setImgError(locale === "zh" ? "生成失败，请重试" : "Generation failed");
        return;
      }
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const endpoint = pollUrl
          ? `/api/toolbox/video/${taskId}?pollUrl=${encodeURIComponent(pollUrl)}`
          : `/api/toolbox/video/${taskId}`;
        const pollRes = await fetch(endpoint);
        const pollData = await pollRes.json();
        const task = pollData.task;
        if (task?.status === "completed") {
          output = task.outputs?.[0] ?? null;
          if (output) setImgOutput(output);
          else setImgError(locale === "zh" ? "生成失败，请重试" : "Generation failed");
          return;
        }
        if (task?.status === "failed") {
          setImgError(task.error || (locale === "zh" ? "生成失败" : "Generation failed"));
          return;
        }
      }
      setImgError(locale === "zh" ? "生成超时，请重试" : "Generation timed out");
    } catch {
      setImgError(locale === "zh" ? "网络错误" : "Network error");
    } finally {
      setImgGenerating(false);
    }
  }

  function pollVideoStatus(taskId: string, pollUrl?: string) {
    vidPollRef.current = setTimeout(async () => {
      try {
        const qs = pollUrl
          ? `?pollUrl=${encodeURIComponent(pollUrl)}`
          : "";
        const url = `/api/toolbox/video/${taskId}${qs}`;
        const res = await fetch(url);
        const data = await res.json();
        const task = data.task;
        if (task?.status === "completed") {
          setVidOutput(task.outputs?.[0] ?? null);
          setVidGenerating(false);
        } else if (task?.status === "failed") {
          setVidError(
            task.error || (locale === "zh" ? "生成失败" : "Generation failed"),
          );
          setVidGenerating(false);
        } else {
          pollVideoStatus(taskId, pollUrl);
        }
      } catch {
        setVidError(locale === "zh" ? "网络错误" : "Network error");
        setVidGenerating(false);
      }
    }, 3000);
  }

  async function handleGenerateVideo() {
    if (!vidPrompt.trim()) return;
    if (vidPollRef.current) clearTimeout(vidPollRef.current);
    setVidGenerating(true);
    setVidOutput(null);
    setVidError(null);
    try {
      const res = await fetch("/api/toolbox/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: vidModelId,
          prompt: vidPrompt,
          duration: vidDuration,
          aspectRatio: vidAspect,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVidError(handleInsufficientCredits(data));
        setVidGenerating(false);
        return;
      }
      if (typeof data.remainingCents === "number") {
        setTrialRemainingCents(data.remainingCents);
      }
      const taskId = data.task?.id;
      const taskPollUrl = data.task?.urls?.get;
      if (taskId) {
        pollVideoStatus(taskId, taskPollUrl);
      } else {
        setVidError(locale === "zh" ? "生成失败" : "Generation failed");
        setVidGenerating(false);
      }
    } catch {
      setVidError(locale === "zh" ? "网络错误" : "Network error");
      setVidGenerating(false);
    }
  }

  async function handleGenerateVoice() {
    if (!voiceText.trim()) return;
    setVoiceGenerating(true);
    setVoiceOutput(null);
    setVoiceError(null);
    try {
      const res = await fetch("/api/toolbox/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: voiceText,
          voice: voiceVoice,
          speed: voiceSpeed,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setVoiceError(
          res.status === 401
            ? locale === "zh"
              ? "请先登录后使用语音功能"
              : "Please sign in to use voice generation"
            : handleInsufficientCredits(data),
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setVoiceOutput(url);
    } catch {
      setVoiceError(locale === "zh" ? "网络错误" : "Network error");
    } finally {
      setVoiceGenerating(false);
    }
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
        <div className="flex flex-col gap-2 mb-6">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {t("editorTitle")}
          </h3>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("editorSubtitle")}
            </p>
            <Link
              href={`${prefix}/docs/models`}
              className="shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {locale === "zh" ? "查看模型文档 →" : "View model docs →"}
            </Link>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-100 dark:bg-gray-900 rounded-lg w-full overflow-x-auto">
          {(["text", "image", "video", "voice"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setEditorMode(mode)}
              className={`shrink-0 whitespace-nowrap px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                editorMode === mode
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {mode === "text"
                ? locale === "zh"
                  ? "📝 文字"
                  : "📝 Text"
                : mode === "image"
                  ? locale === "zh"
                    ? "🖼️ 图片"
                    : "🖼️ Image"
                  : mode === "video"
                    ? locale === "zh"
                      ? "🎬 视频"
                      : "🎬 Video"
                    : locale === "zh"
                      ? "🎙️ 语音"
                      : "🎙️ Voice"}
            </button>
          ))}
        </div>

        {editorMode === "text" && (
          <>
            {/* Sample presets */}
            <div className="mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {locale === "zh" ? "快速填入示例 →" : "Try a sample →"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    {
                      topic:
                        locale === "zh"
                          ? "新菜品上市推广"
                          : "New menu launch promotion",
                      tone: locale === "zh" ? "热情、诱人" : "warm, appetizing",
                      goal: locale === "zh" ? "吸引到店" : "drive foot traffic",
                    },
                    {
                      topic:
                        locale === "zh"
                          ? "医美抗衰新技术"
                          : "Anti-aging skincare treatment",
                      tone:
                        locale === "zh"
                          ? "专业、值得信赖"
                          : "professional, trustworthy",
                      goal: locale === "zh" ? "预约咨询" : "book consultations",
                    },
                    {
                      topic:
                        locale === "zh"
                          ? "2026 年投资理财策略"
                          : "2026 investment strategies",
                      tone: locale === "zh" ? "理性、自信" : "analytical, confident",
                      goal:
                        locale === "zh"
                          ? "建立专业形象"
                          : "establish thought leadership",
                    },
                    {
                      topic:
                        locale === "zh"
                          ? "旧金山湾区新房源"
                          : "New SF Bay Area listing",
                      tone: locale === "zh" ? "简洁、有吸引力" : "concise, compelling",
                      goal: locale === "zh" ? "吸引看房" : "generate showings",
                    },
                    {
                      topic:
                        locale === "zh"
                          ? "法律知识科普：租房权益"
                          : "Legal tips: Tenant rights",
                      tone:
                        locale === "zh"
                          ? "权威、通俗易懂"
                          : "authoritative, accessible",
                      goal:
                        locale === "zh"
                          ? "涨粉、建立信任"
                          : "grow following & build trust",
                    },
                  ] as const
                ).map((sample) => (
                  <button
                    key={sample.topic}
                    type="button"
                    onClick={() => {
                      setTrialTopic(sample.topic);
                      setTrialTone(sample.tone);
                      setTrialGoal(sample.goal);
                    }}
                    className="rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors"
                  >
                    {sample.topic}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {t("editorTopicLabel")}
                </span>
                <input
                  value={trialTopic}
                  onChange={(e) => setTrialTopic(e.target.value)}
                  placeholder={t("editorTopicPlaceholder")}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {t("editorLanguageLabel")}
                </span>
                <select
                  value={trialLanguage}
                  onChange={(e) => setTrialLanguage(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="English">English</option>
                  <option value="中文">中文</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {t("editorToneLabel")}
                </span>
                <input
                  value={trialTone}
                  onChange={(e) => setTrialTone(e.target.value)}
                  placeholder={t("editorTonePlaceholder")}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 mt-4">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {t("editorGoalLabel")}
              </span>
              <input
                value={trialGoal}
                onChange={(e) => setTrialGoal(e.target.value)}
                placeholder={t("editorGoalPlaceholder")}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
              />
            </label>

            <div className="mt-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {locale === "zh" ? "AI 模型" : "AI Model"}
                </span>
                <select
                  value={trialTextModelId}
                  onChange={(e) => setTrialTextModelId(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {TEXT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} · {m.provider}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateTrialPost}
                disabled={
                  trialGenerating ||
                  !trialTopic.trim() ||
                  !trialTone.trim() ||
                  !trialGoal.trim()
                }
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {trialGenerating
                  ? locale === "zh"
                    ? "生成中..."
                    : "Generating..."
                  : t("editorGenerateButton")}
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t("editorSessionHint")}
              </span>
              {trialRemainingCents !== null && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  {locale === "zh"
                    ? `剩余试用额度: $${(trialRemainingCents / 100).toFixed(2)}`
                    : `Trial balance: $${(trialRemainingCents / 100).toFixed(2)}`}
                </span>
              )}
            </div>

            {trialError && (
              <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {trialError}
                </p>
                {!isLoggedIn && (
                  <Link
                    href={`${prefix}/login`}
                    className="mt-2 inline-flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {locale === "zh"
                      ? "立即注册，领取 $5 →"
                      : "Sign up for $5 free credits →"}
                  </Link>
                )}
              </div>
            )}

            <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                {t("editorPreviewLabel")}
              </p>
              <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap min-h-12">
                {trialOutput || t("editorPreviewPlaceholder")}
              </p>
            </div>

            {/* X Publishing Section — shown after content is generated */}
            {trialOutput && (
              <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setXKeysOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                >
                  <span>
                    {locale === "zh"
                      ? "发布到 X（需要你的 API Key）"
                      : "Publish to X (requires your API keys)"}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${xKeysOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {xKeysOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {locale === "zh"
                        ? "API Key 仅用于本次发布，不会被存储。"
                        : "Your API keys are used only for this request and are never stored."}{" "}
                      <Link
                        href={`${prefix}/docs`}
                        className="text-blue-500 hover:underline"
                      >
                        {locale === "zh" ? "查看文档" : "View docs"}
                      </Link>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="password"
                        placeholder="API Key"
                        value={xApiKey}
                        onChange={(e) => setXApiKey(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                      />
                      <input
                        type="password"
                        placeholder="API Secret"
                        value={xApiSecret}
                        onChange={(e) => setXApiSecret(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                      />
                      <input
                        type="password"
                        placeholder="Access Token"
                        value={xAccessToken}
                        onChange={(e) => setXAccessToken(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                      />
                      <input
                        type="password"
                        placeholder="Access Token Secret"
                        value={xAccessTokenSecret}
                        onChange={(e) =>
                          setXAccessTokenSecret(e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handlePublishToX}
                      disabled={
                        xPublishing ||
                        !xApiKey ||
                        !xApiSecret ||
                        !xAccessToken ||
                        !xAccessTokenSecret
                      }
                      className="inline-flex items-center px-5 py-2.5 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                    >
                      {xPublishing
                        ? locale === "zh"
                          ? "发布中..."
                          : "Publishing..."
                        : locale === "zh"
                          ? "发布到 X"
                          : "Publish to X"}
                    </button>
                    {xPublishResult && (
                      <div
                        className={`rounded-lg px-4 py-3 text-sm ${
                          xPublishResult.success
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                        }`}
                      >
                        {xPublishResult.success ? (
                          <>
                            {locale === "zh"
                              ? "发布成功！"
                              : "Published successfully!"}{" "}
                            {xPublishResult.tweetUrl && (
                              <a
                                href={xPublishResult.tweetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-semibold"
                              >
                                {locale === "zh"
                                  ? "查看推文 →"
                                  : "View tweet →"}
                              </a>
                            )}
                          </>
                        ) : (
                          xPublishResult.error
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Image generation mode */}
        {editorMode === "image" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {locale === "zh" ? "模型" : "Model"}
                </span>
                <select
                  value={imgModelId}
                  onChange={(e) => setImgModelId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {t2iModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {locale === "zh" ? "比例" : "Aspect ratio"}
                </span>
                <select
                  value={imgAspect}
                  onChange={(e) => setImgAspect(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {["1:1", "16:9", "9:16", "4:3", "3:4"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {locale === "zh" ? "快速填入示例 →" : "Try a sample →"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    {
                      label: locale === "zh" ? "餐厅美食" : "Restaurant",
                      prompt: locale === "zh"
                        ? "精致日式料理摆盘特写，新鲜三文鱼刺身配金箔点缀，黑色石板盘，柔和自然光，专业美食摄影"
                        : "Close-up of elegant Japanese cuisine plating, fresh salmon sashimi with gold leaf garnish on black slate plate, soft natural light, professional food photography",
                    },
                    {
                      label: locale === "zh" ? "美容护肤" : "Beauty & Skincare",
                      prompt: locale === "zh"
                        ? "高端护肤品系列产品展示，白色大理石背景，鲜花和绿植点缀，柔光打光，简约奢华风格"
                        : "Luxury skincare product line display on white marble background with fresh flowers and greenery, soft lighting, minimalist luxury aesthetic",
                    },
                    {
                      label: locale === "zh" ? "豪宅地产" : "Luxury Property",
                      prompt: locale === "zh"
                        ? "现代豪华别墅外观，无边泳池倒映晚霞，棕榈树环绕，建筑摄影风格，黄金时段"
                        : "Modern luxury villa exterior with infinity pool reflecting sunset, surrounded by palm trees, architectural photography, golden hour",
                    },
                    {
                      label: locale === "zh" ? "旧金山旅拍" : "SF Travel",
                      prompt: locale === "zh"
                        ? "旧金山金门大桥全景，晨雾缭绕，前景有野花草地，色彩鲜艳，风光摄影"
                        : "Golden Gate Bridge panorama with morning fog, wildflower meadow in foreground, vibrant colors, landscape photography",
                    },
                  ] as const
                ).map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setImgPrompt(sample.prompt)}
                    className="rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:border-purple-500 hover:text-purple-600 dark:hover:border-purple-400 dark:hover:text-purple-400 transition-colors"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {locale === "zh" ? "提示词" : "Prompt"}
              </span>
              <textarea
                rows={3}
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                placeholder={
                  locale === "zh"
                    ? "例如：一只柴犬坐在咖啡馆里看报纸，赛博朋克风格，霓虹灯光"
                    : "e.g., A Shiba Inu reading a newspaper in a café, cyberpunk style, neon lighting"
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={imgGenerating || !imgPrompt.trim()}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 disabled:opacity-50"
              >
                {imgGenerating
                  ? locale === "zh"
                    ? "生成中..."
                    : "Generating..."
                  : locale === "zh"
                    ? "🖼️ 生成图片"
                    : "🖼️ Generate Image"}
              </button>
              {trialRemainingCents !== null && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  {locale === "zh"
                    ? `剩余额度: $${(trialRemainingCents / 100).toFixed(2)}`
                    : `Balance: $${(trialRemainingCents / 100).toFixed(2)}`}
                </span>
              )}
            </div>
            {imgError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {imgError}
                </p>
                {!isLoggedIn && (
                  <Link
                    href={`${prefix}/login`}
                    className="mt-2 inline-flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {locale === "zh"
                      ? "立即注册，领取 $5 →"
                      : "Sign up for $5 free credits →"}
                  </Link>
                )}
              </div>
            )}
            {imgOutput && (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgOutput}
                  alt="Generated image"
                  className="rounded-lg max-w-full max-h-96 object-contain border border-gray-200 dark:border-gray-700"
                />
              </div>
            )}
          </div>
        )}

        {/* Video generation mode */}
        {editorMode === "video" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {locale === "zh" ? "模型" : "Model"}
                </span>
                <select
                  value={vidModelId}
                  onChange={(e) => setVidModelId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {t2vModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {locale === "zh" ? "比例" : "Aspect ratio"}
                </span>
                <select
                  value={vidAspect}
                  onChange={(e) => setVidAspect(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  {["16:9", "9:16", "1:1"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {locale === "zh" ? "时长" : "Duration"}
                </span>
                <select
                  value={vidDuration}
                  onChange={(e) => setVidDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                </select>
              </label>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {locale === "zh" ? "快速填入示例 →" : "Try a sample →"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    {
                      label: locale === "zh" ? "旧金山旅拍" : "SF Travel",
                      prompt: locale === "zh"
                        ? "航拍金门大桥，镜头从桥面缓缓上升，晨雾在桥塔间流动，旧金山湾区全景展现，电影级色彩"
                        : "Aerial shot of the Golden Gate Bridge, camera slowly rising above the deck, morning fog flowing between towers, San Francisco Bay panorama, cinematic color grading",
                    },
                    {
                      label: locale === "zh" ? "餐厅氛围" : "Restaurant",
                      prompt: locale === "zh"
                        ? "特写镜头：厨师在明火上翻炒菜肴，火焰升腾，食材在锅中翻滚，蒸汽弥漫，温暖的餐厅灯光"
                        : "Close-up of a chef cooking over an open flame, flames rising, ingredients tossing in a wok, steam billowing, warm restaurant lighting",
                    },
                    {
                      label: locale === "zh" ? "豪宅巡游" : "Property Tour",
                      prompt: locale === "zh"
                        ? "镜头从豪华别墅大门缓缓推入，穿过大理石门厅，落地窗外是无边泳池和海景，阳光洒满客厅"
                        : "Camera glides through a luxury villa entrance, across a marble foyer, floor-to-ceiling windows reveal an infinity pool and ocean view, sunlight fills the living room",
                    },
                    {
                      label: locale === "zh" ? "美容护理" : "Beauty Spa",
                      prompt: locale === "zh"
                        ? "特写：美容师轻柔地为客人做面部护理，花瓣散落在水疗床旁，柔和的灯光和舒缓的氛围"
                        : "Close-up of an aesthetician gently performing a facial treatment, flower petals scattered beside the spa bed, soft lighting and calming ambiance",
                    },
                  ] as const
                ).map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setVidPrompt(sample.prompt)}
                    className="rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:border-rose-500 hover:text-rose-600 dark:hover:border-rose-400 dark:hover:text-rose-400 transition-colors"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {locale === "zh" ? "提示词" : "Prompt"}
              </span>
              <textarea
                rows={3}
                value={vidPrompt}
                onChange={(e) => setVidPrompt(e.target.value)}
                placeholder={
                  locale === "zh"
                    ? "例如：镜头缓慢推进，穿过晨雾中的竹林，阳光透过叶缝洒下光斑"
                    : "e.g., Camera slowly pushes through a misty bamboo forest at dawn, sunlight filtering through the leaves"
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={vidGenerating || !vidPrompt.trim()}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {vidGenerating
                  ? locale === "zh"
                    ? "生成中（请稍候）..."
                    : "Generating (please wait)..."
                  : locale === "zh"
                    ? "🎬 生成视频"
                    : "🎬 Generate Video"}
              </button>
              {trialRemainingCents !== null && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  {locale === "zh"
                    ? `剩余额度: $${(trialRemainingCents / 100).toFixed(2)}`
                    : `Balance: $${(trialRemainingCents / 100).toFixed(2)}`}
                </span>
              )}
            </div>
            {vidError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {vidError}
                </p>
                {!isLoggedIn && (
                  <Link
                    href={`${prefix}/login`}
                    className="mt-2 inline-flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {locale === "zh"
                      ? "立即注册，领取 $5 →"
                      : "Sign up for $5 free credits →"}
                  </Link>
                )}
              </div>
            )}
            {vidOutput && (
              <div className="mt-2">
                <video
                  src={vidOutput}
                  controls
                  autoPlay
                  loop
                  muted
                  className="rounded-lg max-w-full max-h-96 border border-gray-200 dark:border-gray-700"
                />
              </div>
            )}
          </div>
        )}

        {/* Voice generation mode */}
        {editorMode === "voice" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {locale === "zh" ? "音色" : "Voice"}
                </span>
                <select
                  value={voiceVoice}
                  onChange={(e) =>
                    setVoiceVoice(e.target.value as typeof voiceVoice)
                  }
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
                >
                  <option value="alloy">
                    Alloy —{" "}
                    {locale === "zh" ? "中性、多用途" : "Neutral, versatile"}
                  </option>
                  <option value="echo">
                    Echo — {locale === "zh" ? "稍低沉" : "Slightly deeper"}
                  </option>
                  <option value="fable">
                    Fable —{" "}
                    {locale === "zh" ? "温暖、富有表情" : "Warm, expressive"}
                  </option>
                  <option value="onyx">
                    Onyx —{" "}
                    {locale === "zh"
                      ? "低沉、有权威感"
                      : "Deep, authoritative"}
                  </option>
                  <option value="nova">
                    Nova — {locale === "zh" ? "温暖、女声" : "Warm, female"}
                  </option>
                  <option value="shimmer">
                    Shimmer —{" "}
                    {locale === "zh" ? "柔和、女声" : "Soft, female"}
                  </option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {locale === "zh" ? "语速" : "Speed"} ({voiceSpeed}×)
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.25}
                  value={voiceSpeed}
                  onChange={(e) => setVoiceSpeed(Number(e.target.value))}
                  className="w-full mt-2 accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>0.5×</span>
                  <span>1×</span>
                  <span>2×</span>
                </div>
              </label>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {locale === "zh" ? "快速填入示例 →" : "Try a sample →"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    {
                      label: locale === "zh" ? "餐厅推荐" : "Restaurant",
                      text: locale === "zh"
                        ? "欢迎来到我们的餐厅！今天为大家推荐主厨特制的招牌菜——慢炖和牛配黑松露酱，选用澳洲M9级和牛，经过8小时低温慢煮，搭配当季时令蔬菜。现在预订可享受双人套餐优惠。"
                        : "Welcome to our restaurant! Today's chef special is the signature slow-braised wagyu with black truffle sauce, using premium Australian M9 wagyu slow-cooked for 8 hours, paired with seasonal vegetables. Book now for our couples dining special.",
                    },
                    {
                      label: locale === "zh" ? "医疗健康" : "Health Tips",
                      text: locale === "zh"
                        ? "关注您的健康！研究表明，每天30分钟的适度运动可以显著降低心血管疾病风险。我们诊所本月推出全面体检套餐，包含血液检测、心电图和专家咨询，助您全面了解身体状况。"
                        : "Your health matters! Studies show that just 30 minutes of moderate exercise daily can significantly reduce cardiovascular disease risk. Our clinic is offering comprehensive health screening packages this month, including blood work, ECG, and specialist consultation.",
                    },
                    {
                      label: locale === "zh" ? "金融理财" : "Finance",
                      text: locale === "zh"
                        ? "2026年投资策略分享：在当前利率环境下，分散投资组合比以往更加重要。我们的理财顾问团队为您量身定制资产配置方案，帮助您实现稳健增长。预约免费咨询，让专业人士为您的财富保驾护航。"
                        : "2026 Investment outlook: In today's interest rate environment, portfolio diversification is more important than ever. Our advisory team creates personalized asset allocation plans for steady growth. Schedule a free consultation and let our experts safeguard your wealth.",
                    },
                    {
                      label: locale === "zh" ? "地产介绍" : "Property Tour",
                      text: locale === "zh"
                        ? "坐落于旧金山湾区黄金地段，这套全新装修的四居室豪宅拥有开阔的海湾景观和私人花园。步行可达优质学区，周边配套设施齐全。欢迎预约看房，感受品质生活。"
                        : "Located in San Francisco's prime Bay Area, this newly renovated four-bedroom luxury home features sweeping bay views and a private garden. Walking distance to top-rated schools with excellent nearby amenities. Schedule a viewing today.",
                    },
                  ] as const
                ).map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => setVoiceText(sample.text)}
                    className="rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:border-orange-500 hover:text-orange-600 dark:hover:border-orange-400 dark:hover:text-orange-400 transition-colors"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {locale === "zh" ? "文字内容" : "Text to speak"}
                <span className="ml-2 text-xs text-gray-400">
                  ({voiceText.length}/4096)
                </span>
              </span>
              <textarea
                rows={4}
                maxLength={4096}
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                placeholder={
                  locale === "zh"
                    ? "例如：大家好，欢迎来到我们的频道！今天我们来聊聊社交媒体营销的五个关键策略。"
                    : "e.g., Hey everyone, welcome to our channel! Today we're going to talk about five key strategies for social media marketing."
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white resize-none"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateVoice}
                disabled={voiceGenerating || !voiceText.trim()}
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50"
              >
                {voiceGenerating
                  ? locale === "zh"
                    ? "生成中..."
                    : "Generating..."
                  : locale === "zh"
                    ? "🎙️ 生成语音"
                    : "🎙️ Generate Voice"}
              </button>
              <span className="text-xs text-gray-400">
                {locale === "zh"
                  ? "OpenAI TTS · 需登录"
                  : "OpenAI TTS · Sign-in required"}
              </span>
              {trialRemainingCents !== null && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  {locale === "zh"
                    ? `剩余额度: $${(trialRemainingCents / 100).toFixed(2)}`
                    : `Balance: $${(trialRemainingCents / 100).toFixed(2)}`}
                </span>
              )}
            </div>
            {voiceError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {voiceError}
                </p>
                {!isLoggedIn && (
                  <Link
                    href={`${prefix}/login`}
                    className="mt-2 inline-flex items-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {locale === "zh"
                      ? "立即注册，领取 $5 →"
                      : "Sign up for $5 free credits →"}
                  </Link>
                )}
              </div>
            )}
            {voiceOutput && (
              <div className="mt-2 space-y-2">
                <audio
                  controls
                  src={voiceOutput}
                  className="w-full rounded-lg"
                />
                <a
                  href={voiceOutput}
                  download="voiceover.mp3"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {locale === "zh" ? "⬇ 下载 MP3" : "⬇ Download MP3"}
                </a>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!isLoggedIn ? (
            <Link
              href={`${prefix}/login`}
              className="inline-flex items-center px-5 py-2.5 rounded-lg border border-blue-300 text-blue-700 dark:text-blue-300 dark:border-blue-600 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              {t("editorUnlockButton")}
            </Link>
          ) : (
            <Link
              href={`${prefix}/toolbox`}
              className="inline-flex items-center px-5 py-2.5 rounded-lg border border-blue-300 text-blue-700 dark:text-blue-300 dark:border-blue-600 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              {t("editorGoMediaStudio")}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
