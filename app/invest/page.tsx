import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, Space_Mono } from "next/font/google";
import { prisma } from "@/lib/db";
import { getWavespeedFeeCents } from "@/lib/credits";

const heading = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Invest in Us | X Post Scheduler",
  description: "Investor page for X Post Scheduler.",
};

type Lang = "en" | "zh";

const TEXT = {
  en: {
    memo: "INVESTOR MEMO",
    back: "Back to Product",
    title1: "Invest in the AI",
    title2: "media operating system",
    title3: "for creators.",
    intro:
      "X Post Scheduler started as automation. It is now a production stack for text, image, and video generation, scheduling, and publishing. We are raising to scale distribution and turn creator workflows into a recurring software business.",
    requestDeck: "Request Deck",
    bookCall: "Book 20-min Call",
    valuationLabel: "Valuation",
    impliedArr: "Implied ARR",
    range: "Range",
    method: "Method",
    valuationLow: "Valuation Low",
    valuationBase: "Valuation Base",
    valuationHigh: "Valuation High",
    basedOn: "on annualized estimated usage revenue",
    baseAdj: "ARR + traction adjustment",
    calcTitle: "How This Is Calculated",
    whyWin: "Why We Win",
    useOfFunds: "Use of Funds",
    ctaTitle: "Let's build the category leader.",
    ctaText:
      "If you invest in workflow-first AI products with clear monetization paths, we should talk. We can share product demo, retention cohorts, usage economics, and roadmap in one session.",
    contact: "Contact Founders",
    viewProduct: "View Product",
    viewStats: "View Live Stats",
    disclaimer:
      "This is an internal indicative estimate, not investment advice or a formal valuation report.",
    updatedAt: "Updated at",
    kpiVisits30d: "30d Web Visits",
    kpiVisits7d: "7d visits",
    kpiActiveCreators: "Active Creators (30d)",
    kpiActiveCreatorsNote: "distinct users with AI usage events",
    kpiRequests: "AI Requests (30d)",
    kpiCashTopup: "Cash Top-up (30d)",
    kpiCashTopupNote: "actual paid credit purchases",
    calcRevenue: "Estimated Revenue (30d) = OpenAI billed usage + WaveSpeed billed usage",
    calcArr: "Implied ARR = 12 x 30d estimated revenue",
    calcMultiple: "Multiple bands adjust with active creators, web traffic, and request volume.",
    calcRatio: "Observed cash top-up (30d)",
    calcRatioSuffix: "Cash/estimated usage revenue ratio",
    fundingTitle: "Funding Need Model",
    fundingSubtitle:
      "Beyond usage metrics, this model includes product depth, roadmap execution, and market momentum.",
    fundingRange: "Suggested Raise",
    fundingLow: "Conservative",
    fundingBase: "Recommended",
    fundingHigh: "Aggressive",
    runway: "Runway Target",
    months: "months",
    featureScore: "Product Maturity",
    roadmapScore: "Roadmap Intensity",
    marketScore: "Market Momentum",
    modelAssumption:
      "Model assumptions: team burn + infra run-rate + go-to-market budget + roadmap one-off + contingency.",
    monthlyBurn: "Estimated Monthly Burn",
    roadmapBudget: "Roadmap Budget",
    gtmBudget: "Go-to-Market Budget",
    contingency: "Contingency",
  },
  zh: {
    memo: "投资人简报",
    back: "返回产品",
    title1: "投资这个 AI",
    title2: "创作者媒体操作系统",
    title3: "让内容生产可规模化。",
    intro:
      "X Post Scheduler 最初是自动化发帖工具，现在已发展为覆盖文本、图片、视频生成与调度发布的一体化生产系统。我们正在融资，用于扩大分发能力并将创作者工作流转化为可持续的订阅业务。",
    requestDeck: "索取融资材料",
    bookCall: "预约 20 分钟沟通",
    valuationLabel: "估值",
    impliedArr: "推算 ARR",
    range: "区间",
    method: "方法",
    valuationLow: "估值下限",
    valuationBase: "估值基准",
    valuationHigh: "估值上限",
    basedOn: "基于年化估算使用收入",
    baseAdj: "ARR 倍数 + 增长修正",
    calcTitle: "估值计算方式",
    whyWin: "我们的优势",
    useOfFunds: "资金用途",
    ctaTitle: "一起打造这个品类的头部产品。",
    ctaText:
      "如果你关注工作流驱动、且具备清晰变现路径的 AI 产品，我们可以进一步沟通。我们可以在一次会议中分享产品演示、留存数据、使用经济模型与路线图。",
    contact: "联系创始人",
    viewProduct: "查看产品",
    viewStats: "查看实时数据",
    disclaimer: "本页面为内部测算估值，不构成投资建议或正式估值报告。",
    updatedAt: "更新时间",
    kpiVisits30d: "30天网站访问",
    kpiVisits7d: "7天访问",
    kpiActiveCreators: "活跃创作者（30天）",
    kpiActiveCreatorsNote: "30天内有 AI 使用记录的去重用户",
    kpiRequests: "AI 请求量（30天）",
    kpiCashTopup: "现金充值（30天）",
    kpiCashTopupNote: "用户实际完成支付充值",
    calcRevenue: "估算收入（30天）= OpenAI 计费 + WaveSpeed 计费",
    calcArr: "推算 ARR = 30天估算收入 x 12",
    calcMultiple: "估值倍数会根据活跃创作者、访问量和请求量动态调整。",
    calcRatio: "观察到的现金充值（30天）",
    calcRatioSuffix: "现金/估算使用收入比",
    fundingTitle: "融资需求模型",
    fundingSubtitle: "除使用数据外，模型还纳入产品功能深度、路线图执行强度、市场动能。",
    fundingRange: "建议融资规模",
    fundingLow: "保守方案",
    fundingBase: "推荐方案",
    fundingHigh: "进攻方案",
    runway: "目标跑道",
    months: "个月",
    featureScore: "产品成熟度",
    roadmapScore: "路线图强度",
    marketScore: "市场动能",
    modelAssumption: "模型假设：团队人力成本 + 基础设施成本 + 市场投入 + 路线图一次性投入 + 风险缓冲。",
    monthlyBurn: "月度成本估算",
    roadmapBudget: "路线图预算",
    gtmBudget: "市场增长预算",
    contingency: "风险缓冲",
  },
} as const;

