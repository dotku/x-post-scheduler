"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function tr(locale: string, en: string, zh: string) {
  return locale === "zh" ? zh : en;
}

function CodeBlock({ children, lang }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group">
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
        {lang && (
          <span className="absolute top-2 right-12 text-[10px] uppercase tracking-wider text-gray-500">
            {lang}
          </span>
        )}
        <code>{children}</code>
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

export default function ClineDocsPage() {
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {tr(locale, "Cline Integration", "Cline 集成")}
            </h1>
            <div className="flex gap-3 items-center">
              <LanguageSwitcher className="text-sm text-gray-700 dark:text-gray-200 hover:underline underline-offset-4 font-medium" />
              <Link
                href={`${prefix}/docs`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← {tr(locale, "All Docs", "所有文档")}
              </Link>
              <Link
                href={`${prefix}/docs/mcp`}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {tr(locale, "MCP →", "MCP →")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Intro */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {tr(
              locale,
              "Use xPilot inside Cline",
              "在 Cline 中使用 xPilot",
            )}
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {tr(
              locale,
              "Cline is an open-source AI coding agent for VS Code. xPilot exposes all platform features through MCP, so Cline can schedule posts, generate videos, run campaigns, and query analytics directly from your editor.",
              "Cline 是面向 VS Code 的开源 AI 编码助手。xPilot 通过 MCP 协议暴露所有平台能力，Cline 可直接在编辑器中发帖、生成视频、管理 Campaign 和查询数据。",
            )}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">
              {tr(
                locale,
                "AI inference billed at cost · 0% markup",
                "AI 调用按上游成本计费 · 0% 加价",
              )}
            </span>
          </div>
        </div>

        {/* Step 1: Install Cline */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              1
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Install Cline", "安装 Cline")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {tr(locale, "VS Code marketplace", "VS Code 应用市场")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                {tr(
                  locale,
                  "Install the Cline extension from the VS Code marketplace:",
                  "从 VS Code 应用市场安装 Cline 扩展：",
                )}
              </p>
              <a
                href="https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {tr(locale, "Open in VS Code Marketplace", "在 VS Code 市场打开")}
                <span className="ml-1">→</span>
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                {tr(
                  locale,
                  "Or search for \"Cline\" in VS Code Extensions (Ctrl+Shift+X).",
                  "或在 VS Code 扩展（Ctrl+Shift+X）中搜索 \"Cline\"。",
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Get API key */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              2
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Get your xPilot API key", "获取 xPilot API Key")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {tr(locale, "Generate from Settings", "在设置页生成")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                {tr(
                  locale,
                  "Go to Settings → API Keys and create a new key. It starts with xp_.",
                  "进入 设置 → API Keys，创建新密钥。密钥以 xp_ 开头。",
                )}
              </p>
              <Link
                href={`${prefix}/settings/api-keys`}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {tr(locale, "Open Settings", "打开设置")}
                <span className="ml-1">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Step 3: Configure MCP in Cline */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              3
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Configure xPilot as an MCP server", "将 xPilot 配置为 MCP 服务器")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {tr(locale, "Edit cline_mcp_settings.json", "编辑 cline_mcp_settings.json")}
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <li>
                  {tr(
                    locale,
                    "Open the Cline sidebar in VS Code and click the MCP Servers icon (top right).",
                    "在 VS Code 打开 Cline 侧边栏，点击右上角的 MCP Servers 图标。",
                  )}
                </li>
                <li>
                  {tr(
                    locale,
                    "Click the Edit MCP Settings button to open cline_mcp_settings.json.",
                    "点击 Edit MCP Settings 按钮，打开 cline_mcp_settings.json。",
                  )}
                </li>
                <li>
                  {tr(
                    locale,
                    "Add the xpilot server entry shown below and save.",
                    "粘贴以下 xpilot 服务器配置并保存。",
                  )}
                </li>
              </ol>
              <CodeBlock lang="json">{`{
  "mcpServers": {
    "xpilot": {
      "type": "streamableHttp",
      "url": "https://xpilot.jytech.us/api/mcp",
      "headers": {
        "Authorization": "Bearer xp_your_api_key_here"
      }
    }
  }
}`}</CodeBlock>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
                {tr(
                  locale,
                  "Replace xp_your_api_key_here with your actual key. Cline reloads MCP servers automatically on save.",
                  "将 xp_your_api_key_here 替换为你的实际密钥。Cline 保存后会自动重新加载 MCP 服务器。",
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Step 4: Verify */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              4
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Verify the connection", "验证连接")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {tr(locale, "Tools should appear in the MCP panel", "工具应出现在 MCP 面板")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {tr(
                  locale,
                  "Reopen the Cline MCP Servers panel — xpilot should show a green dot and list available tools (schedule_post, generate_video, list_campaigns, etc). If it shows a red error, double-check your API key.",
                  "重新打开 Cline 的 MCP Servers 面板 — xpilot 应显示绿色指示灯，并列出可用工具（schedule_post、generate_video、list_campaigns 等）。若显示红色错误，请检查 API 密钥。",
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Example prompts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {tr(locale, "Example prompts", "示例提示词")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {tr(
              locale,
              "Try these in the Cline chat once xPilot is connected:",
              "xPilot 连接后，在 Cline 聊天中尝试以下指令：",
            )}
          </p>
          <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <li className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <span className="block text-gray-900 dark:text-white font-medium mb-1">
                {tr(locale, "Schedule a post", "定时发帖")}
              </span>
              <code className="text-xs text-gray-600 dark:text-gray-400">
                {tr(
                  locale,
                  "Schedule a tweet about our new feature launch for tomorrow at 9am ET.",
                  "帮我明天早上 9 点发一条关于新功能的推文。",
                )}
              </code>
            </li>
            <li className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <span className="block text-gray-900 dark:text-white font-medium mb-1">
                {tr(locale, "Generate a video", "生成视频")}
              </span>
              <code className="text-xs text-gray-600 dark:text-gray-400">
                {tr(
                  locale,
                  "Use Wan 2.2 to generate a 5-second video of a sunrise over mountains.",
                  "用 Wan 2.2 生成一段 5 秒的山顶日出视频。",
                )}
              </code>
            </li>
            <li className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <span className="block text-gray-900 dark:text-white font-medium mb-1">
                {tr(locale, "Analyze campaign performance", "分析 Campaign 数据")}
              </span>
              <code className="text-xs text-gray-600 dark:text-gray-400">
                {tr(
                  locale,
                  "Pull the last 30 days of engagement for my spring_launch campaign and summarize it.",
                  "拉取我 spring_launch 活动最近 30 天的互动数据并总结。",
                )}
              </code>
            </li>
          </ul>
        </div>

        {/* Troubleshooting */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {tr(locale, "Troubleshooting", "常见问题")}
          </h3>
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {tr(locale, "Server status shows red / 401", "服务器状态为红色 / 401")}
              </p>
              <p>
                {tr(
                  locale,
                  "Your API key is invalid or missing the Authorization prefix. The header value must be Bearer xp_... (with a space after Bearer).",
                  "API 密钥无效或缺少 Authorization 前缀。请确认 header 为 Bearer xp_...（Bearer 后需要一个空格）。",
                )}
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {tr(locale, "No tools appear", "没有显示任何工具")}
              </p>
              <p>
                {tr(
                  locale,
                  "Make sure type is set to streamableHttp (not stdio). Reopen the MCP Servers panel or restart VS Code.",
                  "请确认 type 设置为 streamableHttp（不是 stdio）。重新打开 MCP Servers 面板或重启 VS Code。",
                )}
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {tr(locale, "Rate limited", "请求过于频繁")}
              </p>
              <p>
                {tr(
                  locale,
                  "xPilot enforces per-account rate limits. Wait 30–60 seconds before retrying, or upgrade your plan.",
                  "xPilot 对每个账户有速率限制。请稍等 30–60 秒后重试，或升级套餐。",
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Related */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href={`${prefix}/docs/ide`}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <p className="font-semibold text-gray-900 dark:text-white">
              {tr(locale, "xPilot as Cline's LLM", "将 xPilot 作为 Cline 的大模型")}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {tr(
                locale,
                "Route Cline's chat through xPilot (OpenAI-compatible).",
                "将 Cline 的对话通过 xPilot（OpenAI 兼容）调用。",
              )}
            </p>
          </Link>
          <Link
            href={`${prefix}/docs/cline/models`}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <p className="font-semibold text-gray-900 dark:text-white">
              {tr(locale, "Calling Models from Cline", "在 Cline 中调用模型")}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {tr(
                locale,
                "Tool schemas, model IDs, and end-to-end prompt examples.",
                "工具参数、模型 ID 与端到端提示示例。",
              )}
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
