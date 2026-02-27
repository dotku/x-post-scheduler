import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mainstream Media Channels in the U.S. (2026) | xPilot",
  description:
    "Overview of mainstream media channels in the United States across TV, newspapers, digital-native, audio, and social platforms.",
};

export default async function USMainstreamMediaCaseStudyPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href={`${isZh ? "/zh" : ""}/media-news`}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← {isZh ? "返回媒体资讯" : "Back to Media News"}
          </Link>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {isZh
              ? "美国主流媒体渠道全景（2026）"
              : "Mainstream Media Channels in the U.S. (2026)"}
          </h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {isZh
              ? "一篇面向品牌与内容团队的实用梳理：按渠道类型快速理解美国媒体生态。"
              : "A practical guide for brands and content teams to quickly map the U.S. media ecosystem by channel type."}
          </p>
          <div className="mt-4">
            <Link
              href={`${locale === "zh" ? "/zh" : ""}/media-news/social-media-landscape-2026`}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {isZh
                ? "查看新文章：主流社交媒体全景（最新数据）"
                : "Read new article: Mainstream Social Media Landscape (Latest Data)"}
            </Link>
          </div>
        </div>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sm:p-8 space-y-8">
          <section className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 p-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "数据快照（2025–2026）" : "Data Snapshot (2025–2026)"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                {isZh
                  ? "美国成年人平台使用（Pew 2025）：YouTube 与 Facebook 仍是最常用平台，约一半美国成年人使用 Instagram。"
                  : "U.S. adult platform usage (Pew 2025): YouTube and Facebook remain the most-used platforms, and about half of U.S. adults use Instagram."}
              </li>
              <li>
                {isZh
                  ? "全球社交媒体用户身份约 52.4 亿（DataReportal 2025），同比增长 4.1%。"
                  : "Global social media user identities reached about 5.24B (DataReportal 2025), up 4.1% YoY."}
              </li>
              <li>
                {isZh
                  ? "全球互联网用户约 55.6 亿，渗透率约 67.9%。"
                  : "Global internet users reached about 5.56B, with ~67.9% penetration."}
              </li>
              <li>
                {isZh
                  ? "Snap 披露（2026）：Snapchat 月活约 9.46 亿，显示“社交+视觉内容”仍具强规模。"
                  : "Snap disclosure (2026): Snapchat has ~946M MAU, showing social + visual communication still scales strongly."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "1) 电视新闻与有线频道" : "1) TV News & Cable Networks"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <strong>CNN</strong>：
                {isZh
                  ? "全球新闻分发能力强，突发新闻覆盖快。"
                  : "Strong global distribution and fast breaking-news coverage."}
              </li>
              <li>
                <strong>Fox News</strong>：
                {isZh
                  ? "保守派受众集中，观点型节目影响力大。"
                  : "Large conservative audience with high-impact opinion programming."}
              </li>
              <li>
                <strong>MSNBC</strong>：
                {isZh
                  ? "偏自由派受众，政治议题讨论密集。"
                  : "Leans liberal with dense political commentary."}
              </li>
              <li>
                <strong>ABC / NBC / CBS News</strong>：
                {isZh
                  ? "传统三大广播网，覆盖广、品牌安全性高。"
                  : "Major broadcast networks with broad reach and strong brand safety."}
              </li>
            </ul>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {isZh
                ? "数据提示：在社媒高速增长背景下，电视仍是美国中高年龄层的重要触达渠道，适合承担“可信背书 + 大盘覆盖”。"
                : "Data note: despite rapid social growth, TV remains a key reach channel for older U.S. audiences and is effective for credibility and broad awareness."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh
                ? "2) 全国性报纸与深度新闻品牌"
                : "2) National Newspapers & Deep-Reporting Brands"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <strong>The New York Times</strong>：
                {isZh
                  ? "调查报道与解释型内容强，订阅用户粘性高。"
                  : "Strong investigative and explanatory journalism with sticky subscription audiences."}
              </li>
              <li>
                <strong>The Washington Post</strong>：
                {isZh
                  ? "政治与公共政策报道优势明显。"
                  : "Particularly strong in politics and public policy coverage."}
              </li>
              <li>
                <strong>Wall Street Journal</strong>：
                {isZh
                  ? "商业、金融和企业决策人群渗透率高。"
                  : "High penetration among business, finance, and decision-maker audiences."}
              </li>
              <li>
                <strong>USA Today</strong>：
                {isZh
                  ? "大众新闻入口型媒体，受众面广。"
                  : "Mass-market news gateway with broad audience accessibility."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "3) 数字原生媒体" : "3) Digital-Native News Outlets"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <strong>Axios</strong>：
                {isZh
                  ? "“Smart Brevity”风格，适合高密度信息触达。"
                  : "Known for “Smart Brevity,” effective for high-density information delivery."}
              </li>
              <li>
                <strong>Politico</strong>：
                {isZh
                  ? "政策、选举与华盛顿政经圈层影响大。"
                  : "Strong influence in policy, elections, and D.C. professional circles."}
              </li>
              <li>
                <strong>
                  Vox / The Verge / BuzzFeed News legacy influence
                </strong>
                ：
                {isZh
                  ? "解释型报道、科技与文化议题传播力强。"
                  : "Strong explanatory framing and cultural/tech topic amplification."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "4) 音频与播客渠道" : "4) Audio & Podcast Channels"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <strong>NPR</strong>：
                {isZh
                  ? "公共媒体信誉高，教育与政策类受众质量高。"
                  : "High-trust public media with quality audiences in education and policy topics."}
              </li>
              <li>
                <strong>SiriusXM / iHeartMedia</strong>：
                {isZh
                  ? "传统广播与数字音频整合，广告库存丰富。"
                  : "Integrated terrestrial and digital audio with rich ad inventory."}
              </li>
              <li>
                <strong>Spotify / Apple Podcasts Top Charts</strong>：
                {isZh
                  ? "头部播客具有强用户陪伴和高转化潜力。"
                  : "Top podcasts provide strong attention time and conversion potential."}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh
                ? "5) 社交平台上的“媒体分发层”"
                : "5) Social Platforms as Distribution Layer"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                <strong>X (Twitter)</strong>：
                {isZh
                  ? "实时舆论场与记者生态密集，适合快讯和观点扩散。"
                  : "Dense journalist ecosystem and real-time discourse, ideal for rapid updates and opinion spread."}
              </li>
              <li>
                <strong>YouTube</strong>：
                {isZh
                  ? "视频新闻评论、深度访谈与长内容的核心平台。"
                  : "Core platform for video commentary, deep interviews, and long-form explainers."}
              </li>
              <li>
                <strong>Instagram / TikTok</strong>：
                {isZh
                  ? "短视频与视觉叙事更强，适合年轻受众。"
                  : "Short-form and visual storytelling perform strongly for younger audiences."}
              </li>
              <li>
                <strong>Reddit</strong>：
                {isZh
                  ? "社区分层明显，适合垂直话题深度讨论与口碑观察。"
                  : "Highly segmented communities for deep niche discussion and sentiment monitoring."}
              </li>
            </ul>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {isZh
                ? "数据提示：社媒是增长最快的分发层之一，但平台口径差异明显（MAU/DAU/Ad Reach），做预算分配时应统一口径再比较。"
                : "Data note: social is one of the fastest-growing distribution layers, but platform metrics differ (MAU/DAU/Ad Reach), so normalize definitions before budget comparisons."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "6) 品牌实操建议（简版）" : "6) Practical Mix for Brands"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>
                {isZh
                  ? "品牌公信力：优先全国性报纸 + 广播网新闻。"
                  : "For credibility: prioritize national newspapers + broadcast network news."}
              </li>
              <li>
                {isZh
                  ? "高频曝光：搭配 X + YouTube + 短视频平台。"
                  : "For frequency: combine X + YouTube + short-video platforms."}
              </li>
              <li>
                {isZh
                  ? "深度影响：加入播客与垂直数字媒体（如 Politico/Axios）。"
                  : "For depth: add podcasts and vertical digital outlets like Politico/Axios."}
              </li>
              <li>
                {isZh
                  ? "评估维度：触达、互动率、品牌安全、转化成本四项并行。"
                  : "Measure reach, engagement, brand safety, and conversion cost in parallel."}
              </li>
            </ul>
          </section>

          <section className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isZh
                ? "注：媒体影响力会随选举周期、平台策略和商业模式变化而调整，建议每季度复盘一次渠道组合。"
                : "Note: Channel influence shifts with election cycles, platform policy, and monetization changes; review your mix quarterly."}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "数据来源" : "Data Sources"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-blue-600 dark:text-blue-400">
              <li>
                <a
                  href="https://www.pewresearch.org/internet/fact-sheet/social-media/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Pew Research Center — Social Media Fact Sheet (2025)
                </a>
              </li>
              <li>
                <a
                  href="https://datareportal.com/reports/digital-2025-global-overview-report"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  DataReportal — Digital 2025 Global Overview Report
                </a>
              </li>
              <li>
                <a
                  href="https://investor.snap.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Snap Investor Relations — Q4 2025 / FY2025 disclosures (2026)
                </a>
              </li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
