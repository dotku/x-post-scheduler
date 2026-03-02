"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/lib/wavespeed";
import { TEXT_MODELS, DEFAULT_TEXT_MODEL } from "@/lib/ai-models";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function detectInAppBrowser(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const isWeChat = ua.includes("micromessenger");
  const isInAppBrowser =
    isWeChat ||
    ua.includes("webview") ||
    ua.includes("; wv)") ||
    ua.includes("instagram") ||
    ua.includes("fban") ||
    ua.includes("fbav");
  return { isWeChat, isInAppBrowser };
}

interface PublicStatsResponse {
  totals: {
    users: number;
    posts: number;
    galleryItems: number;
    knowledgeSources: number;
    requests: number;
    tokens: number;
    webVisits: number;
  };
  window30d: {
    requests: number;
    tokens: number;
    webVisits: number;
    topPages: {
      path: string;
      visits: number;
    }[];
    byProvider: {
      provider: string;
      requests: number;
      tokens: number;
    }[];
    topModels: {
      provider: string;
      model: string;
      requests: number;
      tokens: number;
    }[];
  };
  updatedAt: string;
}

type ProviderInfo = {
  name: string;
  badge: string;
  models: { id: string; label: string; mode: "image" | "video" | "text" }[];
};

function detectProvider(modelId: string): string {
  if (modelId.startsWith("bytedance/")) return "ByteDance";
  if (modelId.startsWith("alibaba/")) return "Alibaba";
  if (modelId.startsWith("kwaivgi/")) return "Kuaishou";
  if (modelId.startsWith("wavespeed-ai/")) {
    if (modelId.includes("qwen")) return "Alibaba";
    if (modelId.includes("wan-")) return "Alibaba";
    if (modelId.includes("flux")) return "Black Forest Labs";
    if (modelId.includes("uno")) return "ByteDance";
    if (modelId.includes("real-esrgan")) return "Xintao Wang";
    return "AI Platform";
  }
  return "Other";
}

