"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/* ------------------------------------------------------------------ */
/*  Model data — developer info only, no API supplier names           */
/* ------------------------------------------------------------------ */

interface ModelEntry {
  name: string;
  id?: string; // API model ID (without provider prefix)
  developer: string;
  descZh: string;
  descEn: string;
  tier: "fast" | "standard" | "premium" | "free";
  badge?: string;
  price?: string; // estimated price per run, e.g. "$0.10"
}

const FREE_IMAGE_MODELS: ModelEntry[] = [
  { name: "FLUX.2 Pro", id: "flux-2-pro", developer: "Black Forest Labs", descZh: "免费 · 高质量文生图 · 有速率限制", descEn: "Free · High-quality T2I · Rate limited", tier: "free", price: "$0" },
  { name: "FLUX.2 Max", id: "flux-2-max", developer: "Black Forest Labs", descZh: "免费 · 最高质量 · 有速率限制", descEn: "Free · Maximum quality · Rate limited", tier: "free", price: "$0" },
  { name: "FLUX.2 Flex", id: "flux-2-flex", developer: "Black Forest Labs", descZh: "免费 · 灵活风格 · 有速率限制", descEn: "Free · Flexible styles · Rate limited", tier: "free", price: "$0" },
  { name: "FLUX.2 Klein 4B", id: "flux-2-klein-4b", developer: "Black Forest Labs", descZh: "免费 · 轻量快速 · 有速率限制", descEn: "Free · Lightweight · Rate limited", tier: "free", price: "$0" },
  { name: "Seedream 4.5", id: "seedream-v4.5", developer: "ByteDance", descZh: "免费 · 中英双语 · 有速率限制 · 可能排队", descEn: "Free · Bilingual · Rate limited · May queue", tier: "free", price: "$0" },
];

const IMAGE_GENERATION_MODELS: ModelEntry[] = [
  {
    name: "Seedream 4.5",
    id: "seedream-v4.5",
    developer: "ByteDance",
    descZh: "最新旗舰 · 原生中英双语 · 4K 超清",
    descEn: "Latest flagship · Native bilingual · 4K ultra-HD",
    tier: "standard",
    price: "$0.40",
  },
  {
    name: "Seedream 4",
    id: "seedream-v4",
    developer: "ByteDance",
    descZh: "高质量图像生成 · 中英双语",
    descEn: "High-quality image generation · Bilingual",
    tier: "fast",
    price: "$0.40",
  },
  {
    name: "Dreamina 3.1",
    id: "dreamina-v3.1/text-to-image",
    developer: "ByteDance",
    descZh: "高保真美学风格 · 艺术感强",
    descEn: "High-fidelity aesthetics · Artistic style",
    tier: "premium",
    price: "$0.60",
  },
  {
    name: "Qwen Image",
    id: "qwen-image/text-to-image",
    developer: "Alibaba",
    descZh: "20B 参数 · 中文文字渲染优秀",
    descEn: "20B parameters · Excellent Chinese text rendering",
    tier: "standard",
    price: "$0.50",
  },
  {
    name: "Wan 2.6 Image",
    id: "wan-2.6/text-to-image",
    developer: "Alibaba",
    descZh: "Wan 系列图片版 · 高分辨率",
    descEn: "Wan series image model · High resolution",
    tier: "fast",
    price: "$0.80",
  },
];

const IMAGE_EDITING_MODELS: ModelEntry[] = [
  { name: "FLUX Kontext Pro", id: "flux-kontext-pro", developer: "Black Forest Labs", descZh: "上下文感知编辑 · 修图/修文字首选", descEn: "Context-aware editing · Best for image & text editing", tier: "premium", price: "$0.80" },
  { name: "FLUX Kontext Pro Multi", id: "flux-kontext-pro/multi", developer: "Black Forest Labs", descZh: "多图上下文编辑 · 风格一致性", descEn: "Multi-image context editing · Style consistency", tier: "premium", price: "$0.80" },
  { name: "UNO", id: "uno", developer: "ByteDance", descZh: "通用图像编辑 · 图文混合", descEn: "Universal image editing · Image + text", tier: "standard", price: "$0.50" },
  { name: "Real-ESRGAN", id: "real-esrgan", developer: "Xintao Wang et al.", descZh: "图像超分辨率增强 · 画质提升", descEn: "Image super-resolution · Quality enhancement", tier: "fast", price: "$0.50" },
];

