"use client";

import { useParams, usePathname } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0/client";
import ApiKeyManager from "@/components/ApiKeyManager";
import Link from "next/link";

export default function ApiKeysPage() {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params.locale as string) || "en";
  const isZh = locale === "zh";
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400 text-sm">
          {isZh ? "加载中…" : "Loading…"}
        </div>
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(pathname || `/${locale}/settings/api-keys`);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isZh ? "请先登录" : "Sign in required"}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isZh
              ? "登录后才能创建和管理 API 密钥。"
              : "You need to sign in before creating or managing API keys."}
          </p>
          <a
            href={`/auth/login?returnTo=${returnTo}`}
            className="mt-6 inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isZh ? "立即登录" : "Sign in"}
          </a>
          <Link
            href={`/${locale}`}
            className="mt-3 inline-block text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {isZh ? "← 返回首页" : "← Back to home"}
          </Link>
        </div>
      </div>
    );
  }

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