const MOAT_TEXT = {
  en: [
    "Workflow moat: scheduling, generation, knowledge, and gallery are integrated in one product loop.",
    "Cost moat: provider routing (OpenAI + WaveSpeed + others) lets us optimize margin per generation.",
    "Data moat: real prompt/output/engagement traces improve templates and defaults over time.",
  ],
  zh: [
    "工作流护城河：调度、生成、知识库、画廊形成闭环，用户迁移成本高。",
    "成本护城河：多模型供应商路由（OpenAI + WaveSpeed 等）可持续优化毛利。",
    "数据护城河：真实提示词/输出/互动数据沉淀，持续提升模板与默认策略。",
  ],
} as const;

const USE_OF_FUNDS_TEXT = {
  en: [
    { title: "Growth", detail: "Performance acquisition, creator referral system, and conversion optimization." },
    { title: "Product", detail: "Long-video pipeline, higher-fidelity i2i workflows, and multilingual UX upgrades." },
    { title: "Infra", detail: "Smarter model routing, reliability hardening, and margin-aware generation controls." },
  ],
  zh: [
    { title: "增长", detail: "效果投放、创作者推荐体系、转化漏斗优化。" },
    { title: "产品", detail: "长视频链路、更高质量图生图流程、双语/多语体验提升。" },
    { title: "基础设施", detail: "更智能的模型路由、稳定性加固、面向利润的生成控制。" },
  ],
} as const;

function inferWavespeedMediaType(modelId: string): "image" | "video" {
  const id = modelId.toLowerCase();
  if (
    id.includes("video") ||
    id.includes("/t2v") ||
    id.includes("/i2v") ||
    id.includes("seedance")
  ) {
    return "video";
  }
  return "image";
}