const VIDEO_T2V_MODELS: ModelEntry[] = [
  { name: "Wan 2.2 — 480p Ultra Fast", id: "wan-2.2/t2v-480p-ultra-fast", developer: "Alibaba", descZh: "极速生成 · 约 5 秒出片", descEn: "Ultra-fast generation · ~5s per video", tier: "fast", price: "$0.10" },
  { name: "Wan 2.2 — 720p", id: "wan-2.2/t2v-720p", developer: "Alibaba", descZh: "高清分辨率", descEn: "High-definition resolution", tier: "standard", price: "$0.60" },
  { name: "Wan 2.6", id: "wan-2.6/text-to-video", developer: "Alibaba", descZh: "最新 Wan 系列 · 支持音频生成", descEn: "Latest Wan series · Audio support", tier: "standard", badge: "audio", price: "$0.80" },
  { name: "Seedance 1.5 Pro", id: "seedance-v1.5-pro/text-to-video", developer: "ByteDance", descZh: "电影级画质 · 支持音频", descEn: "Cinematic quality · Audio support", tier: "premium", badge: "audio", price: "$1.00" },
  { name: "Kling Video O3", id: "kling-video-o3-std/text-to-video", developer: "Kuaishou", descZh: "最佳运动质量", descEn: "Best motion quality", tier: "premium", price: "$1.20" },
  { name: "Seedance 2.0", id: "seedance-2.0/text-to-video", developer: "ByteDance", descZh: "最新 · 音频 + 锁定镜头 · 最长 12s", descEn: "Latest · Audio + lock camera · Up to 12s", tier: "premium", badge: "audio", price: "$1.20" },
];

const VIDEO_I2V_MODELS: ModelEntry[] = [
  { name: "Wan 2.2 i2v — 480p Fast", id: "wan-2.2/i2v-480p-ultra-fast", developer: "Alibaba", descZh: "图片转视频 · 快速", descEn: "Image-to-video · Fast", tier: "fast", price: "$0.10" },
  { name: "Wan 2.2 i2v — 720p", id: "wan-2.2/i2v-720p", developer: "Alibaba", descZh: "图片转视频 · 高清", descEn: "Image-to-video · HD", tier: "standard", price: "$0.60" },
  { name: "Seedance 1.5 Pro i2v", id: "seedance-v1.5-pro/image-to-video", developer: "ByteDance", descZh: "图片转视频 · 电影级 · 音频", descEn: "Image-to-video · Cinematic · Audio", tier: "premium", badge: "audio", price: "$1.00" },
  { name: "Seedance 2.0 i2v", id: "seedance-2.0/image-to-video", developer: "ByteDance", descZh: "图片转视频 · 音频 + 锁定镜头 · 12s", descEn: "Image-to-video · Audio + lock camera · 12s", tier: "premium", badge: "audio", price: "$1.20" },
];

const FREE_TEXT_MODELS: ModelEntry[] = [
  { name: "GPT-OSS 120B", id: "gpt-oss-120b", developer: "OpenAI", descZh: "免费 · 120B 开源 · 有速率限制", descEn: "Free · 120B open-source · Rate limited", tier: "free", price: "$0" },
  { name: "Nemotron 3 Super", id: "nemotron-3-super", developer: "NVIDIA", descZh: "免费 · 543B · 有速率限制", descEn: "Free · 543B · Rate limited", tier: "free", price: "$0" },
  { name: "Qwen3 Coder 480B", id: "qwen3-coder-480b", developer: "Qwen", descZh: "免费 · 480B 编程专用 · 有速率限制", descEn: "Free · 480B coding · Rate limited", tier: "free", price: "$0" },
  { name: "Llama 3.3 70B", id: "llama-3.3-70b-instruct", developer: "Meta", descZh: "免费 · 70B · 有速率限制", descEn: "Free · 70B · Rate limited", tier: "free", price: "$0" },
  { name: "Gemma 3 27B", id: "gemma-3-27b-it", developer: "Google", descZh: "免费 · 27B · 有速率限制", descEn: "Free · 27B · Rate limited", tier: "free", price: "$0" },
  { name: "Mistral Small 3.1 24B", id: "mistral-small-3.1-24b", developer: "Mistral", descZh: "免费 · 24B · 有速率限制", descEn: "Free · 24B · Rate limited", tier: "free", price: "$0" },
  { name: "DeepSeek V3", id: "deepseek-chat-v3", developer: "DeepSeek", descZh: "免费 · 高质量中文 · 有速率限制", descEn: "Free · Great for Chinese · Rate limited", tier: "free", price: "$0" },
  { name: "Hermes 3 405B", id: "hermes-3-llama-3.1-405b", developer: "Nous Research", descZh: "免费 · 405B · 有速率限制", descEn: "Free · 405B · Rate limited", tier: "free", price: "$0" },
];