export default function LandingContent({
  isLoggedIn = false,
}: {
  isLoggedIn?: boolean;
}) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const lang = locale;
  const prefix = locale === "zh" ? "/zh" : "";

  const [userAgent] = useState(() =>
    typeof window === "undefined" ? "" : window.navigator.userAgent || "",
  );
  const [copied, setCopied] = useState(false);
  const [copiedWechat, setCopiedWechat] = useState("");
  const [stats, setStats] = useState<PublicStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
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
  const [navMenuOpen, setNavMenuOpen] = useState(false);
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
  const t2vModels = useMemo(() => VIDEO_MODELS, []);
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
  const browserEnv = useMemo(() => detectInAppBrowser(userAgent), [userAgent]);

  const features = useMemo(
    () => [
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        ),
        title: t("feature1Title"),
        description: t("feature1Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        ),
        title: t("feature2Title"),
        description: t("feature2Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        ),
        title: t("feature3Title"),
        description: t("feature3Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        ),
        title: t("feature4Title"),
        description: t("feature4Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h10"
          />
        ),
        title: t("feature5Title"),
        description: t("feature5Desc"),
      },
      {
        icon: (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        ),
        title: t("feature6Title"),
        description: t("feature6Desc"),
      },
    ],
    [t],
  );

  const providerInfo = useMemo<ProviderInfo[]>(() => {
    const map = new Map<string, ProviderInfo>();
    const ensure = (provider: string, badge: string) => {
      const existing = map.get(provider);
      if (existing) return existing;
      const created: ProviderInfo = { name: provider, badge, models: [] };
      map.set(provider, created);
      return created;
    };
    for (const model of IMAGE_MODELS) {
      ensure(detectProvider(model.id), "Image/Video").models.push({
        id: model.id,
        label: model.label,
        mode: "image",
      });
    }
    for (const model of VIDEO_MODELS) {
      ensure(detectProvider(model.id), "Image/Video").models.push({
        id: model.id,
        label: model.label,
        mode: "video",
      });
    }
    ensure("OpenAI", "Text").models.push({
      id: "gpt-4o",
      label: "GPT-4o (tweet generation)",
      mode: "text",
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, []);

  // Aggregate top-models data by actual model vendor instead of API provider
  const byModelVendor = useMemo(() => {
    if (!stats) return [];
    const map = new Map<string, number>();
    for (const item of stats.window30d.topModels) {
      const vendor =
        item.provider === "openai" ? "OpenAI" : detectProvider(item.model);
      map.set(vendor, (map.get(vendor) ?? 0) + item.requests);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([vendor, requests]) => ({ vendor, requests }));
  }, [stats]);

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

  useEffect(() => {
    fetch("/api/public/stats")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as PublicStatsResponse;
      })
      .then((data) => setStats(data))
      .finally(() => setStatsLoading(false));
  }, []);

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

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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

      // Sync: outputs returned immediately
      let output = data.task?.outputs?.[0] ?? null;
      if (output) {
        setImgOutput(output);
        if (typeof data.task?.remainingCents === "number") {
          setTrialRemainingCents(data.task.remainingCents);
        }
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
        const url = pollUrl
          ? `/api/toolbox/video/${taskId}?pollUrl=${encodeURIComponent(pollUrl)}`
          : `/api/toolbox/video/${taskId}`;
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

  const highlight = t("heroHighlight");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <h1
            className={`font-bold text-gray-900 dark:text-white ${
              lang === "zh" ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
            }`}
          >
            {t("appName")}
          </h1>

          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link
              href={`${prefix}/gallery`}
              className="text-gray-600 dark:text-gray-400 hover:underline underline-offset-4"
            >
              {t("galleryFeed")}
            </Link>
            <Link
              href={`${prefix}/docs`}
              className="text-gray-600 dark:text-gray-400 hover:underline underline-offset-4"
            >
              {t("docs")}
            </Link>
            <Link
              href={`${prefix}/news`}
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline underline-offset-4"
            >
              {locale === "zh" ? "传媒日报" : "Media Daily"}
            </Link>
            <Link
              href={`${prefix}/changelog`}
              className="text-gray-600 dark:text-gray-400 hover:underline underline-offset-4"
            >
              {t("changelog")}
            </Link>
            <Link
              href={`${prefix}/invest`}
              className="text-gray-600 dark:text-gray-400 hover:underline underline-offset-4"
            >
              {t("investor")}
            </Link>
            <LanguageSwitcher />
            {!browserEnv.isInAppBrowser &&
              (isLoggedIn ? (
                <Link
                  href={`${prefix}/dashboard`}
                  className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-4"
                >
                  {t("dashboard")}
                </Link>
              ) : (
                <Link
                  href={`${prefix}/login`}
                  className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-4"
                >
                  {t("signIn")}
                </Link>
              ))}
          </div>

          <button
            type="button"
            onClick={() => setNavMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300"
            aria-expanded={navMenuOpen}
            aria-label={locale === "zh" ? "切换菜单" : "Toggle menu"}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  navMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>
        </div>

        {navMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col gap-2 text-sm">
              <Link
                href={`${prefix}/gallery`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("galleryFeed")}
              </Link>
              <Link
                href={`${prefix}/docs`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("docs")}
              </Link>
              <Link
                href={`${prefix}/news`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                {locale === "zh" ? "传媒日报" : "Media Daily"}
              </Link>
              <Link
                href={`${prefix}/changelog`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("changelog")}
              </Link>
              <Link
                href={`${prefix}/invest`}
                onClick={() => setNavMenuOpen(false)}
                className="rounded-md px-2 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("investor")}
              </Link>
              <div className="pt-1">
                <LanguageSwitcher />
              </div>
              {!browserEnv.isInAppBrowser &&
                (isLoggedIn ? (
                  <Link
                    href={`${prefix}/dashboard`}
                    onClick={() => setNavMenuOpen(false)}
                    className="rounded-md px-2 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {t("dashboard")}
                  </Link>
                ) : (
                  <Link
                    href={`${prefix}/login`}
                    onClick={() => setNavMenuOpen(false)}
                    className="rounded-md px-2 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {t("signIn")}
                  </Link>
                ))}
            </div>
          </div>
        )}
      </header>

      {/* Beta Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
          {t("betaNotice")}
        </div>
      </div>

      {/* Rebranding Announcement */}
      <div className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-b border-blue-200 dark:border-blue-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-center">
          <p className="text-sm sm:text-base text-gray-900 dark:text-white">
            <span className="font-semibold">
              🎉 {lang === "zh" ? "品牌升级" : "New Brand"}
            </span>
            {" · "}
            {lang === "zh"
              ? "X Post Scheduler 正式更名为 xPilot (X 推创)！"
              : "X Post Scheduler is now xPilot!"}{" "}
            <Link
              href={`${prefix}/changelog`}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {lang === "zh" ? "了解详情 →" : "Learn more →"}
            </Link>
          </p>
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
          {t("heroTitle")}
          {highlight && (
            <>
              <br className="hidden sm:block" />
              <span className="text-blue-600 dark:text-blue-400">
                {" "}
                {highlight}
              </span>
            </>
          )}
        </h2>
        <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {t("heroSubtitle")}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {browserEnv.isInAppBrowser ? (
            <div className="w-full max-w-md rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4 text-sm text-left">
              <p className="font-semibold text-base">
                {browserEnv.isWeChat
                  ? t("wechatDetected")
                  : t("embeddedBrowser")}
              </p>
              <p className="mt-2">
                {browserEnv.isWeChat ? t("wechatHint") : t("embeddedHint")}
              </p>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="mt-3 w-full inline-flex items-center justify-center px-3 py-2.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors font-medium"
              >
                {copied ? t("linkCopied") : t("copyLink")}
              </button>
            </div>
          ) : isLoggedIn ? (
            <>
              <Link
                href={`${prefix}/dashboard`}
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                {t("goToDashboard")}
              </Link>
              <Link
                href={`${prefix}/news`}
                className="inline-flex items-center px-6 py-3 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                {locale === "zh" ? "今日传媒日报 →" : "Today's Media Brief →"}
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`${prefix}/login`}
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                {t("getStarted")}
              </Link>
              <Link
                href={`${prefix}/news`}
                className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {locale === "zh" ? "传媒行业日报 →" : "Media Industry Daily →"}
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Try editor */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8">
          <div className="flex flex-col gap-2 mb-6">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {t("editorTitle")}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("editorSubtitle")}
            </p>
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
                            ? "AI 生产力工具"
                            : "AI productivity tools",
                        tone: locale === "zh" ? "专业、权威" : "professional",
                        goal: locale === "zh" ? "吸引注册" : "drive signups",
                      },
                      {
                        topic:
                          locale === "zh"
                            ? "视频内容创作技巧"
                            : "video content creation tips",
                        tone:
                          locale === "zh"
                            ? "轻松、充满活力"
                            : "casual, energetic",
                        goal: locale === "zh" ? "涨粉" : "grow following",
                      },
                      {
                        topic:
                          locale === "zh"
                            ? "创业融资经验"
                            : "bootstrapping a startup",
                        tone: locale === "zh" ? "真实、坦诚" : "authentic, raw",
                        goal: locale === "zh" ? "建立社群" : "build community",
                      },
                      {
                        topic:
                          locale === "zh"
                            ? "早晨健身计划"
                            : "morning workout routine",
                        tone: locale === "zh" ? "激励人心" : "motivational",
                        goal: locale === "zh" ? "激发行动" : "inspire action",
                      },
                      {
                        topic:
                          locale === "zh"
                            ? "加密货币市场趋势"
                            : "crypto market trends",
                        tone:
                          locale === "zh"
                            ? "理性、自信"
                            : "analytical, confident",
                        goal:
                          locale === "zh"
                            ? "建立思想领导力"
                            : "establish thought leadership",
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
                        label: locale === "zh" ? "赛博朋克柴犬" : "Cyberpunk Shiba",
                        prompt: locale === "zh"
                          ? "一只柴犬坐在咖啡馆里看报纸，赛博朋克风格，霓虹灯光，电影级画质"
                          : "A Shiba Inu reading a newspaper in a neon-lit cyberpunk café, cinematic lighting, detailed",
                      },
                      {
                        label: locale === "zh" ? "产品展示" : "Product Shot",
                        prompt: locale === "zh"
                          ? "一瓶精酿啤酒放在大理石桌面上，背景是柔和的暖光，专业产品摄影风格"
                          : "A craft beer bottle on a marble countertop, soft warm backlight, professional product photography",
                      },
                      {
                        label: locale === "zh" ? "扁平插画" : "Flat Illustration",
                        prompt: locale === "zh"
                          ? "一个女孩在书房里用笔记本电脑工作，扁平矢量插画风格，柔和配色"
                          : "A girl working on a laptop in a cozy study room, flat vector illustration style, pastel colors",
                      },
                      {
                        label: locale === "zh" ? "未来城市" : "Future City",
                        prompt: locale === "zh"
                          ? "未来城市天际线，飞行汽车穿梭在摩天大楼之间，日落时分，金色光芒"
                          : "Futuristic city skyline with flying cars between skyscrapers, golden hour sunset, ultra detailed",
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
                        label: locale === "zh" ? "频道欢迎语" : "Channel Intro",
                        text: locale === "zh"
                          ? "大家好，欢迎来到我们的频道！今天我们来聊聊社交媒体营销的五个关键策略，帮助你快速涨粉、提升互动率。"
                          : "Hey everyone, welcome to our channel! Today we're breaking down five key strategies for social media marketing that will help you grow your audience fast.",
                      },
                      {
                        label: locale === "zh" ? "产品介绍" : "Product Pitch",
                        text: locale === "zh"
                          ? "这款全新的 AI 写作助手，能在几秒钟内为你生成高质量的社交媒体文案。无论是推文、帖子还是广告文案，它都能轻松搞定。"
                          : "Introducing our brand-new AI writing assistant. It generates high-quality social media copy in seconds — whether it's tweets, posts, or ad copy, it handles it all effortlessly.",
                      },
                      {
                        label: locale === "zh" ? "新闻播报" : "News Brief",
                        text: locale === "zh"
                          ? "今日科技要闻：人工智能领域再迎突破，最新模型在多项基准测试中刷新纪录。业内专家表示，这将深刻改变内容创作行业的格局。"
                          : "Today in tech: A major breakthrough in artificial intelligence as the latest model sets new records across multiple benchmarks. Industry experts say this will reshape the content creation landscape.",
                      },
                      {
                        label: locale === "zh" ? "激励语录" : "Motivation",
                        text: locale === "zh"
                          ? "每一次尝试都是通往成功的一步。不要害怕失败，因为失败只是告诉你，还有更好的方法在等着你。坚持下去，你的努力终将得到回报。"
                          : "Every attempt is a step toward success. Don't fear failure — it's simply showing you there's a better way. Keep going. Your effort will pay off.",
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
                    ? "OpenAI TTS · 高品质语音"
                    : "OpenAI TTS · High quality"}
                </span>
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

      {/* Features */}
      <section className="bg-white dark:bg-gray-800 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            {t("featuresTitle")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900 mb-4">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {feature.icon}
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Usage */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {t("usageTitle")}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t("usageSubtitle")}
            </p>
          </div>
          {stats?.updatedAt && (
            <p className="text-xs text-gray-400">
              {t("updated")} {new Date(stats.updatedAt).toLocaleString()}
            </p>
          )}
        </div>

        {statsLoading ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("loadingMetrics")}
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: t("statUsers"), value: stats.totals.users },
                { label: t("statAiRequests"), value: stats.totals.requests },
                { label: t("statTokens"), value: stats.totals.tokens },
                { label: t("statGallery"), value: stats.totals.galleryItems },
                { label: t("statWebVisits"), value: stats.totals.webVisits },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {item.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {byModelVendor.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    {t("last30ByProvider")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {byModelVendor.map((item) => (
                      <div
                        key={item.vendor}
                        className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm"
                      >
                        <span className="text-gray-700 dark:text-gray-300">
                          {item.vendor}
                        </span>
                        <span className="text-gray-900 dark:text-white">
                          {item.requests.toLocaleString()} {t("req")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  {t("topPages")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stats.window30d.topPages.slice(0, 6).map((item) => (
                    <div
                      key={item.path}
                      className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate pr-2">
                        {item.path}
                      </span>
                      <span className="text-gray-900 dark:text-white">
                        {item.visits.toLocaleString()} {t("visits")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("metricsUnavailable")}
          </div>
        )}
      </section>

      {/* Providers & Models */}
      <section className="bg-white dark:bg-gray-800 py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            {t("modelsTitle")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            {t("modelsSubtitle")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providerInfo.map((provider) => (
              <div
                key={provider.name}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {provider.name}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {provider.badge}
                  </span>
                </div>
                <div className="space-y-2">
                  {provider.models.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate">
                        {model.label}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400 uppercase">
                        {model.mode}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {t("howItWorksTitle")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {(
            [
              { n: "1", title: t("step1Title"), desc: t("step1Desc") },
              { n: "2", title: t("step2Title"), desc: t("step2Desc") },
              { n: "3", title: t("step3Title"), desc: t("step3Desc") },
            ] as const
          ).map((step) => (
            <div key={step.n}>
              <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg mb-4">
                {step.n}
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                {step.title}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white dark:bg-gray-800 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            {t("pricingTitle")}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-3 max-w-xl mx-auto">
            {t("pricingSubtitle")}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-10 max-w-2xl mx-auto">
            {lang === "zh"
              ? "提示：AI Post Scheduler（自动发布）仅订阅会员可用。"
              : "Note: AI Post Scheduler (auto-post) is available to subscribed members only."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pay as you go plan */}
            <div className="relative rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-6 flex flex-col text-left">
              <p className="text-base font-bold text-gray-900 dark:text-white mb-1">
                {lang === "zh" ? "按需付费" : "Pay as you go"}
              </p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                $0
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                  /mo
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400 flex-1">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-green-500 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {lang === "zh" ? "按需购买积分" : "Buy credits as needed"}
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-300 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  {lang === "zh"
                    ? "不支持社交账号自动发布"
                    : "No social auto-posting"}
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-gray-300 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  {lang === "zh" ? "无认证标识" : "No verified badge"}
                </li>
              </ul>
              <Link
                href={isLoggedIn ? `${prefix}/settings` : `${prefix}/login`}
                className="mt-5 block text-center py-2 rounded-lg text-sm font-semibold transition-colors bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {lang === "zh" ? "开始使用" : "Get Started"}
              </Link>
            </div>
            {(["wood", "bronze", "iron", "silver", "gold"] as const).map(
              (tier) => {
                const tiers = {
                  wood: {
                    labelEn: "Wood",
                    labelZh: "木头",
                    price: 3,
                    accounts: "1",
                    accountsZh: "1 个账号",
                    popular: false,
                    color: "green",
                  },
                  bronze: {
                    labelEn: "Bronze",
                    labelZh: "青铜",
                    price: 5,
                    accounts: "2",
                    accountsZh: "2 个账号",
                    popular: false,
                    color: "amber",
                  },
                  iron: {
                    labelEn: "Iron",
                    labelZh: "钢铁",
                    price: 8,
                    accounts: "3",
                    accountsZh: "3 个账号",
                    popular: false,
                    color: "slate",
                  },
                  silver: {
                    labelEn: "Silver",
                    labelZh: "白银",
                    price: 18,
                    accounts: "5",
                    accountsZh: "5 个账号",
                    popular: true,
                    color: "blue",
                  },
                  gold: {
                    labelEn: "Gold",
                    labelZh: "黄金",
                    price: 188,
                    accounts: "10",
                    accountsZh: "10 个账号",
                    popular: false,
                    color: "yellow",
                  },
                }[tier];
                const isPopular = tiers.popular;
                return (
                  <div
                    key={tier}
                    className={`relative rounded-2xl border-2 p-6 flex flex-col text-left ${
                      isPopular
                        ? "border-blue-500 shadow-lg"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {lang === "zh" ? "最受欢迎" : "Most Popular"}
                      </span>
                    )}
                    <p className="text-base font-bold text-gray-900 dark:text-white mb-1">
                      {lang === "zh" ? tiers.labelZh : tiers.labelEn}
                    </p>
                    <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                      ${tiers.price}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                        /mo
                      </span>
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400 flex-1">
                      <li className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {lang === "zh"
                          ? tiers.accountsZh
                          : `${tiers.accounts} account${tiers.accounts === "1" ? "" : "s"}`}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {lang === "zh"
                          ? `每月充值 $${tiers.price}`
                          : `$${tiers.price} monthly credit`}
                      </li>
                      <li className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-green-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {lang === "zh" ? "✓ 认证会员标识" : "✓ Verified badge"}
                      </li>
                    </ul>
                    <Link
                      href={
                        isLoggedIn ? `${prefix}/settings` : `${prefix}/login`
                      }
                      className={`mt-5 block text-center py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isPopular
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {lang === "zh" ? "立即订阅" : "Get Started"}
                    </Link>
                  </div>
                );
              },
            )}
          </div>

          {/* Enterprise plan */}
          <div className="mt-6 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {lang === "zh" ? "企业版" : "Enterprise"}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {lang === "zh"
                  ? "专属定制方案，适合月预算 $15k+ 的团队与企业客户——更多账号、更高配额、私有部署支持"
                  : "Custom solutions for teams & enterprises with $15k+ monthly budget — more accounts, higher limits, and dedicated support"}
              </p>
            </div>
            <a
              href="https://jytech.us"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold rounded-lg border-2 border-gray-400 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors text-center"
            >
              {lang === "zh" ? "联系我们" : "Contact Us"}
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      {!browserEnv.isInAppBrowser && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t("ctaTitle")}
          </h3>
          <Link
            href={isLoggedIn ? `${prefix}/dashboard` : `${prefix}/login`}
            className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
          >
            {isLoggedIn ? t("goToDashboard") : t("ctaButton")}
          </Link>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-8 px-4">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("footerName")}
          </p>
          <div className="text-center space-y-2 sm:space-y-1">
            <p className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              {lang === "zh" ? "微信客服" : "WeChat Support"}:
            </p>
            <div className="flex flex-col sm:flex-row sm:gap-4 gap-2 text-sm sm:text-base">
              <button
                onClick={() => {
                  navigator.clipboard.writeText("techfront-robot");
                  setCopiedWechat("techfront-robot");
                  setTimeout(() => setCopiedWechat(""), 2000);
                }}
                className={`px-3 py-2 sm:py-1.5 rounded-md transition-all ${
                  copiedWechat === "techfront-robot"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                {copiedWechat === "techfront-robot" ? "✓ " : ""}
                techfront-robot ({t("shanghai")})
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("xinmai002leo");
                  setCopiedWechat("xinmai002leo");
                  setTimeout(() => setCopiedWechat(""), 2000);
                }}
                className={`px-3 py-2 sm:py-1.5 rounded-md transition-all ${
                  copiedWechat === "xinmai002leo"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                {copiedWechat === "xinmai002leo" ? "✓ " : ""}
                xinmai002leo ({t("shenzhen")})
              </button>
            </div>
            {copiedWechat && (
              <p className="text-xs text-green-600 dark:text-green-400 animate-fade-in">
                {lang === "zh" ? "已复制微信号" : "WeChat ID copied"}
              </p>
            )}
          </div>

          {/* Africa region support */}
          <div className="text-center space-y-2 sm:space-y-1">
            <p className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300">
              {lang === "zh" ? "非洲地区客服" : "Africa Region Support"} —
              Mohamadou Laminou:
            </p>
            <div className="flex flex-col sm:flex-row sm:gap-4 gap-2 text-sm sm:text-base">
              <a
                href="mailto:mohamadou439@gmail.com"
                className="px-3 py-2 sm:py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all break-all sm:break-normal"
              >
                mohamadou439@gmail.com
              </a>
              <a
                href="https://wa.me/8613162726136"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 sm:py-1.5 rounded-md bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-700 dark:text-green-300 transition-all break-all sm:break-normal"
              >
                WhatsApp: +86 131 6272 6136
              </a>
            </div>
          </div>
          <Link
            href={`${prefix}/invest`}
            className="text-sm hover:underline underline-offset-4 text-gray-500 dark:text-gray-400"
          >
            {t("investorMemo")}
          </Link>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-xs text-gray-500 dark:text-gray-500 pt-3">
            <Link
              href={`${prefix}/about`}
              className="hover:text-gray-700 dark:hover:text-gray-400 hover:underline underline-offset-2"
            >
              {lang === "zh" ? "关于我们" : "About"}
            </Link>
            <Link
              href={`${prefix}/privacy`}
              className="hover:text-gray-700 dark:hover:text-gray-400 hover:underline underline-offset-2"
            >
              {lang === "zh" ? "隐私政策" : "Privacy"}
            </Link>
            <Link
              href={`${prefix}/terms`}
              className="hover:text-gray-700 dark:hover:text-gray-400 hover:underline underline-offset-2"
            >
              {lang === "zh" ? "服务条款" : "Terms"}
            </Link>
            <Link
              href={`${prefix}/disclaimer`}
              className="hover:text-gray-700 dark:hover:text-gray-400 hover:underline underline-offset-2"
            >
              {lang === "zh" ? "免责声明" : "Disclaimer"}
            </Link>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {lang === "zh"
              ? `© ${new Date().getFullYear()} X 推创. 保留所有权利。`
              : `© ${new Date().getFullYear()} xPilot. All rights reserved.`}
          </p>
        </div>
      </footer>
    </div>
  );
}
