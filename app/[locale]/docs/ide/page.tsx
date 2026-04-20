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

export default function IdeDocsPage() {
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {tr(locale, "Use xPilot LLMs in Your IDE", "在 IDE 中使用 xPilot 大模型")}
            </h1>
            <div className="flex gap-3 items-center">
              <LanguageSwitcher className="text-sm text-gray-700 dark:text-gray-200 hover:underline underline-offset-4 font-medium" />
              <Link
                href={`${prefix}/docs`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← {tr(locale, "All Docs", "所有文档")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Intro */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {tr(locale, "One API key, every AI IDE", "一个密钥，所有 AI 编辑器")}
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {tr(
              locale,
              "xPilot exposes an OpenAI-compatible /v1/chat/completions endpoint. Point any AI IDE that supports a custom OpenAI base URL at xPilot, and use Claude, GPT, Gemini, Grok, and more through a single billing account.",
              "xPilot 提供兼容 OpenAI 的 /v1/chat/completions 接口。只要 IDE 支持自定义 OpenAI Base URL，就可以通过一个 xPilot 账号使用 Claude、GPT、Gemini、Grok 等所有模型。",
            )}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">
              {tr(locale, "Billed at upstream cost · 0% markup", "按上游成本计费 · 0% 加价")}
            </span>
          </div>
        </div>

        {/* Universal config */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {tr(locale, "The three values you'll need", "你需要的三个参数")}
          </h3>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <p className="font-medium text-gray-900 dark:text-white">Base URL</p>
              <code className="block mt-1 text-xs text-blue-600 dark:text-blue-400 break-all">
                https://xpilot.jytech.us/api/v1
              </code>
            </div>
            <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <p className="font-medium text-gray-900 dark:text-white">API Key</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {tr(
                  locale,
                  "Starts with xp_. Create one in Settings → API Keys.",
                  "以 xp_ 开头。在 设置 → API Keys 创建。",
                )}
              </p>
              <Link
                href={`${prefix}/settings/api-keys`}
                className="mt-2 inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr(locale, "Open Settings →", "打开设置 →")}
              </Link>
            </div>
            <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3">
              <p className="font-medium text-gray-900 dark:text-white">Model ID</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {tr(
                  locale,
                  "e.g. anthropic/claude-sonnet-4, openai/gpt-5, google/gemini-2.5-pro.",
                  "例如 anthropic/claude-sonnet-4、openai/gpt-5、google/gemini-2.5-pro。",
                )}
              </p>
              <Link
                href={`${prefix}/docs/models`}
                className="mt-2 inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr(locale, "See full catalog →", "查看完整目录 →")}
              </Link>
            </div>
          </div>
        </div>

        {/* Cline */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" id="cline">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Cline (VS Code)
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {tr(locale, "Provider: OpenAI Compatible", "服务商：OpenAI Compatible")}
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <li>
              {tr(
                locale,
                "Open the Cline sidebar, click the settings (gear) icon.",
                "打开 Cline 侧边栏，点击设置（齿轮）图标。",
              )}
            </li>
            <li>
              {tr(
                locale,
                'Under API Provider, select "OpenAI Compatible".',
                '在 API Provider 中选择 "OpenAI Compatible"。',
              )}
            </li>
            <li>
              {tr(
                locale,
                "Fill in the following fields:",
                "填写以下字段：",
              )}
            </li>
          </ol>
          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300 mb-4">
            <li><strong>Base URL:</strong> <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">https://xpilot.jytech.us/api/v1</code></li>
            <li><strong>API Key:</strong> <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">xp_...</code></li>
            <li><strong>Model ID:</strong> <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded">anthropic/claude-sonnet-4</code></li>
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {tr(
              locale,
              "Cline will stream responses and call the model for every edit/chat task.",
              "Cline 会流式输出，并对每一次编辑/对话调用该模型。",
            )}
          </p>
        </div>

        {/* Cursor */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" id="cursor">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Cursor
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {tr(locale, "Settings → Models → OpenAI API Key (Custom)", "设置 → Models → OpenAI API Key（自定义）")}
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <li>
              {tr(
                locale,
                "Open Cursor Settings (Cmd/Ctrl + ,) → Models.",
                "打开 Cursor 设置（Cmd/Ctrl + ,）→ Models。",
              )}
            </li>
            <li>
              {tr(
                locale,
                'Scroll to "OpenAI API Key" and click "Override OpenAI Base URL".',
                '滚动到 "OpenAI API Key"，点击 "Override OpenAI Base URL"。',
              )}
            </li>
            <li>
              {tr(
                locale,
                "Enter the Base URL and paste your xPilot API key. Click Verify.",
                "填入 Base URL 和你的 xPilot 密钥，点击 Verify。",
              )}
            </li>
            <li>
              {tr(
                locale,
                "Add a custom model name (e.g. anthropic/claude-sonnet-4) and enable it.",
                "添加自定义模型名（如 anthropic/claude-sonnet-4）并启用。",
              )}
            </li>
          </ol>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {tr(
              locale,
              "Note: Cursor disables its own Copilot++ / Tab completion when you override the base URL — only Chat & Cmd+K will use xPilot.",
              "注意：覆盖 Base URL 后，Cursor 的 Copilot++ 与 Tab 补全会关闭，只有 Chat 和 Cmd+K 使用 xPilot。",
            )}
          </p>
        </div>

        {/* Continue.dev */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" id="continue">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Continue.dev
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {tr(locale, "Edit ~/.continue/config.yaml", "编辑 ~/.continue/config.yaml")}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {tr(
              locale,
              "Add an openai-compatible provider entry:",
              "添加一个 openai-compatible 服务商配置：",
            )}
          </p>
          <CodeBlock lang="yaml">{`models:
  - name: xPilot Claude Sonnet 4
    provider: openai
    model: anthropic/claude-sonnet-4
    apiBase: https://xpilot.jytech.us/api/v1
    apiKey: xp_your_api_key_here
    roles:
      - chat
      - edit

  - name: xPilot GPT-5
    provider: openai
    model: openai/gpt-5
    apiBase: https://xpilot.jytech.us/api/v1
    apiKey: xp_your_api_key_here
    roles:
      - chat`}</CodeBlock>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
            {tr(
              locale,
              "Reload VS Code or Continue to pick up the changes. Pick the model from the Continue model dropdown.",
              "重载 VS Code 或 Continue 使配置生效，然后在 Continue 的模型下拉框中选择。",
            )}
          </p>
        </div>

        {/* Zed */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6" id="zed">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Zed
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {tr(locale, "Edit ~/.config/zed/settings.json", "编辑 ~/.config/zed/settings.json")}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {tr(
              locale,
              "Add xPilot as an OpenAI-compatible provider:",
              "把 xPilot 添加为 OpenAI 兼容服务商：",
            )}
          </p>
          <CodeBlock lang="json">{`{
  "language_models": {
    "openai_compatible": {
      "xpilot": {
        "api_url": "https://xpilot.jytech.us/api/v1",
        "available_models": [
          {
            "name": "anthropic/claude-sonnet-4",
            "display_name": "xPilot · Claude Sonnet 4",
            "max_tokens": 200000
          },
          {
            "name": "openai/gpt-5",
            "display_name": "xPilot · GPT-5",
            "max_tokens": 128000
          }
        ]
      }
    }
  },
  "agent": {
    "default_model": {
      "provider": "xpilot",
      "model": "anthropic/claude-sonnet-4"
    }
  }
}`}</CodeBlock>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">
            {tr(
              locale,
              "Then run the command `assistant: configure` and paste your xp_ key when prompted.",
              "然后在命令面板执行 `assistant: configure`，按提示粘贴你的 xp_ 密钥。",
            )}
          </p>
        </div>

        {/* Curl test */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {tr(locale, "Quick curl test", "快速 curl 测试")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {tr(
              locale,
              "Verify your key works before configuring any IDE:",
              "在配置 IDE 前，先用 curl 验证密钥是否可用：",
            )}
          </p>
          <CodeBlock lang="bash">{`curl https://xpilot.jytech.us/api/v1/chat/completions \\
  -H "Authorization: Bearer xp_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "anthropic/claude-sonnet-4",
    "messages": [{"role": "user", "content": "Say hi in one sentence."}],
    "max_tokens": 50
  }'`}</CodeBlock>
        </div>

        {/* Free models */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {tr(locale, "Free model IDs", "免费模型 ID")}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {tr(
              locale,
              "No credits consumed · rate-limited upstream.",
              "不消耗点数 · 上游有速率限制。",
            )}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tr(
              locale,
              "Drop any of these IDs into your IDE's model field. They run on open-source models hosted by OpenRouter — at zero cost to you.",
              "在 IDE 的 Model 字段填入以下任一 ID 即可。这些是 OpenRouter 托管的开源模型，完全免费。",
            )}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            {[
              { id: "openrouter/openai/gpt-oss-120b:free", label: "GPT-OSS 120B · OpenAI" },
              { id: "openrouter/openai/gpt-oss-20b:free", label: "GPT-OSS 20B · OpenAI" },
              { id: "openrouter/meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B · Meta" },
              { id: "openrouter/google/gemma-3-27b-it:free", label: "Gemma 3 27B · Google" },
              { id: "openrouter/qwen/qwen3-coder:free", label: "Qwen3 Coder · Alibaba" },
              { id: "openrouter/qwen/qwen3-next-80b-a3b-instruct:free", label: "Qwen3 Next 80B · Alibaba" },
              { id: "openrouter/nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super · NVIDIA" },
              { id: "openrouter/z-ai/glm-4.5-air:free", label: "GLM 4.5 Air · Z.AI" },
              { id: "openrouter/nousresearch/hermes-3-llama-3.1-405b:free", label: "Hermes 3 405B · Nous Research" },
            ].map((m) => (
              <div
                key={m.id}
                className="rounded-md border border-gray-200 dark:border-gray-700 p-2.5"
              >
                <p className="font-medium text-gray-900 dark:text-white text-xs">
                  {m.label}
                </p>
                <code className="mt-1 block text-[11px] text-blue-600 dark:text-blue-400 break-all">
                  {m.id}
                </code>
              </div>
            ))}
          </div>
        </div>

        {/* Supported features */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {tr(locale, "Supported features", "支持的能力")}
          </h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>{tr(locale, "Streaming (stream: true) — SSE chunks", "流式输出（stream: true）— SSE 分块")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>{tr(locale, "Standard chat messages (system / user / assistant)", "标准聊天消息（system / user / assistant）")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>{tr(locale, "Per-request usage reporting (prompt / completion tokens)", "每次请求返回 token 消耗")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>{tr(locale, "All text models — Claude, GPT, Gemini, Grok, Mistral", "全部文本模型 — Claude、GPT、Gemini、Grok、Mistral")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 mt-0.5">○</span>
              <span>{tr(locale, "Tool/function calling — planned, not yet supported", "工具/函数调用 — 计划中，暂未支持")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 mt-0.5">○</span>
              <span>{tr(locale, "Vision/image input — planned, not yet supported", "视觉/图像输入 — 计划中，暂未支持")}</span>
            </li>
          </ul>
        </div>

        {/* Rate limits */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {tr(locale, "Rate limits & credits", "速率限制与点数")}
          </h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li>• {tr(locale, "30 requests per minute per API key (sliding window)", "每个 API Key 每分钟 30 次请求（滑动窗口）")}</li>
            <li>• {tr(locale, "429 response includes Retry-After header", "429 响应包含 Retry-After 头")}</li>
            <li>• {tr(locale, "402 Insufficient Credits — top up on the Pricing page", "402 点数不足 — 在定价页面充值")}</li>
            <li>• {tr(locale, "Usage is tracked and visible in Settings → Usage", "调用量在 设置 → 用量 中可见")}</li>
          </ul>
        </div>

        {/* Related */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href={`${prefix}/docs/models`}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <p className="font-semibold text-gray-900 dark:text-white">
              {tr(locale, "Full Model Catalog", "完整模型目录")}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {tr(locale, "All text model IDs and pricing.", "所有文本模型 ID 与定价。")}
            </p>
          </Link>
          <Link
            href={`${prefix}/docs/api`}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <p className="font-semibold text-gray-900 dark:text-white">
              {tr(locale, "REST API Reference", "REST API 参考")}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {tr(locale, "Full xPilot API — text, image, video, scheduling.", "完整 xPilot API — 文本、图像、视频、调度。")}
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
