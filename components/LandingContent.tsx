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

const features = [
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
    title: "Smart Scheduling",
    description:
      "Schedule posts at optimal times for maximum engagement. Set one-time or recurring schedules with flexible cron expressions.",
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    ),
    title: "AI Content Generation",
    description:
      "Generate high-quality posts powered by AI. Use your knowledge base as context for relevant, on-brand content.",
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
    title: "Knowledge Base",
    description:
      "Import content from your websites to build a knowledge base. AI uses this context to generate posts that match your brand voice.",
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    ),
    title: "Recurring Automation",
    description:
      "Set up recurring schedules to automatically post AI-generated content daily, weekly, or on a custom schedule.",
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    ),
    title: "Multi-Account Support",
    description:
      "Connect multiple X accounts and choose which one to post from. Manage all your brand accounts in one place.",
  },
  {
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
      />
    ),
    title: "Multi-Language",
    description:
      "Generate content in English, Chinese, and more. Reach your global audience with localized posts.",
  },
];

export default function LandingContent() {
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            X Post Scheduler
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/docs"
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Docs
            </Link>
            {!browserEnv.isInAppBrowser && (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Beta Notice */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-center text-sm text-amber-800 dark:text-amber-200">
          This project is currently in beta testing. Please do not use it in production environments. / 本项目目前处于内测阶段，请勿用于生产环境。
        </div>
      </div>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
          Automate Your X Posts
          <br className="hidden sm:block" />
          <span className="text-blue-600 dark:text-blue-400"> with AI</span>
        </h2>
        <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Schedule posts, generate AI-powered content from your knowledge base,
          and grow your audience on autopilot. Free $5 credit to get started.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {browserEnv.isInAppBrowser ? (
            <div className="w-full max-w-md rounded-lg border border-amber-300 bg-amber-50 text-amber-900 p-4 text-sm text-left">
              <p className="font-semibold text-base">
                {browserEnv.isWeChat
                  ? "检测到微信浏览器"
                  : "Embedded browser detected"}
              </p>
              <p className="mt-2">
                {browserEnv.isWeChat
                  ? '微信内置浏览器不支持登录，请点击右上角「...」菜单，选择「在默认浏览器中打开」。'
                  : "Sign-in is not supported in embedded browsers. Please open this page in Safari or Chrome."}
              </p>
              {browserEnv.isWeChat && (
                <p className="mt-2 text-amber-800">
                  Sign-in requires a system browser. Tap the &quot;...&quot;
                  menu (top-right) and choose &quot;Open in Browser&quot;.
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
            <>
              <Link
                href="/login"
                className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
              >
                Get Started Free
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No credit card required
              </p>
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white dark:bg-gray-800 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Everything you need to grow on X
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

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h3 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          How it works
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg mb-4">
              1
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Connect your X account
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add your X API credentials to start posting. Support for multiple
              accounts.
            </p>
          </div>
          <div>
            <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg mb-4">
              2
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Build your knowledge base
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Import your website content so AI can generate relevant,
              on-brand posts.
            </p>
          </div>
          <div>
            <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-lg mb-4">
              3
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Schedule & automate
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create one-time or recurring posts. Let AI generate and post
              content automatically.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white dark:bg-gray-800 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, pay-as-you-go pricing
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
            Start with $5 free credit. Top up anytime. Only pay for AI
            generations you use.
          </p>
          <div className="inline-flex flex-col items-center bg-gray-50 dark:bg-gray-900 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
            <p className="text-4xl font-extrabold text-gray-900 dark:text-white">
              $5
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              free credit to start
            </p>
            <ul className="mt-6 space-y-2 text-sm text-gray-600 dark:text-gray-400 text-left">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Unlimited scheduled posts
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                AI content generation
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Top up $5 / $10 / $25 anytime
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                No monthly subscription
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      {!browserEnv.isInAppBrowser && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to automate your X presence?
          </h3>
          <Link
            href="/login"
            className="inline-flex items-center px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-lg"
          >
            Get Started Free
          </Link>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-8">
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          X Post Scheduler
        </p>
      </footer>
    </div>
  );
}
