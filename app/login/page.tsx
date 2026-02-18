"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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

export default function LoginPage() {
  const [userAgent] = useState(() =>
    typeof window === "undefined" ? "" : window.navigator.userAgent || ""
  );
  const [copied, setCopied] = useState(false);

  const browserEnv = useMemo(() => detectInAppBrowser(userAgent), [userAgent]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              X Post Scheduler
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Schedule and automate your X (Twitter) posts with AI-powered
              content generation
            </p>
          </div>

          <div className="space-y-4">
            {browserEnv.isInAppBrowser ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4 text-sm">
                <p className="font-semibold text-base">
                  {browserEnv.isWeChat ? "检测到微信浏览器" : "Embedded browser detected"}
                </p>
                <p className="mt-2">
                  {browserEnv.isWeChat
                    ? "微信内置浏览器不支持登录，请点击右上角「...」菜单，选择「在默认浏览器中打开」。"
                    : "Sign-in is not supported in embedded browsers. Please open this page in Safari or Chrome."}
                </p>
                {browserEnv.isWeChat && (
                  <p className="mt-2 text-amber-800">
                    Sign-in requires a system browser. Tap the &quot;...&quot; menu (top-right) and choose &quot;Open in Browser&quot;.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="mt-3 w-full inline-flex items-center justify-center px-3 py-2.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors font-medium"
                >
                  {copied ? "Link copied! / 已复制!" : "Copy link / 复制链接"}
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                Sign In / Sign Up
              </Link>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Features:
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-green-500"
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
                Schedule posts for optimal engagement times
              </li>
              <li className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-green-500"
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
                AI-powered content generation
              </li>
              <li className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-green-500"
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
                Knowledge base from your websites
              </li>
              <li className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-green-500"
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
                Recurring post schedules
              </li>
              <li className="flex items-center">
                <svg
                  className="w-4 h-4 mr-2 text-green-500"
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
                Multi-language support (English, Chinese, etc.)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
