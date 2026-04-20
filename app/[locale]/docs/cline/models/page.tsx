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

interface ModelRow {
  id: string;
  name: string;
  tier: "free" | "fast" | "standard" | "premium";
  note?: { en: string; zh: string };
}

const IMAGE_MODELS: ModelRow[] = [
  { id: "flux-2-pro", name: "FLUX.2 Pro", tier: "free" },
  { id: "flux-2-max", name: "FLUX.2 Max", tier: "free" },
  { id: "flux-2-flex", name: "FLUX.2 Flex", tier: "free" },
  { id: "flux-2-klein-4b", name: "FLUX.2 Klein 4B", tier: "free" },
  { id: "seedream-v4.5", name: "Seedream 4.5", tier: "standard", note: { en: "Best for Chinese prompts", zh: "中文提示词首选" } },
  { id: "dreamina-v3.1/text-to-image", name: "Dreamina 3.1", tier: "premium" },
  { id: "qwen-image/text-to-image", name: "Qwen Image", tier: "standard" },
  { id: "flux-kontext-pro", name: "FLUX Kontext Pro", tier: "premium", note: { en: "Best for image/text editing", zh: "图像与文字编辑首选" } },
];

const VIDEO_MODELS: ModelRow[] = [
  { id: "wan-2.2/t2v-480p-ultra-fast", name: "Wan 2.2 Ultra Fast", tier: "fast", note: { en: "Cheapest · ~5s output", zh: "最便宜 · 约 5 秒出片" } },
  { id: "wan-2.2/t2v-720p", name: "Wan 2.2 720p", tier: "standard" },
  { id: "wan-2.6/text-to-video", name: "Wan 2.6", tier: "standard", note: { en: "Audio supported", zh: "支持音频" } },
  { id: "seedance-v1.5-pro/text-to-video", name: "Seedance 1.5 Pro", tier: "premium", note: { en: "Cinematic + audio", zh: "电影级 + 音频" } },
  { id: "seedance-2.0/text-to-video", name: "Seedance 2.0", tier: "premium", note: { en: "Best: audio + lock camera, 12s", zh: "最强：音频 + 锁定镜头，最长 12s" } },
  { id: "kling-video-o3-std/text-to-video", name: "Kling Video O3", tier: "premium", note: { en: "Best motion quality", zh: "运动质量最佳" } },
];

const TEXT_MODELS: ModelRow[] = [
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", tier: "premium", note: { en: "Best writing quality", zh: "写作质量最佳" } },
  { id: "openai/gpt-5", name: "GPT-5", tier: "premium" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", tier: "fast" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", tier: "premium" },
  { id: "xai/grok-3", name: "Grok 3", tier: "premium", note: { en: "Real-time aware", zh: "实时信息" } },
  { id: "mistral/mistral-small", name: "Mistral Small", tier: "fast" },
];

const TIER_STYLES: Record<ModelRow["tier"], { bg: string; text: string; en: string; zh: string }> = {
  free: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", en: "Free", zh: "免费" },
  fast: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", en: "Fast", zh: "快速" },
  standard: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", en: "Standard", zh: "标准" },
  premium: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", en: "Premium", zh: "高端" },
};

