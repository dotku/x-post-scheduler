"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface DocCard {
  href: string;
  titleEn: string;
  titleZh: string;
  descEn: string;
  descZh: string;
  icon: React.ReactNode;
  accent: string; // tailwind color pair for icon bg
}

const DOC_CARDS: DocCard[] = [
  {
    href: "/docs/models",
    titleEn: "AI Models",
    titleZh: "AI 模型",
    descEn:
      "Complete catalog of 49+ AI models for images, video, text, voice, music, and post-production — with pricing at cost.",
    descZh:
      "49+ AI 模型完整目录，涵盖图像、视频、文本、语音、音乐、后期制作——价格透明，0% 加价。",
    accent: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    href: "/docs/api",
    titleEn: "REST API",
    titleZh: "REST API",
    descEn:
      "Programmatic access to post scheduling, content generation, and analytics — authenticate with API keys.",
    descZh:
      "通过 API 密钥调用发帖、内容生成、数据分析等功能。",
    accent: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    href: "/docs/ide",
    titleEn: "Use xPilot in Your IDE",
    titleZh: "在 IDE 中使用 xPilot",
    descEn:
      "Configure Cline, Cursor, Continue, Zed to use xPilot as their LLM via the OpenAI-compatible chat completions API.",
    descZh:
      "通过 OpenAI 兼容的 chat completions 接口，将 Cline、Cursor、Continue、Zed 的大模型切换为 xPilot。",
    accent: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    href: "/docs/mcp",
    titleEn: "MCP Integration",
    titleZh: "MCP 集成",
    descEn:
      "Model Context Protocol — connect your AI agents (Claude, ChatGPT) directly to xPilot for automated workflows.",
    descZh:
      "Model Context Protocol — 让你的 AI 助手（Claude、ChatGPT）直接调用 xPilot 能力。",
    accent: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    href: "/docs/cline",
    titleEn: "Cline (VS Code)",
    titleZh: "Cline（VS Code）",
    descEn:
      "Use xPilot directly from the Cline coding agent in VS Code — schedule posts and generate media from your editor.",
    descZh:
      "在 VS Code 的 Cline 编码助手中直接使用 xPilot — 编辑器内发帖、生成媒体。",
    accent: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25M14.25 3l-4.5 18" />
      </svg>
    ),
  },
  {
    href: "/docs/x-api",
    titleEn: "X API Setup",
    titleZh: "X API 设置",
    descEn:
      "Step-by-step guide to obtain X (Twitter) Developer credentials and connect your account to xPilot.",
    descZh:
      "获取 X (Twitter) 开发者密钥并接入 xPilot 的分步指南。",
    accent: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

export default function DocsIndexPage() {
  const locale = useLocale();
  const isZh = locale === "zh";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Documentation
          </h1>
          <div className="flex items-center gap-4">
            <LanguageSwitcher className="text-sm text-gray-700 dark:text-gray-200 hover:underline underline-offset-4 font-medium" />
            <Link
              href="/"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ← {isZh ? "返回首页" : "Back to Home"}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {isZh ? "文档中心" : "xPilot Docs"}
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl">
            {isZh
              ? "浏览完整的 xPilot 使用指南：AI 模型目录、API 参考、MCP 集成与平台设置。"
              : "Explore everything you need to get the most out of xPilot — AI model catalog, API reference, MCP integration, and platform setup."}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
          {DOC_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className={`inline-flex w-12 h-12 items-center justify-center rounded-lg ${card.accent}`}>
                {card.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {isZh ? card.titleZh : card.titleEn}
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {isZh ? card.descZh : card.descEn}
              </p>
              <span className="mt-3 inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 gap-1 transition-all">
                {isZh ? "阅读文档" : "Read docs"}
                <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-5">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                {isZh ? "AI 模型定价：0% 加价" : "AI Pricing: 0% Markup"}
              </p>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300">
                {isZh
                  ? "所有 AI 模型按上游服务商成本价计费，xPilot 不在 AI 调用上加价。"
                  : "All AI model calls are billed at upstream provider cost — xPilot adds 0% margin on AI inference."}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