function usd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default async function InvestPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const sp = await searchParams;
  const lang: Lang = sp.lang === "zh" ? "zh" : "en";
  const t = TEXT[lang];
  const moat = MOAT_TEXT[lang];
  const useOfFunds = USE_OF_FUNDS_TEXT[lang];

  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    usageUsers30d,
    usageAgg30d,
    openAiUsage30d,
    wavespeedByModel30d,
    topup30dAgg,
  ] = await Promise.all([
    prisma.usageEvent.findMany({
      where: { createdAt: { gte: since30d } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.usageEvent.aggregate({
      where: { createdAt: { gte: since30d } },
      _count: { _all: true },
      _sum: { totalTokens: true },
    }),
    prisma.usageEvent.aggregate({
      where: { provider: "openai", createdAt: { gte: since30d } },
      _sum: { promptTokens: true, completionTokens: true },
    }),
    prisma.usageEvent.groupBy({
      by: ["model"],
      where: { provider: "wavespeed", createdAt: { gte: since30d } },
      _count: { _all: true },
      orderBy: { _count: { model: "desc" } },
      take: 50,
    }),
    prisma.creditTransaction.aggregate({
      where: {
        type: "topup",
        amountCents: { gt: 0 },
        createdAt: { gte: since30d },
      },
      _sum: { amountCents: true },
    }),
  ]);

  let webVisits30d = 0;
  let webVisits7d = 0;
  try {
    const hasWebVisitTable = await prisma.$queryRaw<Array<{ exists: string | null }>>`
      SELECT to_regclass('public."WebVisit"')::text AS exists
    `;
    if (hasWebVisitTable[0]?.exists) {
      const [visits30dResult, visits7dResult] = await Promise.all([
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "WebVisit"
          WHERE "createdAt" >= ${since30d}
        `,
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "WebVisit"
          WHERE "createdAt" >= ${since7d}
        `,
      ]);
      webVisits30d = Number(visits30dResult[0]?.count ?? BigInt(0));
      webVisits7d = Number(visits7dResult[0]?.count ?? BigInt(0));
    }
  } catch {
    // Keep valuation page usable if WebVisit table is missing.
  }

  const openAiPromptTokens30d = openAiUsage30d._sum.promptTokens ?? 0;
  const openAiCompletionTokens30d = openAiUsage30d._sum.completionTokens ?? 0;
  const openAiCharge30dCents = Math.max(
    0,
    Math.ceil(
      ((openAiPromptTokens30d / 1_000_000) * 250 + (openAiCompletionTokens30d / 1_000_000) * 1000) *
        60
    )
  );
  const wavespeedCharge30dCents = (
    wavespeedByModel30d as Array<{ model: string | null; _count: { _all: number } }>
  ).reduce((sum, row) => {
    const modelId = row.model ?? "";
    if (!modelId) return sum;
    const fee = getWavespeedFeeCents(modelId, inferWavespeedMediaType(modelId));
    return sum + fee * row._count._all;
  }, 0);
  const estRevenue30dCents = openAiCharge30dCents + wavespeedCharge30dCents;
  const estArrCents = estRevenue30dCents * 12;

  const paidRevenue30dCents = topup30dAgg._sum.amountCents ?? 0;
  const revenueCoverage =
    estRevenue30dCents > 0 ? Math.max(0, Math.min(5, paidRevenue30dCents / estRevenue30dCents)) : 0;

  const activeCreators30d = usageUsers30d.length;
  const baseMultiple =
    4 +
    (activeCreators30d >= 100 ? 1 : 0) +
    (webVisits30d >= 10000 ? 1 : 0) +
    (usageAgg30d._count._all >= 5000 ? 1 : 0);
  const lowMultiple = Math.max(3, baseMultiple - 1);
  const highMultiple = Math.min(10, baseMultiple + 1);

  const valuationLowCents = Math.max(250_000_00, Math.round(estArrCents * lowMultiple));
  const valuationBaseCents = Math.max(400_000_00, Math.round(estArrCents * baseMultiple));
  const valuationHighCents = Math.max(600_000_00, Math.round(estArrCents * highMultiple));
  const markupMultiplier = Number(process.env.MARKUP_MULTIPLIER ?? "60") || 60;
  const openAiProviderCost30dCents = Math.max(
    0,
    Math.ceil(
      (openAiPromptTokens30d / 1_000_000) * 250 + (openAiCompletionTokens30d / 1_000_000) * 1000
    )
  );
  const wavespeedProviderCost30dCents = Math.max(
    0,
    Math.round(wavespeedCharge30dCents / Math.max(1, markupMultiplier))
  );

  const featureScore = Math.min(
    10,
    (usageAgg30d._count._all >= 5000 ? 4 : usageAgg30d._count._all >= 1000 ? 3 : 2) +
      (activeCreators30d >= 200 ? 3 : activeCreators30d >= 50 ? 2 : 1) +
      (paidRevenue30dCents >= 5_000_00 ? 3 : paidRevenue30dCents >= 1_000_00 ? 2 : 1)
  );
  const roadmapScore = 7 + (estRevenue30dCents > 10_000_00 ? 1 : 0);
  const trafficMomentum = webVisits30d > 0 ? (webVisits7d * 4) / webVisits30d : 1;
  const marketScore = Math.max(
    3,
    Math.min(
      10,
      Math.round(
        3 +
          Math.min(3, activeCreators30d / 80) +
          Math.min(2, revenueCoverage) +
          Math.min(2, trafficMomentum)
      )
    )
  );

  const targetRunwayMonths = marketScore >= 7 ? 18 : 24;
  const monthlyTeamBurnCents = (10 + roadmapScore) * 5_000_00;
  const monthlyInfraBurnCents = openAiProviderCost30dCents + wavespeedProviderCost30dCents;
  const monthlyGtmBurnCents = (4 + marketScore) * 2_000_00;
  const monthlyBurnCents = monthlyTeamBurnCents + monthlyInfraBurnCents + monthlyGtmBurnCents;

  const roadmapOneOffBudgetCents = roadmapScore * 8_000_00;
  const marketExpansionBudgetCents = marketScore * 5_000_00;
  const contingencyCents = Math.round((monthlyBurnCents * targetRunwayMonths + roadmapOneOffBudgetCents) * 0.15);
  const raiseBaseCents =
    monthlyBurnCents * targetRunwayMonths +
    roadmapOneOffBudgetCents +
    marketExpansionBudgetCents +
    contingencyCents;
  const raiseLowCents = Math.round(raiseBaseCents * 0.8);
  const raiseHighCents = Math.round(raiseBaseCents * 1.25);

  const kpis = [
    {
      label: t.kpiVisits30d,
      value: webVisits30d.toLocaleString(),
      note: `${t.kpiVisits7d}: ${webVisits7d.toLocaleString()}`,
    },
    {
      label: t.kpiActiveCreators,
      value: activeCreators30d.toLocaleString(),
      note: t.kpiActiveCreatorsNote,
    },
    {
      label: t.kpiRequests,
      value: usageAgg30d._count._all.toLocaleString(),
      note: `${(usageAgg30d._sum.totalTokens ?? 0).toLocaleString()} tokens`,
    },
    {
      label: t.kpiCashTopup,
      value: usd(paidRevenue30dCents),
      note: t.kpiCashTopupNote,
    },
  ] as const;

  const withLang = (path: string) => `${path}${path.includes("?") ? "&" : "?"}lang=${lang}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#071320] text-[#E6EDF5]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(39,191,255,0.22),transparent_45%),radial-gradient(circle_at_85%_18%,rgba(255,182,72,0.2),transparent_42%),radial-gradient(circle_at_70%_80%,rgba(108,255,163,0.18),transparent_46%)]" />
      <div className="pointer-events-none absolute -left-28 top-32 h-72 w-72 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -right-20 bottom-20 h-64 w-64 rounded-full border border-white/10" />

      <main className="relative mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs tracking-[0.16em] text-[#A9C4DA]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6CFFA3]" />
            {t.memo}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/invest?lang=en"
              className={`rounded-full border px-3 py-1 text-xs transition ${
                lang === "en"
                  ? "border-[#6CFFA3] bg-[#6CFFA3]/20 text-white"
                  : "border-white/20 text-[#C8D8E6] hover:bg-white/10"
              }`}
            >
              EN
            </Link>
            <Link
              href="/invest?lang=zh"
              className={`rounded-full border px-3 py-1 text-xs transition ${
                lang === "zh"
                  ? "border-[#6CFFA3] bg-[#6CFFA3]/20 text-white"
                  : "border-white/20 text-[#C8D8E6] hover:bg-white/10"
              }`}
            >
              中文
            </Link>
            <Link
              href={withLang("/")}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-[#C8D8E6] transition hover:bg-white/10"
            >
              {t.back}
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-5">
            <h1 className={`${heading.className} text-4xl leading-[1.02] sm:text-6xl`}>
              {t.title1}
              <br />
              {t.title2}
              <br />
              {t.title3}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#BDD2E5] sm:text-base">{t.intro}</p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="mailto:founders@xpostscheduler.com?subject=Investment%20Inquiry"
                className="rounded-full bg-[#F7B267] px-5 py-2.5 text-sm font-semibold text-[#1C1F24] transition hover:bg-[#ffc07f]"
              >
                {t.requestDeck}
              </a>
              <a
                href="mailto:founders@xpostscheduler.com?subject=Book%20a%20Call"
                className="rounded-full border border-white/30 px-5 py-2.5 text-sm text-[#D8E4F0] transition hover:bg-white/10"
              >
                {t.bookCall}
              </a>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-sm">
            <p className={`${mono.className} text-xs uppercase tracking-[0.16em] text-[#A3BED3]`}>{t.valuationLabel}</p>
            <p className={`${heading.className} mt-2 text-4xl text-[#6CFFA3]`}>{usd(valuationBaseCents)}</p>
            <div className="mt-4 space-y-2 text-sm text-[#D4E3F1]">
              <p>{t.impliedArr}: {usd(estArrCents)}</p>
              <p>{t.range}: {usd(valuationLowCents)} - {usd(valuationHighCents)}</p>
              <p>{t.method}: {lowMultiple}x - {highMultiple}x ARR</p>
            </div>
          </aside>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <article key={kpi.label} className="rounded-xl border border-white/15 bg-white/5 p-4">
              <p className="text-xs text-[#9CB8CF]">{kpi.label}</p>
              <p className={`${heading.className} mt-2 text-3xl text-white`}>{kpi.value}</p>
              <p className="mt-2 text-xs leading-5 text-[#C2D5E6]">{kpi.note}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-[#6CFFA3]/45 bg-[#0f2234]/70 p-5">
            <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-[#9ac8e7]`}>{t.valuationLow}</p>
            <p className={`${heading.className} mt-2 text-4xl text-[#c9f8de]`}>{usd(valuationLowCents)}</p>
            <p className="mt-2 text-xs text-[#b5d2e7]">{lowMultiple}x {t.basedOn}</p>
          </article>
          <article className="rounded-2xl border border-[#43C9FF]/50 bg-[#10253a]/80 p-5">
            <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-[#9ac8e7]`}>{t.valuationBase}</p>
            <p className={`${heading.className} mt-2 text-4xl text-white`}>{usd(valuationBaseCents)}</p>
            <p className="mt-2 text-xs text-[#b5d2e7]">{baseMultiple}x {t.baseAdj}</p>
          </article>
          <article className="rounded-2xl border border-[#F7B267]/50 bg-[#2a1d1a]/60 p-5">
            <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-[#f8cca6]`}>{t.valuationHigh}</p>
            <p className={`${heading.className} mt-2 text-4xl text-[#ffe8cf]`}>{usd(valuationHighCents)}</p>
            <p className="mt-2 text-xs text-[#f1d6bb]">{highMultiple}x {t.basedOn}</p>
          </article>
        </section>

        <section className="mt-6 rounded-2xl border border-[#43C9FF]/35 bg-[#0f2132]/70 p-5">
          <h2 className={`${heading.className} text-2xl text-[#F6FBFF]`}>{t.fundingTitle}</h2>
          <p className="mt-2 text-sm text-[#c4d9ea]">{t.fundingSubtitle}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <article className="rounded-xl border border-white/15 bg-white/5 p-4">
              <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-[#9ac8e7]`}>
                {t.fundingLow}
              </p>
              <p className={`${heading.className} mt-2 text-3xl text-[#c9f8de]`}>{usd(raiseLowCents)}</p>
            </article>
            <article className="rounded-xl border border-[#43C9FF]/40 bg-white/5 p-4">
              <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-[#9ac8e7]`}>
                {t.fundingBase}
              </p>
              <p className={`${heading.className} mt-2 text-3xl text-white`}>{usd(raiseBaseCents)}</p>
            </article>
            <article className="rounded-xl border border-white/15 bg-white/5 p-4">
              <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-[#f8cca6]`}>
                {t.fundingHigh}
              </p>
              <p className={`${heading.className} mt-2 text-3xl text-[#ffe8cf]`}>{usd(raiseHighCents)}</p>
            </article>
          </div>
          <div className="mt-4 grid gap-3 text-sm text-[#d6e4ef] lg:grid-cols-3">
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.runway}: {targetRunwayMonths} {t.months}
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.featureScore}: {featureScore}/10
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.roadmapScore}: {roadmapScore}/10
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.marketScore}: {marketScore}/10
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.monthlyBurn}: {usd(monthlyBurnCents)}
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.roadmapBudget}: {usd(roadmapOneOffBudgetCents)}
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.gtmBudget}: {usd(marketExpansionBudgetCents)}
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.contingency}: {usd(contingencyCents)}
            </p>
          </div>
          <p className="mt-3 text-xs text-[#9fb9cc]">{t.modelAssumption}</p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/15 bg-[#101f31]/70 p-5">
          <h2 className={`${heading.className} text-2xl text-[#F6FBFF]`}>{t.calcTitle}</h2>
          <div className="mt-4 grid gap-3 text-sm text-[#d6e4ef] lg:grid-cols-2">
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.calcRevenue}: {usd(estRevenue30dCents)}
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.calcArr}: {usd(estArrCents)}
            </p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">{t.calcMultiple}</p>
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              {t.calcRatio}: {usd(paidRevenue30dCents)}. {t.calcRatioSuffix}: {(revenueCoverage * 100).toFixed(1)}%.
            </p>
          </div>
          <p className="mt-3 text-xs text-[#9fb9cc]">
            {t.disclaimer} {t.updatedAt} {now.toISOString().slice(0, 10)}.
          </p>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-white/15 bg-[#0C1A2A]/75 p-5">
            <h2 className={`${heading.className} text-2xl text-[#F6FBFF]`}>{t.whyWin}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#C7D8E8]">
              {moat.map((item) => (
                <li key={item} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-white/15 bg-[#111F31]/70 p-5">
            <h2 className={`${heading.className} text-2xl text-[#F6FBFF]`}>{t.useOfFunds}</h2>
            <div className="mt-4 space-y-3">
              {useOfFunds.map((item) => (
                <div key={item.title} className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
                  <p className={`${mono.className} text-xs uppercase tracking-[0.14em] text-[#8CB0CC]`}>{item.title}</p>
                  <p className="mt-1 text-sm text-[#D1E1EE]">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-10 rounded-2xl border border-[#6CFFA3]/40 bg-gradient-to-r from-[#6CFFA3]/15 via-[#43C9FF]/10 to-[#F7B267]/20 p-6">
          <h2 className={`${heading.className} text-2xl text-white`}>{t.ctaTitle}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[#D2E2F0]">{t.ctaText}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="mailto:founders@xpostscheduler.com?subject=Investor%20Intro"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#0E1D2D] transition hover:bg-[#eef6ff]"
            >
              {t.contact}
            </a>
            <Link
              href={withLang("/dashboard")}
              className="rounded-full border border-white/35 px-5 py-2 text-sm text-white transition hover:bg-white/10"
            >
              {t.viewProduct}
            </Link>
            <Link
              href={withLang("/admin")}
              className="rounded-full border border-white/35 px-5 py-2 text-sm text-white transition hover:bg-white/10"
            >
              {t.viewStats}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