const TEXT_GENERATION_MODELS: ModelEntry[] = [
  { name: "GPT-4o", id: "openai/gpt-4o", developer: "OpenAI", descZh: "旗舰级 · 综合能力最强", descEn: "Flagship · Most capable overall", tier: "premium", price: "$12.50/1M in · $50/1M out" },
  { name: "GPT-4o Mini", id: "openai/gpt-4o-mini", developer: "OpenAI", descZh: "轻量快速 · 性价比高", descEn: "Lightweight · Cost-effective", tier: "fast", price: "$0.75/1M in · $3/1M out" },
  { name: "GPT-5", id: "openai/gpt-5", developer: "OpenAI", descZh: "最新旗舰模型", descEn: "Latest flagship model", tier: "premium", price: "$6.25/1M in · $50/1M out" },
  { name: "Claude Sonnet 4", id: "anthropic/claude-sonnet-4", developer: "Anthropic", descZh: "出色的写作质量", descEn: "Excellent writing quality", tier: "premium", price: "$15/1M in · $75/1M out" },
  { name: "Claude 3.5 Haiku", id: "anthropic/claude-3.5-haiku", developer: "Anthropic", descZh: "快速 · 高性价比", descEn: "Fast · Cost-efficient", tier: "fast", price: "$4/1M in · $20/1M out" },
  { name: "Gemini 2.5 Flash", id: "google/gemini-2.5-flash", developer: "Google", descZh: "极速 · 低成本", descEn: "Ultra-fast · Low cost", tier: "fast", price: "$1.50/1M in · $12.50/1M out" },
  { name: "Gemini 2.5 Pro", id: "google/gemini-2.5-pro", developer: "Google", descZh: "高性能推理", descEn: "High performance reasoning", tier: "premium", price: "$6.25/1M in · $50/1M out" },
  { name: "Grok 3", id: "xai/grok-3", developer: "xAI", descZh: "实时感知 · 紧跟热点", descEn: "Real-time aware", tier: "premium", price: "$15/1M in · $75/1M out" },
  { name: "Grok 3 Mini", id: "xai/grok-3-mini", developer: "xAI", descZh: "轻量快速", descEn: "Lightweight and fast", tier: "fast", price: "$1.50/1M in · $2.50/1M out" },
  { name: "Mistral Small", id: "mistral/mistral-small", developer: "Mistral", descZh: "高效欧洲模型", descEn: "Efficient European model", tier: "fast", price: "$0.50/1M in · $1.50/1M out" },
  { name: "Mistral Medium", id: "mistral/mistral-medium", developer: "Mistral", descZh: "均衡性能", descEn: "Balanced performance", tier: "standard", price: "$2/1M in · $10/1M out" },
];

const VOICE_MODELS: ModelEntry[] = [
  { name: "TTS-1", id: "openai/tts-1", developer: "OpenAI", descZh: "高品质文字转语音 · 6 种音色 (alloy, echo, fable, onyx, nova, shimmer)", descEn: "High-quality TTS · 6 voices (alloy, echo, fable, onyx, nova, shimmer)", tier: "standard" },
];

const BGM_MODELS: ModelEntry[] = [
  { name: "MMAudio V2", id: "mmaudio-v2", developer: "Cheng et al.", descZh: "视频转音频 · 多模态同步 · 背景音乐生成", descEn: "Video-to-audio · Multimodal sync · BGM generation", tier: "standard" },
];

