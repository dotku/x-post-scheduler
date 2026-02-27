import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mainstream Social Media Landscape (2026) | xPilot",
  description:
    "A data-backed case study of mainstream social media channels using the latest available 2025-2026 public data.",
};

export default async function SocialMediaCaseStudyPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href={`${prefix}/news`}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← {isZh ? "返回媒体资讯" : "Back to Media News"}
          </Link>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {isZh
              ? "主流社交媒体全景（2026）：基于最新公开数据"
              : "Mainstream Social Media Landscape (2026): Latest Public Data"}
          </h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {isZh
              ? "这篇文章聚焦美国市场策略，同时参考全球平台体量与活跃趋势。数据优先采用 2025–2026 最新公开来源。"
              : "This article focuses on U.S. go-to-market decisions while incorporating global scale and activity trends from the latest public 2025–2026 sources."}
          </p>
        </div>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sm:p-8 space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "核心结论（先看）" : "Executive Summary"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                {isZh
                  ? "美国用户结构上，YouTube 与 Facebook 仍是最广覆盖层；Instagram 维持高影响力；TikTok 在时长与内容扩散上仍强。"
                  : "In the U.S., YouTube and Facebook remain top-reach layers; Instagram keeps strong influence; TikTok still dominates attention and content velocity."}
              </li>
              <li>
                {isZh
                  ? "面向品牌增长，建议采用“广覆盖（YouTube/Facebook）+ 高互动（Instagram/TikTok）+ 话题渗透（Reddit/X）”组合。"
                  : "For brand growth, use a mix of broad reach (YouTube/Facebook), high engagement (Instagram/TikTok), and topic penetration (Reddit/X)."}
              </li>
              <li>
                {isZh
                  ? "新平台（Threads、Bluesky）值得监控，但在预算上更适合“实验仓位”而非核心投放仓位。"
                  : "Emerging platforms (Threads, Bluesky) are worth monitoring, but fit better as experimental budget rather than core allocation."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh
                ? "1) 最新平台规模与活跃度（全球视角）"
                : "1) Latest Platform Scale & Activity (Global View)"}
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                {isZh
                  ? "DataReportal《Digital 2025》显示：全球社交媒体用户身份（user identities）约 52.4 亿，同比 +4.1%。这说明“社交”仍是最核心的互联网流量入口之一。"
                  : "DataReportal Digital 2025 reports ~5.24B global social media user identities, up 4.1% YoY, reinforcing social as a primary internet distribution layer."}
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  {isZh
                    ? "YouTube 广告可触达约 25.3 亿。"
                    : "YouTube ad reach: ~2.53B."}
                </li>
                <li>
                  {isZh
                    ? "Facebook 广告可触达约 22.8 亿。"
                    : "Facebook ad reach: ~2.28B."}
                </li>
                <li>
                  {isZh
                    ? "Instagram（18+）广告可触达约 16.7 亿。"
                    : "Instagram (18+) ad reach: ~1.67B."}
                </li>
                <li>
                  {isZh
                    ? "TikTok（18+）广告可触达约 15.9 亿（口径为广告工具估算）。"
                    : "TikTok (18+) ad reach: ~1.59B (ad tool estimate)."}
                </li>
                <li>
                  {isZh
                    ? "Threads 在 2025 年初约 3.2 亿 MAU（平台公开口径）。"
                    : "Threads reached ~320M MAU in early 2025 (platform-reported)."}
                </li>
                <li>
                  {isZh
                    ? "Snap 2025Q4 对外披露 Snapchat 约 9.46 亿 MAU。"
                    : "Snap disclosed ~946M Snapchat MAU in Q4 2025."}
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh
                ? "2) 美国市场：平台结构怎么读"
                : "2) U.S. Market: How to Read Platform Structure"}
            </h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <p>
                {isZh
                  ? "Pew Research Center（2025）仍将 YouTube 与 Facebook列为美国成年人中最常用平台。Instagram 维持中高渗透；TikTok、Reddit、Snapchat、X 形成分层补充。"
                  : "Pew Research Center (2025) still identifies YouTube and Facebook as the most commonly used platforms among U.S. adults, with Instagram at strong mid-high penetration and TikTok/Reddit/Snapchat/X as layered complements."}
              </p>
              <p>
                {isZh
                  ? "从策略上看，这意味着：如果目标是“覆盖更多潜在受众”，需要先保证 YouTube/Facebook 的基本盘；如果目标是“提高内容互动与传播速度”，Instagram/TikTok 通常优先。"
                  : "Strategically, if your goal is broad reach, secure YouTube/Facebook baseline coverage first; if your goal is interaction and distribution speed, prioritize Instagram/TikTok."}
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh
                ? "3) 面向品牌增长的渠道分工"
                : "3) Channel Roles for Brand Growth"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <strong>{isZh ? "YouTube" : "YouTube"}</strong>
                {isZh
                  ? "：长视频与搜索型消费并存，适合“教育 + 信任建立 + 持续获客”。"
                  : ": Blends search intent with long-form consumption; ideal for education, trust-building, and evergreen acquisition."}
              </li>
              <li>
                <strong>{isZh ? "Facebook" : "Facebook"}</strong>
                {isZh
                  ? "：覆盖面仍大，适合再营销、本地化社群触达与成熟客群经营。"
                  : ": Still high-reach; useful for retargeting, local communities, and mature-audience operations."}
              </li>
              <li>
                <strong>{isZh ? "Instagram" : "Instagram"}</strong>
                {isZh
                  ? "：品牌视觉与 lifestyle 内容优势明显，适合新品种草与创意测试。"
                  : ": Strong for visual brand building and lifestyle narratives; great for launch storytelling and creative testing."}
              </li>
              <li>
                <strong>{isZh ? "TikTok" : "TikTok"}</strong>
                {isZh
                  ? "：内容扩散和使用时长优势突出，适合“高频短内容 + 迭代式创意”。"
                  : ": High attention-time and algorithmic distribution; ideal for high-frequency short content and iterative creatives."}
              </li>
              <li>
                <strong>{isZh ? "Reddit / X" : "Reddit / X"}</strong>
                {isZh
                  ? "：更适合议题运营、社区口碑、实时事件传播，不应只看曝光量。"
                  : ": Better for topic-driven operations, community sentiment, and real-time narratives beyond pure reach metrics."}
              </li>
              <li>
                <strong>{isZh ? "LinkedIn" : "LinkedIn"}</strong>
                {isZh
                  ? "：B2B 与职业人群优势显著，适合专家内容与高客单转化链路。"
                  : ": Strong B2B/professional value for expert-led content and high-value conversion flows."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh
                ? "4) 2026 投放与内容建议（可落地）"
                : "4) 2026 Practical Playbook"}
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                {isZh
                  ? "先搭“2+2”基础盘：YouTube/Facebook 做覆盖，Instagram/TikTok 做互动。"
                  : "Build a 2+2 baseline: YouTube/Facebook for reach, Instagram/TikTok for engagement."}
              </li>
              <li>
                {isZh
                  ? "每周固定一个“实验位”：测试 Threads 或 Reddit 垂直社区话题。"
                  : "Reserve weekly experiment slots for Threads or targeted Reddit communities."}
              </li>
              <li>
                {isZh
                  ? "统一指标看板：Reach、Engagement、Qualified Click、Cost per Qualified Action。"
                  : "Use one scorecard: Reach, Engagement, Qualified Clicks, and Cost per Qualified Action."}
              </li>
              <li>
                {isZh
                  ? "避免只看单平台爆量：跨平台复用素材并追踪“总触达去重后增量”。"
                  : "Avoid single-platform vanity spikes; repurpose cross-platform and track deduplicated incremental reach."}
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "数据来源（最新公开）" : "Sources (Latest Public Data)"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-blue-600 dark:text-blue-400">
              <li>
                <a
                  href="https://www.pewresearch.org/internet/fact-sheet/social-media/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Pew Research Center — Social Media Fact Sheet (Nov 2025)
                </a>
              </li>
              <li>
                <a
                  href="https://datareportal.com/reports/digital-2025-global-overview-report"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  DataReportal — Digital 2025 Global Overview Report (Feb 2025)
                </a>
              </li>
              <li>
                <a
                  href="https://investor.snap.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Snap Investor Relations — Q4 2025 materials (Feb 2026)
                </a>
              </li>
            </ul>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {isZh
                ? "注：不同平台会使用 MAU、DAU、Ad Reach 等不同口径。跨平台对比时请先统一指标定义。"
                : "Note: Platforms report different metrics (MAU, DAU, ad reach). Normalize metric definitions before cross-platform comparison."}
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
