"use client";

import { useParams } from "next/navigation";
import ApiKeyManager from "@/components/ApiKeyManager";
import Link from "next/link";

export default function ApiKeysPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const isZh = locale === "zh";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="mb-6">
          <Link
            href={`/${locale}/settings`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; {isZh ? "返回设置" : "Back to Settings"}
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isZh ? "API 密钥管理" : "API Key Management"}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isZh
              ? "创建和管理 API 密钥，通过 REST API 访问 xPilot 的 AI 模型（视频生成、图片生成、文本生成）。"
              : "Create and manage API keys to access xPilot's AI models (video, image, and text generation) via REST API."}
          </p>
          <Link
            href={`/${locale}/docs/api`}
            className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isZh ? "查看 API 文档" : "View API Documentation"} &rarr;
          </Link>
        </div>

        <ApiKeyManager locale={locale} />
      </div>
    </div>
  );
}