const NARRATION_MODELS: ModelEntry[] = [
  { name: "Gemini 2.5 Flash", id: "google/gemini-2.5-flash", developer: "Google", descZh: "视频内容分析 · 自动生成旁白脚本", descEn: "Video analysis · Auto-generate narration", tier: "fast", badge: "analysis" },
  { name: "TTS-1", id: "openai/tts-1", developer: "OpenAI", descZh: "旁白语音合成 · 6 种音色", descEn: "Narration synthesis · 6 voices", tier: "standard", badge: "synthesis" },
];

const POST_PRODUCTION_MODELS: ModelEntry[] = [
  { name: "SAM2 Video", id: "meta/sam-2-video", developer: "Meta", descZh: "视频目标跟踪 · 点击即跟踪 · 内容替换", descEn: "Video object tracking · Click to track · Content replacement", tier: "standard", price: "~$0.04/run" },
  { name: "Wan 2.7 VideoEdit", id: "wan-2.7-videoedit", developer: "Alibaba", descZh: "自然语言视频编辑 · AI 智能修改", descEn: "Natural language video editing · AI smart modification", tier: "premium", price: "~$0.50/run" },
];

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

const TIER_STYLES: Record<
  string,
  { bg: string; text: string; labelZh: string; labelEn: string }
> = {
  free: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    labelZh: "免费",
    labelEn: "Free",
  },
  fast: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    labelZh: "快速",
    labelEn: "Fast",
  },
  standard: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    labelZh: "标准",
    labelEn: "Standard",
  },
  premium: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    labelZh: "高端",
    labelEn: "Premium",
  },
};

function TierBadge({ tier, locale }: { tier: string; locale: string }) {
  const style = TIER_STYLES[tier] ?? TIER_STYLES.standard;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      {locale === "zh" ? style.labelZh : style.labelEn}
    </span>
  );
}

