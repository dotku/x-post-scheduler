"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Lang = "en" | "zh";

type GalleryItem = {
  id: string;
  type: "image" | "video";
  modelId: string;
  modelLabel: string;
  prompt: string;
  blobUrl: string;
  sourceUrl: string;
  inputImageUrl: string | null;
  generationMeta: string | null;
  aspectRatio: string | null;
  mimeType: string;
  isPublic: boolean;
  createdAt: string;
  user?: { name: string | null; picture: string | null };
};

const TEXT = {
  en: {
    title: "Gallery Detail",
    back: "<- Back to Gallery",
    loading: "Loading...",
    failed: "Failed to load item",
    notFound: "Item not found or no access",
    retry: "Retry",
    generated: "Generated Output",
    original: "Original Image",
    process: "Generation Process",
    metadata: "Metadata",
    prompt: "Prompt",
    model: "Model",
    modelId: "Model ID",
    type: "Type",
    aspect: "Aspect Ratio",
    visibility: "Visibility",
    public: "Public",
    private: "Private",
    created: "Created At",
    source: "Source URL",
    stepInput: "Input",
    stepModel: "Model",
    stepOutput: "Output",
    noOriginal: "No original image input",
  },
  zh: {
    title: "作品详情",
    back: "<- 返回画廊",
    loading: "加载中...",
    failed: "加载详情失败",
    notFound: "作品不存在或无访问权限",
    retry: "重试",
    generated: "生成结果",
    original: "原始图片",
    process: "生成过程",
    metadata: "元数据",
    prompt: "提示词",
    model: "模型",
    modelId: "模型 ID",
    type: "类型",
    aspect: "宽高比",
    visibility: "可见性",
    public: "公开",
    private: "私密",
    created: "创建时间",
    source: "源地址",
    stepInput: "输入",
    stepModel: "模型处理",
    stepOutput: "输出",
    noOriginal: "没有原始图片输入",
  },
} as const;

function toPrettyJson(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export default function GalleryDetailClient({ id }: { id: string }) {
  const [lang, setLang] = useState<Lang>("en");
  const [item, setItem] = useState<GalleryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const t = TEXT[lang];

  useEffect(() => {
    const saved = localStorage.getItem("app-lang") || localStorage.getItem("gallery-lang");
    if (saved === "zh" || saved === "en") {
      setLang(saved);
      return;
    }
    if (navigator.language.toLowerCase().startsWith("zh")) {
      setLang("zh");
    }
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/gallery/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || t.notFound);
      }
      setItem((data as { item?: GalleryItem }).item ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.failed);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const generationMetaPretty = useMemo(() => toPrettyJson(item?.generationMeta ?? null), [item?.generationMeta]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
          </div>
          <Link href="/gallery" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t.back}
          </Link>
        </div>

        {loading && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-sm text-gray-500">
            {t.loading}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400 space-y-2">
            <p>{error}</p>
            <button
              onClick={() => void load()}
              className="px-3 py-1 rounded border border-red-300 dark:border-red-700 text-xs"
            >
              {t.retry}
            </button>
          </div>
        )}

        {!loading && item && (
          <div className="space-y-4">
            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200">
                {t.generated}
              </div>
              <div className="p-4">
                {item.type === "video" ? (
                  <video src={item.blobUrl} controls className="w-full rounded-lg bg-black" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.blobUrl} alt={item.prompt} className="w-full rounded-lg" />
                )}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200">
                {t.original}
              </div>
              <div className="p-4">
                {item.inputImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.inputImageUrl} alt="input" className="w-full rounded-lg" />
                ) : (
                  <p className="text-sm text-gray-500">{t.noOriginal}</p>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.process}</h2>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <p><span className="font-medium">1. {t.stepInput}:</span> {item.inputImageUrl ? "Image" : "Prompt only"}</p>
                <p><span className="font-medium">2. {t.stepModel}:</span> {item.modelLabel} ({item.modelId})</p>
                <p><span className="font-medium">3. {t.stepOutput}:</span> {item.type.toUpperCase()} ({item.aspectRatio ?? "-"})</p>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.metadata}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">{t.type}:</span> {item.type}</p>
                <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">{t.model}:</span> {item.modelLabel}</p>
                <p className="text-gray-700 dark:text-gray-300 break-all"><span className="font-medium">{t.modelId}:</span> {item.modelId}</p>
                <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">{t.aspect}:</span> {item.aspectRatio ?? "-"}</p>
                <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">{t.visibility}:</span> {item.isPublic ? t.public : t.private}</p>
                <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">{t.created}:</span> {new Date(item.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")}</p>
              </div>

              <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <p className="font-medium">{t.prompt}</p>
                <p className="whitespace-pre-wrap break-words">{item.prompt}</p>
              </div>

              <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <p className="font-medium">{t.source}</p>
                <a className="text-blue-600 dark:text-blue-400 break-all hover:underline" href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {item.sourceUrl}
                </a>
              </div>

              {generationMetaPretty && (
                <pre className="text-xs overflow-x-auto rounded-lg bg-gray-100 dark:bg-gray-900 p-3 text-gray-700 dark:text-gray-200">
                  {generationMetaPretty}
                </pre>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
