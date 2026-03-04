"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function Endpoint({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
            method === "GET"
              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
          }`}
        >
          {method}
        </span>
        <code className="text-sm font-semibold text-gray-900 dark:text-white">
          {path}
        </code>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function ParamTable({
  params,
}: {
  params: {
    name: string;
    type: string;
    required: boolean;
    desc: string;
  }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
            <th className="py-2 pr-3 font-semibold text-gray-900 dark:text-white">
              Parameter
            </th>
            <th className="py-2 pr-3 font-semibold text-gray-900 dark:text-white">
              Type
            </th>
            <th className="py-2 pr-3 font-semibold text-gray-900 dark:text-white">
              Required
            </th>
            <th className="py-2 font-semibold text-gray-900 dark:text-white">
              Description
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {params.map((p) => (
            <tr key={p.name}>
              <td className="py-2 pr-3">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-900 dark:text-white">
                  {p.name}
                </code>
              </td>
              <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                {p.type}
              </td>
              <td className="py-2 pr-3">
                {p.required ? (
                  <span className="text-red-600 dark:text-red-400 text-xs font-medium">
                    Required
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs">Optional</span>
                )}
              </td>
              <td className="py-2 text-gray-600 dark:text-gray-400">
                {p.desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ApiDocsPage() {
  const locale = useLocale();
  const BASE = "https://xpilot.jytech.us";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {tr(locale, "xPilot API Documentation", "xPilot API 文档")}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {tr(locale, "v1 REST API Reference", "v1 REST API 参考")}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/${locale}/docs/models`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr(locale, "Models", "模型文档")}
              </Link>
              <Link
                href={`/${locale}/settings/api-keys`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {tr(locale, "Get API Key", "获取 API Key")}
              </Link>
              <Link
                href={`/${locale}`}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {tr(locale, "Home", "首页")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Overview */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Overview", "概述")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {tr(
              locale,
              "The xPilot v1 API provides programmatic access to AI-powered video, image, and text generation. All endpoints require a valid API key and use credit-based billing.",
              "xPilot v1 API 提供视频、图片、文字生成的编程接口。所有端点需要有效的 API Key，采用 credit 计费。",
            )}
          </p>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                Base URL:
              </span>
              <code className="text-blue-600 dark:text-blue-400">
                {BASE}/api/v1
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Auth:", "认证：")}
              </span>
              <code className="text-gray-600 dark:text-gray-400">
                Authorization: Bearer xp_...
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Rate Limit:", "频率限制：")}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                30 {tr(locale, "requests / minute per API key", "请求/分钟 (每个 API Key)")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white">
                {tr(locale, "Format:", "格式：")}
              </span>
              <span className="text-gray-600 dark:text-gray-400">JSON</span>
            </div>
          </div>
        </section>

        {/* Authentication */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Authentication", "认证")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {tr(
              locale,
              "Create an API key from Settings > API Keys. Include it in the Authorization header of every request:",
              "在 设置 > API 密钥 中创建 API Key，在每个请求的 Authorization header 中携带：",
            )}
          </p>
          <CodeBlock lang="bash">{`curl -H "Authorization: Bearer xp_your_api_key_here" \\
  ${BASE}/api/v1/models`}</CodeBlock>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
            {tr(
              locale,
              "Keep your API key secret. Do not expose it in client-side code or public repositories.",
              "请妥善保管 API Key，不要在前端代码或公开仓库中暴露。",
            )}
          </div>
        </section>

        {/* ─────────── Models ─────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "List Models", "获取模型列表")}
          </h2>
          <Endpoint method="GET" path="/api/v1/models">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tr(
                locale,
                "Returns all available models grouped by type (text, video, image) with pricing information.",
                "返回所有可用模型，按类型（text, video, image）分组，包含定价信息。",
              )}
            </p>
            <CodeBlock lang="bash">{`curl -H "Authorization: Bearer xp_..." \\
  ${BASE}/api/v1/models`}</CodeBlock>
            <p className="text-xs font-semibold text-gray-900 dark:text-white mt-2">
              {tr(locale, "Response:", "响应：")}
            </p>
            <CodeBlock lang="json">{`{
  "models": {
    "text": [
      { "id": "openai/gpt-4o", "label": "GPT-4o", "type": "text" }
    ],
    "video": [
      {
        "id": "seedance-2.0/text-to-video",
        "label": "Seedance 2.0",
        "tier": "premium",
        "supports_audio": true,
        "supports_lock_camera": true,
        "durations": [4, 8, 12],
        "cost_cents_per_5s": 300,
        "type": "video",
        "mode": "text-to-video",
        "provider": "seedance"
      }
    ],
    "image": [
      { "id": "bytedance/seedream-4.5", "label": "Seedream 4.5", "type": "image" }
    ]
  }
}`}</CodeBlock>
          </Endpoint>
        </section>

        {/* ─────────── Video Generate ─────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Generate Video", "生成视频")}
          </h2>
          <Endpoint method="POST" path="/api/v1/video/generate">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tr(
                locale,
                "Submit an async video generation task. Poll the returned poll_url for progress.",
                "提交异步视频生成任务。使用返回的 poll_url 轮询进度。",
              )}
            </p>
            <ParamTable
              params={[
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: tr(
                    locale,
                    'Model ID (e.g. "seedance-2.0/text-to-video")',
                    '模型 ID（如 "seedance-2.0/text-to-video"）',
                  ),
                },
                {
                  name: "prompt",
                  type: "string",
                  required: true,
                  desc: tr(locale, "Description of the video to generate", "视频描述"),
                },
                {
                  name: "duration",
                  type: "number",
                  required: false,
                  desc: tr(locale, "Duration in seconds (default 5, Seedance supports 4/8/12)", "时长秒数（默认 5，Seedance 支持 4/8/12）"),
                },
                {
                  name: "aspect_ratio",
                  type: "string",
                  required: false,
                  desc: tr(locale, '"16:9", "9:16", "1:1" etc. (default "16:9")', '"16:9"、"9:16"、"1:1" 等（默认 "16:9"）'),
                },
                {
                  name: "image_url",
                  type: "string",
                  required: false,
                  desc: tr(locale, "Source image URL for image-to-video models", "图片 URL，用于图片转视频模型"),
                },
                {
                  name: "generate_audio",
                  type: "boolean",
                  required: false,
                  desc: tr(locale, "Generate synchronized audio (Seedance 2.0, Wan 2.6)", "生成同步音频（Seedance 2.0, Wan 2.6）"),
                },
                {
                  name: "lock_camera",
                  type: "boolean",
                  required: false,
                  desc: tr(locale, "Lock camera position (Seedance 2.0 only)", "锁定镜头（仅 Seedance 2.0）"),
                },
              ]}
            />
            <p className="text-xs font-semibold text-gray-900 dark:text-white mt-2">
              {tr(locale, "Example:", "示例：")}
            </p>
            <CodeBlock lang="bash">{`curl -X POST ${BASE}/api/v1/video/generate \\
  -H "Authorization: Bearer xp_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "seedance-2.0/text-to-video",
    "prompt": "A cat walking on a beach at sunset",
    "duration": 8,
    "aspect_ratio": "16:9",
    "generate_audio": true,
    "lock_camera": false
  }'`}</CodeBlock>
            <p className="text-xs font-semibold text-gray-900 dark:text-white mt-2">
              {tr(locale, "Response:", "响应：")}
            </p>
            <CodeBlock lang="json">{`{
  "task_id": "abc123",
  "status": "processing",
  "provider": "seedance",
  "poll_url": "/api/v1/video/abc123?provider=seedance",
  "cost_cents": 300,
  "remaining_credits_cents": 4700
}`}</CodeBlock>
          </Endpoint>
        </section>

        {/* ─────────── Video Poll ─────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Poll Video Status", "查询视频状态")}
          </h2>
          <Endpoint method="GET" path="/api/v1/video/:taskId">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tr(
                locale,
                "Check the status of a video generation task. Use the poll_url returned from the generate endpoint. Poll every 3-5 seconds until status is \"completed\" or \"failed\".",
                "查询视频生成状态。使用 generate 端点返回的 poll_url，每 3-5 秒轮询一次，直到 status 为 \"completed\" 或 \"failed\"。",
              )}
            </p>
            <ParamTable
              params={[
                {
                  name: "provider",
                  type: "string",
                  required: false,
                  desc: tr(locale, '"wavespeed" or "seedance" (query param, default "wavespeed")', '"wavespeed" 或 "seedance"（查询参数，默认 "wavespeed"）'),
                },
                {
                  name: "pollUrl",
                  type: "string",
                  required: false,
                  desc: tr(locale, "Wavespeed poll URL (query param, auto-included in poll_url)", "Wavespeed 轮询 URL（查询参数，已包含在 poll_url 中）"),
                },
              ]}
            />
            <CodeBlock lang="bash">{`# Use the poll_url from the generate response
curl -H "Authorization: Bearer xp_..." \\
  "${BASE}/api/v1/video/abc123?provider=seedance"`}</CodeBlock>
            <p className="text-xs font-semibold text-gray-900 dark:text-white mt-2">
              {tr(locale, "Response (processing):", "响应（处理中）：")}
            </p>
            <CodeBlock lang="json">{`{
  "task_id": "abc123",
  "status": "processing",
  "outputs": [],
  "provider": "seedance"
}`}</CodeBlock>
            <p className="text-xs font-semibold text-gray-900 dark:text-white mt-2">
              {tr(locale, "Response (completed):", "响应（已完成）：")}
            </p>
            <CodeBlock lang="json">{`{
  "task_id": "abc123",
  "status": "completed",
  "outputs": ["https://cdn.example.com/video.mp4"],
  "provider": "seedance"
}`}</CodeBlock>
          </Endpoint>
        </section>

        {/* ─────────── Image Generate ─────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Generate Image", "生成图片")}
          </h2>
          <Endpoint method="POST" path="/api/v1/image/generate">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tr(
                locale,
                "Generate an image. Some models return results synchronously; others return a poll_url.",
                "生成图片。部分模型同步返回结果，其余返回 poll_url 需轮询。",
              )}
            </p>
            <ParamTable
              params={[
                {
                  name: "model",
                  type: "string",
                  required: true,
                  desc: tr(locale, 'Model ID (e.g. "bytedance/seedream-4.5")', '模型 ID（如 "bytedance/seedream-4.5"）'),
                },
                {
                  name: "prompt",
                  type: "string",
                  required: true,
                  desc: tr(locale, "Image description", "图片描述"),
                },
                {
                  name: "aspect_ratio",
                  type: "string",
                  required: false,
                  desc: tr(locale, '"1:1", "16:9", "9:16" etc.', '"1:1"、"16:9"、"9:16" 等'),
                },
                {
                  name: "mode",
                  type: "string",
                  required: false,
                  desc: tr(locale, '"t2i" (text-to-image), "i2i" (image-to-image), "i2i_text" (edit text in image)', '"t2i"（文生图）、"i2i"（图生图）、"i2i_text"（图片文字编辑）'),
                },
                {
                  name: "image_url",
                  type: "string",
                  required: false,
                  desc: tr(locale, "Source image for i2i/editing modes", "图片 URL，用于 i2i/编辑模式"),
                },
                {
                  name: "image_urls",
                  type: "string[]",
                  required: false,
                  desc: tr(locale, "Multiple source images (multi-reference models)", "多张参考图 URL"),
                },
              ]}
            />
            <CodeBlock lang="bash">{`curl -X POST ${BASE}/api/v1/image/generate \\
  -H "Authorization: Bearer xp_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "bytedance/seedream-4.5",
    "prompt": "A futuristic cityscape at dawn",
    "aspect_ratio": "16:9"
  }'`}</CodeBlock>
            <p className="text-xs font-semibold text-gray-900 dark:text-white mt-2">
              {tr(locale, "Response (sync):", "响应（同步）：")}
            </p>
            <CodeBlock lang="json">{`{
  "task_id": "img_456",
  "status": "completed",
  "outputs": ["https://cdn.example.com/image.png"],
  "cost_cents": 5,
  "remaining_credits_cents": 4695
}`}</CodeBlock>
          </Endpoint>
        </section>

        {/* ─────────── Text Generate ─────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Generate Text", "生成文字")}
          </h2>
          <Endpoint method="POST" path="/api/v1/text/generate">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tr(
                locale,
                "Generate text using a large language model. Returns result synchronously.",
                "使用大语言模型生成文字，同步返回结果。",
              )}
            </p>
            <ParamTable
              params={[
                {
                  name: "model",
                  type: "string",
                  required: false,
                  desc: tr(locale, 'Model ID (default "openai/gpt-4o")', '模型 ID（默认 "openai/gpt-4o"）'),
                },
                {
                  name: "prompt",
                  type: "string",
                  required: true,
                  desc: tr(locale, "The prompt / question", "提示词 / 问题"),
                },
                {
                  name: "system",
                  type: "string",
                  required: false,
                  desc: tr(locale, "System prompt to set behavior", "系统提示词"),
                },
                {
                  name: "max_tokens",
                  type: "number",
                  required: false,
                  desc: tr(locale, "Max output tokens (default 1000)", "最大输出 token 数（默认 1000）"),
                },
                {
                  name: "temperature",
                  type: "number",
                  required: false,
                  desc: tr(locale, "Sampling temperature 0-2 (default 0.7)", "采样温度 0-2（默认 0.7）"),
                },
              ]}
            />
            <CodeBlock lang="bash">{`curl -X POST ${BASE}/api/v1/text/generate \\
  -H "Authorization: Bearer xp_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o",
    "prompt": "Write a tweet about AI video generation",
    "max_tokens": 280
  }'`}</CodeBlock>
            <p className="text-xs font-semibold text-gray-900 dark:text-white mt-2">
              {tr(locale, "Response:", "响应：")}
            </p>
            <CodeBlock lang="json">{`{
  "content": "AI video generation just hit a new level...",
  "model": "openai/gpt-4o",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 42,
    "total_tokens": 57
  },
  "cost_cents": 1,
  "remaining_credits_cents": 4694
}`}</CodeBlock>
          </Endpoint>
        </section>

        {/* ─────────── Error Handling ─────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Error Handling", "错误处理")}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {tr(
              locale,
              "All errors return a JSON object with an error field:",
              "所有错误返回包含 error 字段的 JSON 对象：",
            )}
          </p>
          <CodeBlock lang="json">{`{
  "error": {
    "message": "Invalid or missing API key",
    "code": "UNAUTHORIZED"
  }
}`}</CodeBlock>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                  <th className="py-2 pr-3 font-semibold text-gray-900 dark:text-white">
                    HTTP
                  </th>
                  <th className="py-2 pr-3 font-semibold text-gray-900 dark:text-white">
                    Code
                  </th>
                  <th className="py-2 font-semibold text-gray-900 dark:text-white">
                    {tr(locale, "Description", "说明")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-600 dark:text-gray-400">
                <tr>
                  <td className="py-2 pr-3 font-mono">400</td>
                  <td className="py-2 pr-3">
                    <code className="text-xs">INVALID_PARAMS</code>
                  </td>
                  <td className="py-2">
                    {tr(locale, "Missing or invalid request parameters", "缺少或无效的请求参数")}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-mono">400</td>
                  <td className="py-2 pr-3">
                    <code className="text-xs">INVALID_MODEL</code>
                  </td>
                  <td className="py-2">
                    {tr(locale, "Model ID not found", "模型 ID 不存在")}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-mono">401</td>
                  <td className="py-2 pr-3">
                    <code className="text-xs">UNAUTHORIZED</code>
                  </td>
                  <td className="py-2">
                    {tr(locale, "Missing, invalid, or revoked API key", "缺少、无效或已撤销的 API Key")}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-mono">402</td>
                  <td className="py-2 pr-3">
                    <code className="text-xs">INSUFFICIENT_CREDITS</code>
                  </td>
                  <td className="py-2">
                    {tr(locale, "Not enough credits for this operation", "余额不足")}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-mono">429</td>
                  <td className="py-2 pr-3">
                    <code className="text-xs">RATE_LIMITED</code>
                  </td>
                  <td className="py-2">
                    {tr(locale, "Rate limit exceeded (30 req/min). Check Retry-After header.", "超过频率限制（30 请求/分钟），参考 Retry-After header")}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-mono">500</td>
                  <td className="py-2 pr-3">
                    <code className="text-xs">GENERATION_FAILED</code>
                  </td>
                  <td className="py-2">
                    {tr(locale, "Generation failed upstream", "上游生成失败")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ─────────── Full Example ─────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Full Example: Generate & Download Video", "完整示例：生成并下载视频")}
          </h2>
          <CodeBlock lang="bash">{`#!/bin/bash
API_KEY="xp_your_key_here"
HOST="https://xpilot.jytech.us"

# 1. Submit video generation
RESULT=$(curl -s -X POST "$HOST/api/v1/video/generate" \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "seedance-2.0/text-to-video",
    "prompt": "A golden retriever running through a meadow",
    "duration": 8,
    "generate_audio": true
  }')

POLL_PATH=$(echo $RESULT | jq -r '.poll_url')
echo "Task submitted. Poll path: $POLL_PATH"

# 2. Poll until complete
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $API_KEY" "$HOST$POLL_PATH")
  STATE=$(echo $STATUS | jq -r '.status')
  echo "Status: $STATE"

  if [ "$STATE" = "completed" ]; then
    VIDEO_URL=$(echo $STATUS | jq -r '.outputs[0]')
    echo "Video ready: $VIDEO_URL"
    curl -o output.mp4 "$VIDEO_URL"
    break
  elif [ "$STATE" = "failed" ]; then
    echo "Error: $(echo $STATUS | jq -r '.error')"
    break
  fi

  sleep 5
done`}</CodeBlock>
        </section>

        {/* ─────────── Python Example ─────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr(locale, "Python Example", "Python 示例")}
          </h2>
          <CodeBlock lang="python">{`import requests, time

API_KEY = "xp_your_key_here"
HOST = "https://xpilot.jytech.us"
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# Submit
resp = requests.post(f"{HOST}/api/v1/video/generate", headers=HEADERS, json={
    "model": "seedance-2.0/text-to-video",
    "prompt": "A cat walking on a beach at sunset",
    "duration": 8,
    "generate_audio": True,
})
data = resp.json()
poll_path = data["poll_url"]
print(f"Cost: {data['cost_cents']} cents | Credits left: {data['remaining_credits_cents']}")

# Poll
while True:
    status = requests.get(f"{HOST}{poll_path}", headers=HEADERS).json()
    print(f"Status: {status['status']}")
    if status["status"] == "completed":
        print(f"Video URL: {status['outputs'][0]}")
        break
    elif status["status"] == "failed":
        print(f"Error: {status.get('error')}")
        break
    time.sleep(5)`}</CodeBlock>
        </section>

        {/* CTA */}
        <section className="text-center py-4 space-x-4">
          <Link
            href={`/${locale}/settings/api-keys`}
            className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {tr(locale, "Create API Key", "创建 API Key")}
          </Link>
          <Link
            href={`/${locale}/docs/models`}
            className="inline-flex items-center px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {tr(locale, "View All Models", "查看所有模型")}
          </Link>
        </section>
      </main>
    </div>
  );
}
