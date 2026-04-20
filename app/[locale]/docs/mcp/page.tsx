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

export default function MCPDocsPage() {
  const locale = useLocale();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {tr(locale, "MCP Integration Guide", "MCP 接入指南")}
            </h1>
            <div className="flex gap-3 items-center">
              <LanguageSwitcher className="text-sm text-gray-700 dark:text-gray-200 hover:underline underline-offset-4 font-medium" />
              <Link
                href={locale === "zh" ? "/zh/docs" : "/docs"}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {tr(locale, "← Docs", "← 文档")}
              </Link>
              <Link
                href={locale === "zh" ? "/zh/docs/api" : "/docs/api"}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                REST API →
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* What is MCP */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {tr(locale, "What is MCP?", "什么是 MCP？")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {tr(
              locale,
              "MCP (Model Context Protocol) is an open protocol by Anthropic that lets AI assistants connect to external tools. With xPilot's MCP server, you can generate images, videos, and social media posts directly from Claude Desktop, Claude Code, or any MCP-compatible client.",
              "MCP (Model Context Protocol) 是 Anthropic 推出的开放协议，让 AI 助手能够连接外部工具。通过 xPilot 的 MCP 服务器，您可以直接在 Claude Desktop、Claude Code 或任何兼容 MCP 的客户端中生成图片、视频和社交媒体帖子。",
            )}
          </p>
        </div>

        {/* Available Tools */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {tr(locale, "Available Tools", "可用工具")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white">{tr(locale, "Tool", "工具")}</th>
                  <th className="text-left py-2 font-semibold text-gray-900 dark:text-white">{tr(locale, "Description", "说明")}</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-400">
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2.5 pr-4"><code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">list_models</code></td>
                  <td className="py-2.5">{tr(locale, "List all 49 AI models (13 free), grouped by text/image/video", "列出全部 49 款 AI 模型（13 款免费），按文本/图片/视频分类")}</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2.5 pr-4"><code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">generate_image</code></td>
                  <td className="py-2.5">{tr(locale, "Generate AI images with FLUX, Seedream, and more (free models available)", "AI 文生图，支持 FLUX、Seedream 等（含免费模型）")}</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2.5 pr-4"><code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">generate_video</code></td>
                  <td className="py-2.5">{tr(locale, "Generate AI videos — text-to-video and image-to-video (Seedance, Wan, Kling)", "AI 视频生成 — 文生视频和图生视频（Seedance、Wan、Kling）")}</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2.5 pr-4"><code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">generate_post</code></td>
                  <td className="py-2.5">{tr(locale, "Generate engaging social media posts for X (Twitter)", "生成 X (Twitter) 社交媒体帖子")}</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4"><code className="text-sm bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">check_task</code></td>
                  <td className="py-2.5">{tr(locale, "Check the status of image/video generation tasks", "查询图片/视频生成任务状态")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Prerequisites */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              1
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Get Your API Key", "获取 API Key")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {tr(locale, "Prerequisites", "前提条件")}
              </p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                <li>
                  {tr(
                    locale,
                    "Sign up or log in to xPilot at ",
                    "在 xPilot 注册或登录：",
                  )}
                  <a
                    href="https://xpilot.jytech.us"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline"
                  >
                    xpilot.jytech.us
                  </a>
                </li>
                <li>
                  {tr(
                    locale,
                    "Go to Settings → API Keys and click \"Create New Key\"",
                    "进入 设置 → API Keys，点击「创建新密钥」",
                  )}
                </li>
                <li>
                  {tr(
                    locale,
                    "Copy your API key (starts with xp_). It will only be shown once.",
                    "复制您的 API Key（以 xp_ 开头）。密钥仅显示一次，请妥善保存。",
                  )}
                </li>
              </ol>
              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {tr(
                    locale,
                    "New accounts come with $5 free credit — enough to try all MCP tools.",
                    "新账户赠送 $5 平台点数 — 足够体验所有 MCP 工具。",
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Claude Desktop */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              2
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Connect from Claude Desktop", "在 Claude Desktop 中连接")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {tr(locale, "Add xPilot as an MCP server", "添加 xPilot 为 MCP 服务器")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                {tr(
                  locale,
                  "Open your Claude Desktop config file and add the xPilot server:",
                  "打开 Claude Desktop 配置文件，添加 xPilot 服务器：",
                )}
              </p>
              <ul className="list-disc list-inside text-gray-500 dark:text-gray-400 text-xs mb-3 space-y-1">
                <li>macOS: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
                <li>Windows: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">%APPDATA%\Claude\claude_desktop_config.json</code></li>
              </ul>
              <CodeBlock lang="json">{`{
  "mcpServers": {
    "xpilot": {
      "url": "https://xpilot.jytech.us/api/mcp",
      "headers": {
        "Authorization": "Bearer xp_your_api_key_here"
      }
    }
  }
}`}</CodeBlock>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
                {tr(
                  locale,
                  "Replace xp_your_api_key_here with your actual API key. Restart Claude Desktop after saving.",
                  "将 xp_your_api_key_here 替换为您的实际 API Key。保存后重启 Claude Desktop。",
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Claude Code */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              3
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Connect from Claude Code", "在 Claude Code 中连接")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {tr(locale, "Add to your Claude Code settings", "添加到 Claude Code 设置")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                {tr(
                  locale,
                  "Add to your Claude Code settings.json (or project .mcp.json):",
                  "添加到 Claude Code 的 settings.json（或项目的 .mcp.json）：",
                )}
              </p>
              <CodeBlock lang="json">{`{
  "mcpServers": {
    "xpilot": {
      "type": "url",
      "url": "https://xpilot.jytech.us/api/mcp",
      "headers": {
        "Authorization": "Bearer xp_your_api_key_here"
      }
    }
  }
}`}</CodeBlock>
            </div>
          </div>
        </div>

        {/* Step 4: Usage Examples */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-start gap-4">
            <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
              4
            </span>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Usage Examples", "使用示例")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {tr(locale, "Try these prompts in Claude", "在 Claude 中尝试以下指令")}
              </p>
              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {tr(locale, "List Models", "查看模型")}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                    &ldquo;{tr(
                      locale,
                      "What AI models are available on xPilot? Show me the free ones.",
                      "xPilot 有哪些 AI 模型？给我看看免费的。",
                    )}&rdquo;
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {tr(locale, "Generate Image", "生成图片")}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                    &ldquo;{tr(
                      locale,
                      "Generate an image of a futuristic city skyline at sunset using the free FLUX model.",
                      "用免费的 FLUX 模型生成一张未来城市日落天际线的图片。",
                    )}&rdquo;
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {tr(locale, "Generate Video", "生成视频")}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                    &ldquo;{tr(
                      locale,
                      "Create a 5-second video of ocean waves crashing on a rocky shore.",
                      "生成一段 5 秒的海浪拍打岩石的视频。",
                    )}&rdquo;
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {tr(locale, "Generate Post", "生成帖子")}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                    &ldquo;{tr(
                      locale,
                      "Write a Twitter post about the latest AI trends in marketing, with hashtags.",
                      "写一条关于 AI 营销最新趋势的推文，带上 hashtag。",
                    )}&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Server Endpoints */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {tr(locale, "Server Endpoints", "服务器端点")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white">{tr(locale, "Endpoint", "端点")}</th>
                  <th className="text-left py-2 pr-4 font-semibold text-gray-900 dark:text-white">{tr(locale, "Type", "类型")}</th>
                  <th className="text-left py-2 font-semibold text-gray-900 dark:text-white">{tr(locale, "Auth", "认证")}</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-400">
                <tr className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2.5 pr-4"><code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">https://xpilot.jytech.us/api/mcp</code></td>
                  <td className="py-2.5 pr-4">Next.js</td>
                  <td className="py-2.5">Bearer Token</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4"><code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">https://xpilot-mcp.&lt;account&gt;.workers.dev</code></td>
                  <td className="py-2.5 pr-4">Cloudflare Worker</td>
                  <td className="py-2.5">Bearer Token</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-3">
            {tr(
              locale,
              "Both endpoints support the same MCP tools. The Cloudflare Worker endpoint is edge-deployed globally for faster response times.",
              "两个端点支持相同的 MCP 工具。Cloudflare Worker 端点在全球边缘部署，响应更快。",
            )}
          </p>
        </div>

        {/* Discovery */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {tr(locale, "Discovery & Standards", "发现与标准")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            {tr(
              locale,
              "xPilot follows standard AI discovery protocols:",
              "xPilot 遵循标准 AI 发现协议：",
            )}
          </p>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">GET /api/mcp</code>
              <span>— {tr(locale, "MCP server discovery (tools, resources, transport info)", "MCP 服务器发现（工具、资源、传输信息）")}</span>
            </li>
            <li className="flex items-start gap-2">
              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">/.well-known/ai-plugin.json</code>
              <span>— {tr(locale, "OpenAI plugin manifest for AI platform discovery", "OpenAI 插件清单，供 AI 平台发现")}</span>
            </li>
            <li className="flex items-start gap-2">
              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded shrink-0">/llms.txt</code>
              <span>— {tr(locale, "Plain-text platform description for LLM crawlers", "纯文本平台描述，供 LLM 爬虫使用")}</span>
            </li>
          </ul>
        </div>

        {/* Troubleshooting */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {tr(locale, "Troubleshooting", "常见问题")}
          </h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {tr(locale, "\"Invalid or missing API key\"", "「无效或缺少 API Key」")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {tr(
                  locale,
                  "Make sure your API key starts with xp_ and is not revoked. Check Settings → API Keys in xPilot.",
                  "确保您的 API Key 以 xp_ 开头且未被撤销。在 xPilot 的 设置 → API Keys 中检查。",
                )}
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Tools not showing in Claude", "Claude 中看不到工具")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {tr(
                  locale,
                  "Restart Claude Desktop after editing the config file. Check that the JSON syntax is valid.",
                  "编辑配置文件后需重启 Claude Desktop。检查 JSON 语法是否正确。",
                )}
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Video task says \"Processing...\"", "视频任务显示「处理中...」")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {tr(
                  locale,
                  "Video generation takes 1-5 minutes. Use the check_task tool with the task ID to poll for completion.",
                  "视频生成需要 1-5 分钟。使用 check_task 工具配合任务 ID 查询完成状态。",
                )}
              </p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Rate limit exceeded", "超出速率限制")}
              </p>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {tr(
                  locale,
                  "The API allows 30 requests per minute per key. Wait a moment and try again.",
                  "API 限制每个 Key 每分钟 30 次请求。请稍等片刻后重试。",
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {tr(locale, "Related Resources", "相关资源")}
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href={locale === "zh" ? "/zh/docs/api" : "/docs/api"}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr(locale, "REST API Documentation →", "REST API 文档 →")}
              </Link>
            </li>
            <li>
              <Link
                href={locale === "zh" ? "/zh/docs/models" : "/docs/models"}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr(locale, "AI Models Documentation →", "AI 模型文档 →")}
              </Link>
            </li>
            <li>
              <a
                href="https://modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr(locale, "MCP Protocol Specification →", "MCP 协议规范 →")}
              </a>
            </li>
            <li>
              <Link
                href={locale === "zh" ? "/zh/changelog" : "/changelog"}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr(locale, "Changelog →", "更新日志 →")}
              </Link>
            </li>
          </ul>
        </div>

      </main>
    </div>
  );
}