const BADGE_STYLES: Record<string, { bg: string; text: string; zh: string; en: string }> = {
  audio:     { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", zh: "音频",  en: "Audio" },
  analysis:  { bg: "bg-cyan-100 dark:bg-cyan-900/30",    text: "text-cyan-700 dark:text-cyan-400",     zh: "分析",  en: "Analysis" },
  synthesis: { bg: "bg-teal-100 dark:bg-teal-900/30",    text: "text-teal-700 dark:text-teal-400",     zh: "合成",  en: "Synthesis" },
};

function ModelCard({ m, locale }: { m: ModelEntry; locale: string }) {
  return (
    <div className="p-3 rounded-lg border border-gray-100 dark:border-gray-700 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-900 dark:text-white text-sm">
          {m.name}
          {m.badge && BADGE_STYLES[m.badge] && (
            <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${BADGE_STYLES[m.badge].bg} ${BADGE_STYLES[m.badge].text}`}>
              {locale === "zh" ? BADGE_STYLES[m.badge].zh : BADGE_STYLES[m.badge].en}
            </span>
          )}
        </span>
        <TierBadge tier={m.tier} locale={locale} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{m.developer}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">{locale === "zh" ? m.descZh : m.descEn}</p>
      <div className="flex items-center gap-3 pt-1">
        {m.id && <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{m.id}</span>}
        {m.price && <span className="text-[10px] text-gray-500 ml-auto">{m.price}</span>}
      </div>
    </div>
  );
}

function ModelTable({
  models,
  locale,
}: {
  models: ModelEntry[];
  locale: string;
}) {
  return (
    <>
    {/* Mobile: Card layout */}
    <div className="sm:hidden space-y-2">
      {models.map((m) => <ModelCard key={m.name} m={m} locale={locale} />)}
    </div>
    {/* Desktop: Table layout */}
    <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white">
              {locale === "zh" ? "模型" : "Model"}
            </th>
            <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white">
              {locale === "zh" ? "开发商" : "Developer"}
            </th>
            <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white">
              {locale === "zh" ? "说明" : "Description"}
            </th>
            <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white hidden sm:table-cell">
              {locale === "zh" ? "模型 ID" : "Model ID"}
            </th>
            <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white">
              {locale === "zh" ? "价格" : "Price"}
            </th>
            <th className="text-left py-2 font-semibold text-gray-900 dark:text-white">
              {locale === "zh" ? "等级" : "Tier"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {models.map((m) => (
            <tr key={m.name} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                {m.name}
                {m.badge && BADGE_STYLES[m.badge] && (
                  <span className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${BADGE_STYLES[m.badge].bg} ${BADGE_STYLES[m.badge].text}`}>
                    {locale === "zh" ? BADGE_STYLES[m.badge].zh : BADGE_STYLES[m.badge].en}
                  </span>
                )}
              </td>
              <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {m.developer}
              </td>
              <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400">
                {locale === "zh" ? m.descZh : m.descEn}
              </td>
              <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 font-mono text-xs hidden sm:table-cell">
                {m.id ?? "-"}
              </td>
              <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {m.price ?? "-"}
              </td>
              <td className="py-2.5">
                <TierBadge tier={m.tier} locale={locale} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Developer cards — grouped by developer                             */
/* ------------------------------------------------------------------ */

interface DeveloperInfo {
  name: string;
  descZh: string;
  descEn: string;
  url: string;
  color: string;
}

const DEVELOPERS: DeveloperInfo[] = [
  {
    name: "OpenAI",
    descZh: "GPT 系列大语言模型及 TTS 语音合成的开发商",
    descEn: "Creator of the GPT language model series and TTS voice synthesis",
    url: "https://openai.com",
    color: "bg-emerald-500",
  },
  {
    name: "Anthropic",
    descZh: "Claude 系列大语言模型开发商，专注安全与对齐",
    descEn: "Creator of Claude language models, focused on safety & alignment",
    url: "https://anthropic.com",
    color: "bg-amber-500",
  },
  {
    name: "ByteDance",
    descZh: "Seedream / Seedance / Dreamina 系列视觉模型的开发商",
    descEn: "Creator of Seedream, Seedance & Dreamina visual AI models",
    url: "https://bytedance.com",
    color: "bg-blue-500",
  },
  {
    name: "Alibaba",
    descZh: "Wan 系列及 Qwen 系列模型的开发商",
    descEn: "Creator of Wan series and Qwen series AI models",
    url: "https://www.alibabagroup.com",
    color: "bg-orange-500",
  },
  {
    name: "Google",
    descZh: "Gemini 系列大语言模型的开发商",
    descEn: "Creator of the Gemini language model series",
    url: "https://deepmind.google",
    color: "bg-red-500",
  },
  {
    name: "xAI",
    descZh: "Grok 系列大语言模型的开发商",
    descEn: "Creator of the Grok language model series",
    url: "https://x.ai",
    color: "bg-gray-700",
  },
  {
    name: "Black Forest Labs",
    descZh: "FLUX 系列图像编辑模型的开发商",
    descEn: "Creator of the FLUX image editing model series",
    url: "https://blackforestlabs.ai",
    color: "bg-violet-500",
  },
  {
    name: "Kuaishou",
    descZh: "Kling 视频生成模型的开发商",
    descEn: "Creator of the Kling video generation model",
    url: "https://www.kuaishou.com",
    color: "bg-pink-500",
  },
  {
    name: "Mistral",
    descZh: "欧洲领先的开源大语言模型开发商",
    descEn: "Europe's leading open-source language model developer",
    url: "https://mistral.ai",
    color: "bg-cyan-500",
  },
  {
    name: "Cheng et al.",
    descZh: "MMAudio 视频转音频模型的研究团队（UIUC / Sony Research）",
    descEn: "Research team behind the MMAudio video-to-audio model (UIUC / Sony Research)",
    url: "https://hkchengrex.github.io/MMAudio/",
    color: "bg-rose-500",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ModelsDocsPage() {
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {locale === "zh" ? "AI 模型文档" : "AI Model Documentation"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {locale === "zh"
                  ? "了解平台上使用的 AI 模型及其开发商"
                  : "Learn about the AI models and their developers on our platform"}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                49 {locale === "zh" ? "个模型" : "Models"}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                13 {locale === "zh" ? "个免费" : "Free"}
              </span>
              <LanguageSwitcher className="text-sm text-gray-700 dark:text-gray-200 hover:underline underline-offset-4 font-medium" />
              <Link
                href={`/${locale}/docs`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← {locale === "zh" ? "所有文档" : "All Docs"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Model stats overview */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-3">
          {[
            { num: "49", zh: "AI 模型", en: "AI Models", color: "text-blue-600 dark:text-blue-400" },
            { num: "13", zh: "免费模型", en: "Free", color: "text-emerald-600 dark:text-emerald-400" },
            { num: "14", zh: "图像", en: "Image", color: "text-sky-600 dark:text-sky-400" },
            { num: "10", zh: "视频", en: "Video", color: "text-purple-600 dark:text-purple-400" },
            { num: "19", zh: "文字", en: "Text", color: "text-amber-600 dark:text-amber-400" },
            { num: "4", zh: "音频", en: "Audio", color: "text-rose-600 dark:text-rose-400" },
            { num: "2", zh: "后期制作", en: "Post-Prod", color: "text-orange-600 dark:text-orange-400" },
          ].map((s) => (
            <div key={s.en} className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm border border-gray-100 dark:border-gray-700">
              <p className={`text-2xl sm:text-3xl font-bold ${s.color}`}>{s.num}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{locale === "zh" ? s.zh : s.en}</p>
            </div>
          ))}
        </div>

        {/* Developer overview */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {locale === "zh" ? "合作模型开发商" : "Model Developers"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DEVELOPERS.map((dev) => (
              <a
                key={dev.name}
                href={dev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span
                  className={`flex-shrink-0 w-8 h-8 rounded-lg ${dev.color} flex items-center justify-center text-white font-bold text-xs`}
                >
                  {dev.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {dev.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {locale === "zh" ? dev.descZh : dev.descEn}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Image Generation */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🖼️</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "免费图像模型" : "Free Image Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "零成本使用顶级 AI 图像模型，无需付费。"
              : "Use top AI image models at zero cost. No credits needed."}
          </p>
          <ModelTable models={FREE_IMAGE_MODELS} locale={locale} />
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400">
            {locale === "zh"
              ? "免费模型存在速率限制（约 10 次/分钟），高峰期可能排队等待。如需更快速度和更高稳定性，请使用付费模型。"
              : "Free models have rate limits (~10 req/min) and may queue during peak hours. For faster speed and higher reliability, use paid models."}
          </div>
        </section>

        {/* Image Generation (Paid) */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🖼️</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "图像生成模型" : "Image Generation Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "从文字描述生成高质量图片，支持多种风格和分辨率。"
              : "Generate high-quality images from text descriptions with various styles and resolutions."}
          </p>
          <ModelTable models={IMAGE_GENERATION_MODELS} locale={locale} />
        </section>

        {/* Image Editing */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">✏️</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "图像编辑模型" : "Image Editing Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "上传现有图片进行编辑、增强或风格转换。"
              : "Upload existing images for editing, enhancement, or style transformation."}
          </p>
          <ModelTable models={IMAGE_EDITING_MODELS} locale={locale} />
        </section>

        {/* Video Generation (T2V) */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎬</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh"
                ? "视频生成模型（文本转视频）"
                : "Video Generation Models (Text-to-Video)"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "通过文字描述自动生成短视频，部分模型支持同步生成音频。"
              : "Auto-generate short videos from text descriptions. Some models support synchronized audio generation."}
          </p>
          <ModelTable models={VIDEO_T2V_MODELS} locale={locale} />
        </section>

        {/* Video Generation (I2V) */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎞️</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh"
                ? "视频生成模型（图片转视频）"
                : "Video Generation Models (Image-to-Video)"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "将静态图片转化为动态视频，赋予图片生命力。"
              : "Transform static images into dynamic videos, bringing images to life."}
          </p>
          <ModelTable models={VIDEO_I2V_MODELS} locale={locale} />
        </section>

        {/* Free Text Models */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🆓</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "免费文字模型" : "Free Text Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "零成本使用多款顶级 AI 大语言模型，无需付费。"
              : "Use top AI language models at zero cost. No credits needed."}
          </p>
          <ModelTable models={FREE_TEXT_MODELS} locale={locale} />
          <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400">
            {locale === "zh"
              ? "免费模型存在速率限制（约 10 次/分钟），高峰期可能排队等待。如需更快速度和更高稳定性，请使用付费模型。"
              : "Free models have rate limits (~10 req/min) and may queue during peak hours. For faster speed and higher reliability, use paid models."}
          </div>
        </section>

        {/* Text Generation (Paid) */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📝</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "文字生成模型" : "Text Generation Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "多家领先 AI 大语言模型，用于社交内容创作、改写和优化。"
              : "Multiple leading AI language models for social content creation, rewriting, and optimization."}
          </p>
          <ModelTable models={TEXT_GENERATION_MODELS} locale={locale} />
        </section>

        {/* Voice */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎙️</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "语音合成模型" : "Voice Synthesis Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "将文字转换为自然语音，支持多种音色和语速调节。"
              : "Convert text to natural speech with multiple voice options and speed control."}
          </p>
          <ModelTable models={VOICE_MODELS} locale={locale} />
          <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400">
            {locale === "zh" ? (
              <>
                <span className="font-medium text-gray-900 dark:text-white">
                  可选音色：
                </span>{" "}
                Alloy · Echo · Fable · Onyx · Nova · Shimmer
              </>
            ) : (
              <>
                <span className="font-medium text-gray-900 dark:text-white">
                  Available voices:
                </span>{" "}
                Alloy · Echo · Fable · Onyx · Nova · Shimmer
              </>
            )}
          </div>
        </section>

        {/* Background Music Generation */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎵</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "背景音乐生成模型" : "Background Music Generation Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "根据视频内容和文字描述自动生成同步的背景音乐，无需额外素材。"
              : "Auto-generate synchronized background music from video content and text descriptions, no extra assets needed."}
          </p>
          <ModelTable models={BGM_MODELS} locale={locale} />
        </section>

        {/* Video Narration */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🗣️</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "视频旁白模型" : "Video Narration Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "AI 自动分析视频内容并生成配音旁白。该功能由两个模型协作完成：先用 Gemini 2.5 Flash 分析视频画面，再用 TTS-1 将生成的脚本转换为语音。"
              : "AI automatically analyzes video content and generates voiced narration. This feature uses two models in tandem: Gemini 2.5 Flash analyzes the video frames, then TTS-1 converts the generated script to speech."}
          </p>
          <ModelTable models={NARRATION_MODELS} locale={locale} />
          <div className="mt-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400">
            {locale === "zh" ? (
              <>
                <span className="font-medium text-gray-900 dark:text-white">
                  旁白风格：
                </span>{" "}
                专业 · 轻松 · 戏剧化 · 纪录片 · 活力
              </>
            ) : (
              <>
                <span className="font-medium text-gray-900 dark:text-white">
                  Narration styles:
                </span>{" "}
                Professional · Casual · Dramatic · Documentary · Enthusiastic
              </>
            )}
          </div>
        </section>

        {/* Post-Production */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🎨</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {locale === "zh" ? "后期制作模型" : "Post-Production Models"}
            </h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {locale === "zh"
              ? "视频后期处理工具 — 目标跟踪、内容替换和自然语言编辑。"
              : "Video post-processing tools — object tracking, content replacement, and natural language editing."}
          </p>
          <ModelTable models={POST_PRODUCTION_MODELS} locale={locale} />
        </section>

        {/* Tier explanation */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {locale === "zh" ? "模型等级说明" : "Model Tier Guide"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { tier: "free" as const, zh: "零成本使用，有速率限制，高峰期可能排队。", en: "Zero cost with rate limits. May queue during peak hours." },
              { tier: "fast" as const, zh: "生成速度最快，费用最低，适合快速迭代和日常使用。", en: "Fastest generation, lowest cost. Ideal for quick iteration." },
              { tier: "standard" as const, zh: "速度与质量的最佳平衡，推荐大多数场景使用。", en: "Best balance of speed and quality. Recommended for most uses." },
              { tier: "premium" as const, zh: "最高质量输出，适合专业创作和重要内容发布。", en: "Highest quality. Best for professional and important content." },
            ].map((t) => (
              <div key={t.tier} className="rounded-xl border border-gray-100 dark:border-gray-700 p-3 space-y-2">
                <TierBadge tier={t.tier} locale={locale} />
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {locale === "zh" ? t.zh : t.en}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-4">
          <Link
            href={`/${locale}/media-studio/video`}
            className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {locale === "zh" ? "立即试用媒体工作室 →" : "Try Media Studio →"}
          </Link>
        </section>
      </main>
    </div>
  );
}
