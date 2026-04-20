"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

interface FeaturedModel {
  name: string;
  id: string;
  developer: string;
  category: "text" | "image" | "video";
  descEn: string;
  descZh: string;
  tier: "free" | "fast" | "standard" | "premium";
}

// Top picks across categories — curated, not exhaustive
const FEATURED: FeaturedModel[] = [
  {
    name: "Claude Sonnet 4",
    id: "anthropic/claude-sonnet-4",
    developer: "Anthropic",
    category: "text",
    descEn: "Best-in-class writing and reasoning for long-form content.",
    descZh: "一流写作与推理能力，适合长文内容生成。",
    tier: "premium",
  },
  {
    name: "GPT-5",
    id: "openai/gpt-5",
    developer: "OpenAI",
    category: "text",
    descEn: "Flagship general-purpose model for any task.",
    descZh: "旗舰通用模型，适用于各类任务。",
    tier: "premium",
  },
  {
    name: "Seedream 4.5",
    id: "seedream-v4.5",
    developer: "ByteDance",
    category: "image",
    descEn: "4K bilingual image generation — native Chinese + English.",
    descZh: "4K 中英双语图像生成，原生支持中文提示词。",
    tier: "standard",
  },
  {
    name: "FLUX.2 Pro",
    id: "flux-2-pro",
    developer: "Black Forest Labs",
    category: "image",
    descEn: "Free high-quality text-to-image with rate limits.",
    descZh: "免费高质量文生图，有速率限制。",
    tier: "free",
  },
  {
    name: "Seedance 2.0",
    id: "seedance-2.0/text-to-video",
    developer: "ByteDance",
    category: "video",
    descEn: "Cinematic video with audio, up to 12s, lock-camera support.",
    descZh: "电影级视频生成，支持音频与锁定镜头，最长 12 秒。",
    tier: "premium",
  },
  {
    name: "Wan 2.2 Ultra Fast",
    id: "wan-2.2/t2v-480p-ultra-fast",
    developer: "Alibaba",
    category: "video",
    descEn: "~5 second video generation at 480p — lightning fast.",
    descZh: "极速生成 480p 视频，约 5 秒出片。",
    tier: "fast",
  },
];

const CATEGORY_STYLES: Record<
  FeaturedModel["category"],
  { bg: string; text: string; labelEn: string; labelZh: string }
> = {
  text: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    labelEn: "Text",
    labelZh: "文本",
  },
  image: {
    bg: "bg-pink-100 dark:bg-pink-900/30",
    text: "text-pink-700 dark:text-pink-300",
    labelEn: "Image",
    labelZh: "图像",
  },
  video: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    labelEn: "Video",
    labelZh: "视频",
  },
};

const TIER_LABELS: Record<FeaturedModel["tier"], { en: string; zh: string; color: string }> = {
  free: { en: "Free", zh: "免费", color: "text-emerald-600 dark:text-emerald-400" },
  fast: { en: "Fast", zh: "快速", color: "text-green-600 dark:text-green-400" },
  standard: { en: "Standard", zh: "标准", color: "text-blue-600 dark:text-blue-400" },
  premium: { en: "Premium", zh: "高端", color: "text-purple-600 dark:text-purple-400" },
};

export default function FeaturedModels() {
  const locale = useLocale();
  const isZh = locale === "zh";
  const prefix = `/${locale}`;

  return (
    <section className="bg-gray-50 dark:bg-gray-900 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {isZh ? "AI 模型目录" : "AI Model Catalog"}
            </p>
            <h3 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {isZh ? "精选 AI 模型" : "Featured AI Models"}
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400 max-w-2xl">
              {isZh
                ? "49+ 模型覆盖文本、图像、视频、语音——按上游服务商成本计费，0% 加价。"
                : "49+ models spanning text, image, video, voice — billed at upstream cost, 0% markup."}
            </p>
          </div>
          <Link
            href={`${prefix}/docs/models`}
            className="inline-flex items-center gap-1 self-start sm:self-auto px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-blue-600 dark:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            {isZh ? "查看全部模型" : "View all models"}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FEATURED.map((m) => {
            const cat = CATEGORY_STYLES[m.category];
            const tier = TIER_LABELS[m.tier];
            return (
              <Link
                key={m.id}
                href={`${prefix}/docs/models`}
                className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cat.bg} ${cat.text}`}
                  >
                    {isZh ? cat.labelZh : cat.labelEn}
                  </span>
                  <span className={`text-xs font-semibold ${tier.color}`}>
                    {isZh ? tier.zh : tier.en}
                  </span>
                </div>
                <h4 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {m.name}
                </h4>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                  {m.developer}
                </p>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {isZh ? m.descZh : m.descEn}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">
            {isZh ? "定价透明 · 0% 加价" : "Transparent pricing · 0% markup"}
          </span>
        </div>
      </div>
    </section>
  );
}
