import type { Metadata } from "next";
import Link from "next/link";
import { use } from "react";

export const metadata: Metadata = {
  title: "About | xPilot",
  description:
    "xPilot - AI Native fully automated marketing platform. We select the best AI models for the right tasks, so you don't have to.",
};

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }];
}

export default function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const isZh = locale === "zh";

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Header */}
        <Link
          href={isZh ? "/zh" : "/"}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-8 inline-block text-sm font-medium transition"
        >
          &larr; {isZh ? "返回首页" : "Back to Home"}
        </Link>

        {/* Hero Section */}
        <div className="mb-16 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
            {isZh ? "关于 xPilot" : "About xPilot"}
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {isZh
              ? "AI Native 全自动化营销平台"
              : "AI Native Fully Automated Marketing"}
          </p>
        </div>

        {/* Mission */}
        <section className="mb-16">
          <div className="border-l-4 border-blue-500 pl-6 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isZh ? "使命" : "Mission"}
            </h2>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 sm:p-8 border border-blue-100 dark:border-blue-800/50">
            <p className="text-lg sm:text-xl text-gray-800 dark:text-gray-200 leading-relaxed mb-6">
              {isZh
                ? "让每一个创作者和企业都能轻松驾驭 AI 的力量，实现营销的全面自动化。"
                : "Empower every creator and business to effortlessly harness the power of AI for fully automated marketing."}
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {isZh
                ? "我们相信，AI 不应该是少数技术专家的特权。xPilot 致力于消除 AI 使用的复杂性，让用户专注于创意和策略，而不是技术细节。从内容创作、图片生成、视频制作到定时发布、数据分析，xPilot 用 AI 自动化整个营销工作流。"
                : "We believe AI should not be a privilege reserved for technical experts. xPilot is dedicated to removing the complexity of using AI, letting users focus on creativity and strategy rather than technical details. From content creation, image generation, and video production to scheduled posting and data analytics, xPilot automates your entire marketing workflow with AI."}
            </p>
          </div>
        </section>

        {/* Vision */}
        <section className="mb-16">
          <div className="border-l-4 border-purple-500 pl-6 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isZh ? "愿景" : "Vision"}
            </h2>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-6 sm:p-8 border border-purple-100 dark:border-purple-800/50">
            <p className="text-lg sm:text-xl text-gray-800 dark:text-gray-200 leading-relaxed mb-6">
              {isZh
                ? "构建一个用户无需思考模型选择的世界——xPilot 为每项任务智能匹配最佳 AI 模型。"
                : "Build a world where users never need to think about model selection — xPilot intelligently matches the best AI model for every task."}
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {isZh
                ? "AI 领域的模型更新速度极快，每周都有更强大的模型发布。我们的用户不应该被迫跟踪哪个模型最适合写文案、哪个模型最擅长生成图片、哪个模型做视频效果最好。xPilot 在后台持续评估和集成最新的 AI 模型，自动为每项任务选择最优方案——用户只需要告诉我们他们想要什么，剩下的交给 xPilot。"
                : "The AI landscape evolves at breakneck speed, with more powerful models released every week. Our users shouldn't be forced to track which model writes the best copy, which generates the best images, or which produces the best videos. xPilot continuously evaluates and integrates the latest AI models behind the scenes, automatically selecting the optimal solution for every task — users simply tell us what they want, and xPilot handles the rest."}
            </p>
          </div>
        </section>

        {/* Core Beliefs */}
        <section className="mb-16">
          <div className="border-l-4 border-emerald-500 pl-6 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isZh ? "核心理念" : "Core Beliefs"}
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-3xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isZh ? "AI Native，而非 AI 增强" : "AI Native, Not AI Enhanced"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {isZh
                  ? "我们不是在传统工具上叠加 AI 功能，而是从第一天起就以 AI 为核心构建整个平台。每个功能、每个流程都是为 AI 优先设计的。"
                  : "We don't bolt AI features onto traditional tools. From day one, every feature and workflow is designed with AI at the core. AI isn't an add-on — it's the foundation."}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-3xl mb-4">🎯</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isZh
                  ? "最佳模型，最佳任务"
                  : "Best Model for Every Task"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {isZh
                  ? "没有一个 AI 模型能在所有任务上表现最好。xPilot 集成多家顶级 AI 提供商的模型，为每一项具体任务智能匹配最合适的模型，确保用户永远获得最好的结果。"
                  : "No single AI model excels at everything. xPilot integrates models from multiple top AI providers and intelligently matches the best model for each specific task, ensuring users always get the best results."}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isZh ? "零门槛自动化" : "Zero-Barrier Automation"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {isZh
                  ? "用户不需要了解 prompt engineering、不需要比较模型参数、不需要任何技术背景。只需表达意图，xPilot 就能完成从创作到发布的全流程。"
                  : "Users don't need to know prompt engineering, compare model parameters, or have any technical background. Simply express your intent, and xPilot handles everything from creation to publishing."}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="text-3xl mb-4">🌍</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {isZh ? "全球化视野" : "Global Reach"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {isZh
                  ? "营销不分国界。xPilot 支持多语言内容创作和跨平台发布，帮助用户触达全球受众，无论他们在哪里。"
                  : "Marketing knows no borders. xPilot supports multilingual content creation and cross-platform publishing, helping users reach global audiences wherever they are."}
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-16">
          <div className="border-l-4 border-amber-500 pl-6 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isZh ? "为什么选择 xPilot" : "Why xPilot"}
            </h2>
          </div>
          <div className="space-y-4">
            {(isZh
              ? [
                  {
                    title: "智能模型路由",
                    desc: "xPilot 在后台集成了 OpenAI、Anthropic、Google、字节跳动、阿里巴巴等多家 AI 提供商的模型。当你创建内容时，xPilot 会自动选择最适合当前任务的模型——写文案用最擅长文字的模型，生成图片用最新的图像模型，制作视频用最强的视频模型。",
                  },
                  {
                    title: "持续进化",
                    desc: "AI 模型日新月异，xPilot 团队持续跟踪、评测和集成最新的模型。你不需要关心底层技术的变化，xPilot 确保你始终使用业界最先进的 AI 能力。",
                  },
                  {
                    title: "一站式营销工作流",
                    desc: "从 AI 文案写作、图片生成、视频制作，到定时发布、数据分析、知识库管理——所有营销环节在一个平台上完成，无需在多个工具之间切换。",
                  },
                ]
              : [
                  {
                    title: "Intelligent Model Routing",
                    desc: "xPilot integrates models from OpenAI, Anthropic, Google, ByteDance, Alibaba, and more behind the scenes. When you create content, xPilot automatically selects the best model for the task — the strongest writing model for copy, the latest image model for visuals, the best video model for clips.",
                  },
                  {
                    title: "Continuous Evolution",
                    desc: "AI models advance daily. The xPilot team continuously tracks, evaluates, and integrates the latest models. You don't need to care about underlying tech changes — xPilot ensures you always have access to the most advanced AI capabilities in the industry.",
                  },
                  {
                    title: "All-in-One Marketing Workflow",
                    desc: "From AI copywriting, image generation, and video production to scheduled posting, analytics, and knowledge base management — everything happens in one platform. No more switching between multiple tools.",
                  },
                ]
            ).map((item, i) => (
              <div
                key={i}
                className="flex gap-4 items-start bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-5 border border-amber-100 dark:border-amber-800/30"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-10 px-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            {isZh
              ? "让 AI 为你工作，而不是让你为 AI 工作"
              : "Let AI work for you, not the other way around"}
          </h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">
            {isZh
              ? "立即体验 xPilot，开启全自动化营销之旅"
              : "Try xPilot today and start your fully automated marketing journey"}
          </p>
          <Link
            href={isZh ? "/zh/login" : "/login"}
            className="inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition shadow-lg"
          >
            {isZh ? "免费开始" : "Get Started Free"}
          </Link>
        </section>
      </div>
    </div>
  );
}