function ModelTable({ rows, locale }: { rows: ModelRow[]; locale: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
              {tr(locale, "Model", "模型")}
            </th>
            <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
              model ID
            </th>
            <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">
              {tr(locale, "Tier", "等级")}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map((m) => {
            const style = TIER_STYLES[m.tier];
            return (
              <tr key={m.id}>
                <td className="px-4 py-2 align-top">
                  <span className="font-medium text-gray-900 dark:text-white">{m.name}</span>
                  {m.note && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {tr(locale, m.note.en, m.note.zh)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 align-top">
                  <code className="text-xs bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 rounded text-gray-800 dark:text-gray-200">
                    {m.id}
                  </code>
                </td>
                <td className="px-4 py-2 align-top">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                    {tr(locale, style.en, style.zh)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ClineModelsDocsPage() {
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {tr(locale, "Calling Models from Cline", "在 Cline 中调用模型")}
            </h1>
            <div className="flex gap-3 items-center">
              <LanguageSwitcher className="text-sm text-gray-700 dark:text-gray-200 hover:underline underline-offset-4 font-medium" />
              <Link
                href={`${prefix}/docs/cline`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← {tr(locale, "Cline Setup", "Cline 设置")}
              </Link>
              <Link
                href={`${prefix}/docs/models`}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                {tr(locale, "All Models →", "所有模型 →")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Intro */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {tr(locale, "Four MCP tools, one server", "四个 MCP 工具，一个服务器")}
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {tr(
              locale,
              "Once xPilot is connected to Cline (see the Cline Setup guide), Cline can call four model-related tools. Pass the model ID in the model argument to pick a specific model — otherwise the default is used.",
              "在 Cline 中连接 xPilot 后（参考 Cline 设置指南），Cline 可调用四个与模型相关的工具。通过 model 参数传入模型 ID 即可指定具体模型，未传则使用默认模型。",
            )}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">
              {tr(locale, "All inference billed at cost · 0% markup", "所有调用按上游成本计费 · 0% 加价")}
            </span>
          </div>
        </div>

        {/* Tool: list_models */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            <code className="text-blue-600 dark:text-blue-400">list_models</code>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {tr(
              locale,
              "Returns every available model grouped by category. Handy for Cline to pick a model it didn't know about.",
              "按类别返回全部可用模型。当 Cline 需要查询新模型时很有用。",
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
            {tr(locale, "Prompt Cline:", "向 Cline 提问：")}
          </p>
          <CodeBlock>{tr(
            locale,
            `Use the xpilot list_models tool and show me the free image models.`,
            `调用 xpilot 的 list_models 工具，列出所有免费的图像模型。`,
          )}</CodeBlock>
        </div>

        {/* Tool: generate_image */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            <code className="text-blue-600 dark:text-blue-400">generate_image</code>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tr(
              locale,
              "Text-to-image generation. Default model is free FLUX.2 Pro.",
              "文本生成图像。默认使用免费的 FLUX.2 Pro。",
            )}
          </p>

          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {tr(locale, "Arguments", "参数")}
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">prompt</code> — {tr(locale, "required · text description", "必填 · 文本描述")}</li>
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">model</code> — {tr(locale, "optional · see table below", "可选 · 见下表")}</li>
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">aspectRatio</code> — {tr(locale, `optional · "1:1", "16:9", "9:16"`, `可选 · "1:1"、"16:9"、"9:16"`)}</li>
          </ul>

          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {tr(locale, "Available image models", "可用图像模型")}
          </h4>
          <div className="mb-4">
            <ModelTable rows={IMAGE_MODELS} locale={locale} />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
            {tr(locale, "Prompt Cline:", "向 Cline 提问：")}
          </p>
          <CodeBlock>{tr(
            locale,
            `Generate a 16:9 image of a neon-lit Tokyo alley at night using seedream-v4.5 via xpilot.`,
            `用 xpilot 的 seedream-v4.5 生成一张 16:9 的东京霓虹夜景图。`,
          )}</CodeBlock>
        </div>

        {/* Tool: generate_video */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            <code className="text-blue-600 dark:text-blue-400">generate_video</code>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tr(
              locale,
              "Text-to-video or image-to-video. Returns a task ID — check status with check_task. Default model is wan-2.2/t2v-480p-ultra-fast (cheapest).",
              "文本或图像生成视频。返回任务 ID，用 check_task 查询状态。默认 wan-2.2/t2v-480p-ultra-fast（最便宜）。",
            )}
          </p>

          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {tr(locale, "Arguments", "参数")}
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">prompt</code> — {tr(locale, "required · text description", "必填 · 文本描述")}</li>
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">model</code> — {tr(locale, "optional · see table below", "可选 · 见下表")}</li>
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">duration</code> — {tr(locale, "optional · 5 or 8 seconds (default 5)", "可选 · 5 或 8 秒（默认 5）")}</li>
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">imageUrl</code> — {tr(locale, "optional · switches to image-to-video mode", "可选 · 切换为图像转视频模式")}</li>
          </ul>

          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {tr(locale, "Available video models", "可用视频模型")}
          </h4>
          <div className="mb-4">
            <ModelTable rows={VIDEO_MODELS} locale={locale} />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
            {tr(locale, "Prompt Cline:", "向 Cline 提问：")}
          </p>
          <CodeBlock>{tr(
            locale,
            `Use xpilot seedance-2.0 to generate an 8-second video of a dragon flying through clouds with audio.`,
            `用 xpilot 的 seedance-2.0 生成一段 8 秒的巨龙穿云视频，带音频。`,
          )}</CodeBlock>
        </div>

        {/* Tool: generate_post */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            <code className="text-blue-600 dark:text-blue-400">generate_post</code>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tr(
              locale,
              "AI-written X (Twitter) post, ≤280 chars with hashtags. Defaults to a free text model.",
              "AI 撰写的 X (Twitter) 推文，≤280 字符，带话题标签。默认使用免费文本模型。",
            )}
          </p>

          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {tr(locale, "Arguments", "参数")}
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">prompt</code> — {tr(locale, "required · topic or instructions", "必填 · 主题或说明")}</li>
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">language</code> — {tr(locale, `optional · "en", "zh", "es", "ja", "ko" (default "en")`, `可选 · "en"、"zh"、"es"、"ja"、"ko"（默认 "en"）`)}</li>
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">model</code> — {tr(locale, "optional · see text model table below", "可选 · 见下方文本模型表")}</li>
          </ul>

          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            {tr(locale, "Available text models", "可用文本模型")}
          </h4>
          <div className="mb-4">
            <ModelTable rows={TEXT_MODELS} locale={locale} />
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
            {tr(locale, "Prompt Cline:", "向 Cline 提问：")}
          </p>
          <CodeBlock>{tr(
            locale,
            `Call xpilot generate_post with model anthropic/claude-sonnet-4 to write a Chinese tweet announcing our new video editor.`,
            `调用 xpilot 的 generate_post（model=anthropic/claude-sonnet-4），写一条中文推文宣布新的视频编辑器。`,
          )}</CodeBlock>
        </div>

        {/* Tool: check_task */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            <code className="text-blue-600 dark:text-blue-400">check_task</code>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tr(
              locale,
              "Poll the status of a video or image task. Returns status, output URL, or error.",
              "查询视频/图像任务状态。返回状态、输出地址或错误信息。",
            )}
          </p>

          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {tr(locale, "Arguments", "参数")}
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">taskId</code> — {tr(locale, "required · returned from generate_video / generate_image", "必填 · 由 generate_video / generate_image 返回")}</li>
            <li><code className="text-xs bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">type</code> — {tr(locale, `optional · "video" or "image" (default "video")`, `可选 · "video" 或 "image"（默认 "video"）`)}</li>
          </ul>

          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
            {tr(locale, "Prompt Cline:", "向 Cline 提问：")}
          </p>
          <CodeBlock>{tr(
            locale,
            `Check xpilot video task abc123 and tell me when it's done.`,
            `检查 xpilot 视频任务 abc123 的状态，完成后告诉我。`,
          )}</CodeBlock>
        </div>

        {/* End-to-end example */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {tr(locale, "End-to-end workflow", "端到端工作流示例")}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tr(
              locale,
              "A single Cline prompt that chains multiple tools:",
              "一条 Cline 指令串起多个工具：",
            )}
          </p>
          <CodeBlock>{tr(
            locale,
            `Using xpilot: generate a cinematic 8-second video with seedance-2.0 of a rainy neon Tokyo street. Poll check_task every 15 seconds until it's done. When ready, write a Chinese tweet about it with claude-sonnet-4 and save both the video URL and the tweet text to a file.`,
            `使用 xpilot：用 seedance-2.0 生成一段 8 秒电影感的雨夜东京霓虹街景视频。每 15 秒调用 check_task 轮询，直到完成。完成后用 claude-sonnet-4 写一条中文推文，并把视频地址与推文保存到一个文件。`,
          )}</CodeBlock>
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
              {tr(locale, "All 49+ models with pricing and capabilities.", "全部 49+ 模型，含定价与能力说明。")}
            </p>
          </Link>
          <Link
            href={`${prefix}/docs/mcp`}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
          >
            <p className="font-semibold text-gray-900 dark:text-white">
              {tr(locale, "MCP Reference", "MCP 参考")}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {tr(locale, "Protocol details for any MCP client.", "MCP 协议与工具完整说明。")}
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
