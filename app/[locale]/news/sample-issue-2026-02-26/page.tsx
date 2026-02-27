import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Media Industry Daily Deep-Dive | 2026-02-26 | xPilot",
  description:
    "Published daily issue for 2026-02-26 with strategic media, social, and marketing insights.",
};

export const dynamic = "force-dynamic";

export default async function SampleIssuePage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <Link
            href={`${prefix}/news`}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            ← {isZh ? "返回传媒行业日报" : "Back to Media Industry Daily"}
          </Link>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {isZh
              ? "传媒营销科技行业日报（深度版｜2026-02-26）"
              : "Media, Social & Marketing Daily (Deep-Dive | 2026-02-26)"}
          </h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {isZh
              ? "今日版聚焦零售媒体策略升级、可归因投放与内容分发协同，提供可直接执行的动作清单。"
              : "Today’s issue focuses on retail media strategy upgrades, attributable performance, and multi-format distribution execution."}
          </p>
        </div>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sm:p-8 space-y-8 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "今日一句话" : "One-Line Take"}
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <p className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                本日核心判断：零售媒体正在从“库存采买”升级为“数据协同 +
                开放互联网分发”的经营系统。
              </p>
              <p className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                Key takeaway: retail media is shifting from inventory buying to
                an operating system powered by data collaboration and
                open-internet distribution.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "三大行业信号" : "Top 3 Industry Signals"}
            </h2>
            <ol className="list-decimal list-inside space-y-3">
              <li>
                <strong>
                  {isZh
                    ? "零售媒体进入“开放协同”阶段"
                    : "Retail media enters open-collaboration stage"}
                </strong>
                {isZh
                  ? "：THG 与 The Trade Desk 的合作信号显示，品牌零售媒体不再局限站内流量，而是向站外可控分发延伸。"
                  : ": the THG–The Trade Desk partnership signals that retailer media is extending from onsite traffic to controllable offsite distribution."}
              </li>
              <li>
                <strong>
                  {isZh
                    ? "投放目标回归可归因效果"
                    : "Performance attribution regains priority"}
                </strong>
                {isZh
                  ? "：预算决策从“曝光规模”继续转向“有效触达 + 转化路径清晰度”，渠道组合更加务实。"
                  : ": budget decisions continue moving from raw reach to qualified reach and conversion-path clarity."}
              </li>
              <li>
                <strong>
                  {isZh
                    ? "内容运营与媒介运营进一步合并"
                    : "Content ops and media ops continue to merge"}
                </strong>
                {isZh
                  ? "：同一主题需要以“内容版本 + 投放版本”双轨生产，否则难以兼顾覆盖与转化。"
                  : ": one narrative now requires parallel content and paid variants to balance reach and conversion."}
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "对业务的实际影响" : "Business Implications"}
            </h2>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <ul className="list-disc list-inside space-y-2">
                <li>
                  {isZh
                    ? "品牌侧：应把零售媒体从“广告位采购”升级为“用户数据协同与受众分层运营能力”。"
                    : "Brands should treat retail media as a first-party data and audience operations capability, not just ad slot buying."}
                </li>
                <li>
                  {isZh
                    ? "增长侧：预算应按漏斗分层管理（认知/意向/转化），并用统一归因口径审视平台贡献。"
                    : "Growth teams should allocate by funnel stage (awareness/intent/conversion) with unified attribution across channels."}
                </li>
                <li>
                  {isZh
                    ? "组织侧：内容、投放、数据分析需在同一日报节奏下联动，缩短决策闭环。"
                    : "Organizations should align content, media buying, and analytics in one daily cadence to shorten decision cycles."}
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "今日可执行动作（24小时）" : "24-Hour Execution Plan"}
            </h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                {isZh
                  ? "围绕“零售媒体站内外协同”产出 1 条品牌观点，并在官网、LinkedIn、社媒短帖三端同步发布。"
                  : "Publish one brand POV around onsite-offsite retail media collaboration across website, LinkedIn, and short social posts."}
              </li>
              <li>
                {isZh
                  ? "投放上建立 A/B 双目标：A 争取高点击，B 优化线索质量；用 CPL 与转化率联合评估。"
                  : "Run dual-goal A/B: variant A for click efficiency, variant B for lead quality; evaluate with CPL + conversion rate."}
              </li>
              <li>
                {isZh
                  ? "为 AI 参与内容启用发布前审校：事实来源、品牌语气、素材授权三项必检。"
                  : "Apply a pre-publish gate for AI-assisted content: source validation, brand voice alignment, and asset rights checks."}
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "风险雷达" : "Risk Radar"}
            </h2>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-sm">
              <p>
                {isZh
                  ? "本日高风险点：过度依赖单一信源导致判断偏差；将零售媒体简单等同于站内广告；AI 生成内容未经授权即进入投放。"
                  : "Top risks today: single-source bias, oversimplifying retail media as onsite-only ads, and launching AI-assisted assets without rights checks."}
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "建议跟踪指标（明日复盘）" : "KPIs for Next-Day Review"}
            </h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                {isZh
                  ? "内容：首屏停留率、完播率、二次传播率"
                  : "Content: first-screen hold rate, completion rate, secondary share rate"}
              </li>
              <li>
                {isZh
                  ? "增长：去重触达、有效点击率、线索质量评分"
                  : "Growth: deduplicated reach, qualified CTR, lead quality score"}
              </li>
              <li>
                {isZh
                  ? "商业：CPL、转化率、7日回收进度"
                  : "Business: CPL, conversion rate, 7-day payback progress"}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {isZh ? "样例信源" : "Sample References"}
            </h2>
            <ul className="list-disc list-inside space-y-2 text-blue-600 dark:text-blue-400">
              <li>
                Business Wire — THG x The Trade Desk retail media partnership
              </li>
              <li>Reuters — advertising & media market updates</li>
              <li>Digiday — media buying and retail media operations</li>
              <li>
                WARC / eMarketer — attribution and budget allocation trends
              </li>
              <li>
                Nieman Lab — digital media product and newsroom transformation
              </li>
            </ul>
          </section>
        </article>
      </div>
    </div>
  );
}
