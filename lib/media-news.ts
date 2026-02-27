import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./db";
import { randomUUID } from "node:crypto";

export type ReportPeriod = "daily" | "weekly";

export interface MediaNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description: string;
  image?: string;
}

export interface DailyMediaNewsReport {
  period: ReportPeriod;
  date: string;
  rangeStart: string;
  rangeEnd: string;
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  highlightsEn: string[];
  highlightsZh: string[];
  coverImageUrl?: string;
  sourceCount: number;
  generatedAt: string;
  usedAi: boolean;
}

interface AiDailySummary {
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  highlightsEn: string[];
  highlightsZh: string[];
}

type MediaIndustryReportDelegate = {
  upsert: (...args: unknown[]) => Promise<unknown>;
  findFirst: (...args: unknown[]) => Promise<unknown>;
  findMany: (...args: unknown[]) => Promise<unknown>;
};

type MediaIndustryReportRow = {
  period: string;
  reportDate: Date | string;
  rangeStart: Date | string;
  rangeEnd: Date | string;
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  summaryZh: string;
  highlightsEn: string;
  highlightsZh: string;
  coverImageUrl: string | null;
  sourceCount: number;
  updatedAt: Date | string;
  usedAi: boolean;
};

function getMediaIndustryReportDelegate(): MediaIndustryReportDelegate | null {
  const delegate = (prisma as unknown as { mediaIndustryReport?: unknown })
    .mediaIndustryReport;
  if (!delegate) {
    return null;
  }

  const candidate = delegate as Partial<MediaIndustryReportDelegate>;
  if (
    typeof candidate.findFirst !== "function" ||
    typeof candidate.upsert !== "function" ||
    typeof candidate.findMany !== "function"
  ) {
    return null;
  }

  return candidate as MediaIndustryReportDelegate;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfUtcDay(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
}

function startOfUtcWeekMonday(input: Date): Date {
  const dayStart = startOfUtcDay(input);
  const day = dayStart.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dayStart.setUTCDate(dayStart.getUTCDate() + diffToMonday);
  return dayStart;
}

function toIsoDate(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function getPeriodRange(
  period: ReportPeriod,
  now: Date,
): {
  reportDate: Date;
  rangeStart: Date;
  rangeEnd: Date;
} {
  if (period === "weekly") {
    const reportDate = startOfUtcWeekMonday(now);
    const rangeStart = new Date(reportDate);
    const rangeEnd = new Date(reportDate);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);
    return { reportDate, rangeStart, rangeEnd };
  }

  const reportDate = startOfUtcDay(now);
  const rangeStart = new Date(reportDate);
  const rangeEnd = new Date(reportDate);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
  return { reportDate, rangeStart, rangeEnd };
}

function normalizeText(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

function fallbackSummary(
  articles: MediaNewsArticle[],
  period: ReportPeriod,
): AiDailySummary {
  const topSources = Array.from(
    new Set(articles.map((item) => item.source)),
  ).slice(0, 4);
  const keyThemes = articles
    .map((item) => item.title)
    .slice(0, 3)
    .map((title) => title.replace(/\s+/g, " "));

  return {
    titleEn:
      period === "weekly"
        ? "Media, Social & Marketing Weekly"
        : "Media Industry Daily Brief",
    titleZh: period === "weekly" ? "传媒营销科技周报" : "传媒行业日报",
    summaryEn:
      period === "weekly"
        ? "This week’s coverage highlights platform strategy shifts, AI-enabled content workflows, and intensified distribution competition across media channels."
        : "Today’s coverage highlights platform strategy shifts, AI-enabled content workflows, and distribution competition across digital media channels.",
    summaryZh:
      period === "weekly"
        ? "本周报道聚焦平台策略变化、AI 驱动的内容工作流，以及数字媒体渠道中的分发竞争加剧。"
        : "今日报道聚焦平台策略变化、AI 驱动的内容工作流，以及数字媒体渠道中的分发竞争。",
    highlightsEn: [
      keyThemes[0]
        ? `Top headline: ${keyThemes[0]}`
        : "Top headline: Platform strategy and monetization remain central.",
      keyThemes[1]
        ? `Emerging signal: ${keyThemes[1]}`
        : "Emerging signal: AI tooling is moving from pilot to routine operations.",
      `Coverage sources include ${topSources.join(", ") || "major media outlets"}.`,
    ],
    highlightsZh: [
      keyThemes[0]
        ? `重点头条：${keyThemes[0]}`
        : "重点头条：平台策略与变现仍是核心议题。",
      keyThemes[1]
        ? `趋势信号：${keyThemes[1]}`
        : "趋势信号：AI 工具正从试点走向日常化运营。",
      `本期覆盖来源包括：${topSources.join("、") || "主流媒体"}。`,
    ],
  };
}

async function generateAiSummary(
  articles: MediaNewsArticle[],
  period: ReportPeriod,
  reportDate: string,
): Promise<AiDailySummary | null> {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 1600,
      },
    });

    const condensedArticles = articles.slice(0, 15).map((item, index) => ({
      index: index + 1,
      title: item.title,
      source: item.source,
      publishedAt: item.publishedAt,
      description: item.description,
    }));

    const prompt = `You are a senior editor at a media-industry newsletter. You write concise, specific headlines that cover multiple distinct stories — never just one headline story. Output must be valid JSON.

Create a bilingual ${period} briefing for report date ${reportDate}.

Return JSON matching this exact schema:
{
  "titleEn": string,
  "titleZh": string,
  "summaryEn": string,
  "summaryZh": string,
  "highlightsEn": string[],
  "highlightsZh": string[]
}

TITLE RULES (critical):
- The title MUST combine 2 DIFFERENT stories or themes from the article list — pick the two most interesting that contrast or complement each other.
- FORBIDDEN: Using only the single biggest headline as the entire title.
- FORBIDDEN words: "developments", "innovations", "challenges", "strategic partnerships", "new era", "landscape", "emerging trends", "industry news", "roundup", "wrap".
- WRONG (single story): "Netflix Exits WBD-Paramount Bid"
- WRONG (generic): "Media Industry Developments: Streaming and AI"
- RIGHT (two stories): "Netflix Exits Paramount Bid; Meta Tests AI-Generated Ads on Reels"
- RIGHT (two stories): "YouTube Expands Shorts Monetization as Spotify Reports Record Podcast Revenue"
- titleZh should follow the same two-story structure, using "；" as separator or natural conjunction.

CONTENT RULES:
- Articles tagged [INDUSTRY] are professional trade news (media companies, platforms, ad industry). Prioritize these.
- Articles tagged [CONTEXT] are broader social/tech events that affect the media industry. Use as supporting context.
- summaryEn and summaryZh: 2–3 sentences. Lead with trade/industry angle, then note relevant societal context.
- highlightsEn and highlightsZh: exactly 8 bullets each — 6 from [INDUSTRY] articles, 2 from [CONTEXT] articles.
  - [INDUSTRY] bullets: specific trade facts (revenue figures, platform moves, company strategies).
  - [CONTEXT] bullets: prefix with "【社会影响】" (zh) or "【Society】" (en) so readers can distinguish.
- Prioritize articles with the most recent publishedAt date.
- Professional trade publication tone (like Ad Age, Digiday, or The Drum).
- If period is weekly, surface strategic signals over single-day events.

Articles:
${JSON.stringify(condensedArticles, null, 2)}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AiDailySummary>;
    const titleEn = normalizeText(
      parsed.titleEn,
      period === "weekly"
        ? "Media, Social & Marketing Weekly"
        : "Media Industry Daily Brief",
    );
    const titleZh = normalizeText(
      parsed.titleZh,
      period === "weekly" ? "传媒营销科技周报" : "传媒行业日报",
    );
    const summaryEn = normalizeText(
      parsed.summaryEn,
      "Media coverage focuses on platform strategy, AI integration, and audience distribution dynamics.",
    );
    const summaryZh = normalizeText(
      parsed.summaryZh,
      "媒体报道聚焦平台策略、AI 融合与受众分发格局变化。",
    );

    const highlightsEn = (parsed.highlightsEn ?? [])
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item))
      .slice(0, 8);
    const highlightsZh = (parsed.highlightsZh ?? [])
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item))
      .slice(0, 8);

    if (!summaryEn || !summaryZh) {
      return null;
    }

    return {
      titleEn,
      titleZh,
      summaryEn,
      summaryZh,
      highlightsEn:
        highlightsEn.length >= 6
          ? highlightsEn
          : fallbackSummary(articles, period).highlightsEn,
      highlightsZh:
        highlightsZh.length >= 6
          ? highlightsZh
          : fallbackSummary(articles, period).highlightsZh,
    };
  } catch (error) {
    console.error("Failed to generate AI media summary:", error);
    return null;
  }
}

function parseStringArray(input: string): string[] {
  try {
    const parsed = JSON.parse(input) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}


function mapStoredReport(row: MediaIndustryReportRow): DailyMediaNewsReport {
  const reportDate =
    row.reportDate instanceof Date ? row.reportDate : new Date(row.reportDate);
  const rangeStart =
    row.rangeStart instanceof Date ? row.rangeStart : new Date(row.rangeStart);
  const rangeEnd =
    row.rangeEnd instanceof Date ? row.rangeEnd : new Date(row.rangeEnd);
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt);

  return {
    period: row.period as ReportPeriod,
    date: toIsoDate(reportDate),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    titleEn: row.titleEn,
    titleZh: row.titleZh,
    summaryEn: row.summaryEn,
    summaryZh: row.summaryZh,
    highlightsEn: parseStringArray(row.highlightsEn),
    highlightsZh: parseStringArray(row.highlightsZh),
    coverImageUrl: row.coverImageUrl ?? undefined,
    sourceCount: row.sourceCount ?? 0,
    generatedAt: updatedAt.toISOString(),
    usedAi: row.usedAi,
  };
}

async function saveMediaIndustryReportRaw(
  report: DailyMediaNewsReport,
): Promise<DailyMediaNewsReport> {
  const reportDate = new Date(`${report.date}T00:00:00.000Z`);
  const rowId = randomUUID();
  const rangeStart = new Date(report.rangeStart);
  const rangeEnd = new Date(report.rangeEnd);
  const highlightsEn = JSON.stringify(report.highlightsEn);
  const highlightsZh = JSON.stringify(report.highlightsZh);

  await prisma.$executeRaw`
    INSERT INTO "MediaIndustryReport"
      ("id", "period", "reportDate", "rangeStart", "rangeEnd", "titleEn", "titleZh", "summaryEn", "summaryZh", "highlightsEn", "highlightsZh", "coverImageUrl", "sourceCount", "usedAi", "createdAt", "updatedAt")
    VALUES
      (${rowId}, ${report.period}, ${reportDate}, ${rangeStart}, ${rangeEnd}, ${report.titleEn}, ${report.titleZh}, ${report.summaryEn}, ${report.summaryZh}, ${highlightsEn}, ${highlightsZh}, ${report.coverImageUrl ?? null}, ${report.sourceCount}, ${report.usedAi}, NOW(), NOW())
    ON CONFLICT ("period", "reportDate")
    DO UPDATE SET
      "rangeStart" = EXCLUDED."rangeStart",
      "rangeEnd" = EXCLUDED."rangeEnd",
      "titleEn" = EXCLUDED."titleEn",
      "titleZh" = EXCLUDED."titleZh",
      "summaryEn" = EXCLUDED."summaryEn",
      "summaryZh" = EXCLUDED."summaryZh",
      "highlightsEn" = EXCLUDED."highlightsEn",
      "highlightsZh" = EXCLUDED."highlightsZh",
      "coverImageUrl" = EXCLUDED."coverImageUrl",
      "sourceCount" = EXCLUDED."sourceCount",
      "usedAi" = EXCLUDED."usedAi",
      "updatedAt" = NOW()
  `;

  const rows = await prisma.$queryRaw<MediaIndustryReportRow[]>`
    SELECT
      "period",
      "reportDate",
      "rangeStart",
      "rangeEnd",
      "titleEn",
      "titleZh",
      "summaryEn",
      "summaryZh",
      "highlightsEn",
      "highlightsZh",
      "coverImageUrl",
      "sourceCount",
      "updatedAt",
      "usedAi"
    FROM "MediaIndustryReport"
    WHERE "period" = ${report.period} AND "reportDate" = ${reportDate}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new Error("MediaIndustryReport saved but failed to read back row.");
  }

  return mapStoredReport(rows[0]);
}

async function getLatestStoredMediaIndustryReportRaw(
  period: ReportPeriod,
): Promise<DailyMediaNewsReport | null> {
  const rows = await prisma.$queryRaw<MediaIndustryReportRow[]>`
    SELECT
      "period",
      "reportDate",
      "rangeStart",
      "rangeEnd",
      "titleEn",
      "titleZh",
      "summaryEn",
      "summaryZh",
      "highlightsEn",
      "highlightsZh",
      "coverImageUrl",
      "sourceCount",
      "updatedAt",
      "usedAi"
    FROM "MediaIndustryReport"
    WHERE "period" = ${period}
    ORDER BY "reportDate" DESC
    LIMIT 1
  `;

  if (!rows[0]) {
    return null;
  }

  return mapStoredReport(rows[0]);
}

async function listStoredMediaIndustryReportsRaw(
  period: ReportPeriod,
  limit: number,
): Promise<DailyMediaNewsReport[]> {
  const rows = await prisma.$queryRaw<MediaIndustryReportRow[]>`
    SELECT
      "period",
      "reportDate",
      "rangeStart",
      "rangeEnd",
      "titleEn",
      "titleZh",
      "summaryEn",
      "summaryZh",
      "highlightsEn",
      "highlightsZh",
      "coverImageUrl",
      "sourceCount",
      "updatedAt",
      "usedAi"
    FROM "MediaIndustryReport"
    WHERE "period" = ${period}
    ORDER BY "reportDate" DESC
    LIMIT ${limit}
  `;

  return rows.map(mapStoredReport);
}

// ── RSS feeds — curated media/marketing/tech outlets ─────────────────────────

const MEDIA_INDUSTRY_RSS: Array<{ name: string; url: string }> = [
  { name: "Digiday", url: "https://digiday.com/feed/" },
  { name: "Adweek", url: "https://www.adweek.com/feed/" },
  { name: "Nieman Lab", url: "https://niemanlab.org/feed/" },
  { name: "Social Media Today", url: "https://www.socialmediatoday.com/rss.xml" },
  { name: "The Drum", url: "https://www.thedrum.com/rss.xml" },
  { name: "Marketing Week", url: "https://www.marketingweek.com/feed/" },
  { name: "Ad Age", url: "https://adage.com/rss.xml" },
  { name: "MediaPost", url: "https://www.mediapost.com/publications/articles.rss" },
];

function extractCdata(raw: string): string {
  return raw.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function parseRssXml(xml: string, sourceName: string): MediaNewsArticle[] {
  const items: MediaNewsArticle[] = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const title = extractCdata(rawTitle).trim();

    const rawLink =
      block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ??
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() ??
      "";
    const url = extractCdata(rawLink).trim();

    const rawDesc =
      block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)?.[1] ??
      block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ??
      "";
    const description = extractCdata(rawDesc)
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);

    const pubDateRaw =
      block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ??
      block.match(/<dc:date>([\s\S]*?)<\/dc:date>/)?.[1]?.trim() ??
      "";
    let publishedAt = todayIsoDate();
    if (pubDateRaw) {
      try {
        const d = new Date(pubDateRaw);
        if (!isNaN(d.getTime())) publishedAt = d.toISOString().slice(0, 10);
      } catch {
        // keep today as fallback
      }
    }

    const image =
      block.match(/url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i)?.[1] ??
      block.match(/<media:content[^>]+url="([^"]+)"/)?.[1] ??
      block.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1];

    if (title && url && url.startsWith("http")) {
      items.push({ title, url, source: sourceName, publishedAt, description, image });
    }
  }
  return items;
}

// RSS feeds always return the latest content from each outlet.
// We do NOT date-filter them — just take the freshest N articles per feed
// so every daily run gets genuinely different articles.
const RSS_ARTICLES_PER_FEED = 4;

async function fetchRssArticles(): Promise<MediaNewsArticle[]> {
  const results = await Promise.allSettled(
    MEDIA_INDUSTRY_RSS.map(async ({ name, url }) => {
      const res = await fetch(url, {
        next: { revalidate: 3600 },
        headers: { "User-Agent": "Mozilla/5.0 (compatible; xPilotBot/1.0)" },
      });
      if (!res.ok) return [] as MediaNewsArticle[];
      const xml = await res.text();
      // parseRssXml returns items in feed order (newest first for well-formed feeds)
      return parseRssXml(xml, name).slice(0, RSS_ARTICLES_PER_FEED);
    }),
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// ── EventRegistry / newsapi.ai ────────────────────────────────────────────────

type EventRegistryArticle = {
  title?: string;
  url?: string;
  body?: string;
  image?: string;
  dateTime?: string;
  source?: { title?: string };
};

async function fetchEventRegistryArticles(
  period: ReportPeriod,
  from: string,
  to: string,
  isHistorical: boolean,
): Promise<MediaNewsArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  // For historical dates, use a single broad query to conserve API quota
  // (free plan: 100 req/day). For current/recent dates, use 3 focused queries
  // for better topic diversity.
  const queries = isHistorical
    ? [
        "Meta OR TikTok OR YouTube OR Netflix OR Spotify OR Google OR Apple OR Amazon " +
          "advertising revenue streaming creator monetization digital media publishing",
      ]
    : [
        "Meta OR TikTok OR YouTube OR Snapchat advertising revenue creator monetization",
        "Google OR Apple OR Amazon OR X platform digital media strategy",
        "Netflix OR Spotify OR Disney streaming AI newsroom publishing",
      ];
  const articlesCount = period === "weekly" ? 40 : isHistorical ? 30 : 20;

  const buckets = await Promise.allSettled(
    queries.map(async (keyword) => {
      const body: Record<string, unknown> = {
        apiKey,
        action: "getArticles",
        keyword,
        keywordLoc: "title,body",
        dateStart: from,
        dateEnd: to,
        lang: "eng",
        sortBy: "date",
        sortByAsc: false,
        articlesPage: 1,
        articlesCount,
        resultType: "articles",
        dataType: ["news", "blog"],
      };
      // forceMaxDataTimeWindow is relative to TODAY, so skip it for historical dates
      // (it would intersect with dateStart/dateEnd and return 0 results).
      if (!isHistorical) {
        body.forceMaxDataTimeWindow = period === "weekly" ? 14 : 2;
      }

      const res = await fetch(
        "https://eventregistry.org/api/v1/article/getArticles",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store", // always fetch fresh — no cache during report generation
        },
      );
      if (!res.ok) return [] as MediaNewsArticle[];

      const data = (await res.json()) as {
        articles?: { results?: EventRegistryArticle[] };
      };

      return (data.articles?.results ?? []).map(
        (a): MediaNewsArticle => ({
          title: normalizeText(a.title, "Untitled"),
          url: normalizeText(a.url, ""),
          source: normalizeText(a.source?.title, "Unknown source"),
          publishedAt: a.dateTime ? a.dateTime.slice(0, 10) : todayIsoDate(),
          description: normalizeText(
            a.body?.slice(0, 400),
            "Latest media and technology industry coverage.",
          ),
          image: a.image?.trim(),
        }),
      );
    }),
  );

  return buckets.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// ── GNews ─────────────────────────────────────────────────────────────────────

async function fetchGnewsArticles(
  from: string,
  to: string,
): Promise<MediaNewsArticle[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];

  const queryGroups = [
    "retail media OR adtech OR programmatic OR performance marketing",
    "social media platform OR creator economy OR digital advertising",
    "newsroom OR media business OR streaming platform",
  ];

  const buckets = await Promise.allSettled(
    queryGroups.map(async (queryText) => {
      const query = encodeURIComponent(queryText);
      const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&country=us&max=10&sortby=publishedAt&from=${from}&to=${to}&apikey=${apiKey}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return [] as MediaNewsArticle[];
      const data = (await res.json()) as {
        articles?: Array<{
          title?: string;
          url?: string;
          description?: string;
          publishedAt?: string;
          image?: string;
          source?: { name?: string };
        }>;
      };
      return (data.articles ?? []).map((item) => ({
        title: normalizeText(item.title, "Untitled"),
        url: normalizeText(item.url, ""),
        source: normalizeText(item.source?.name, "Unknown source"),
        publishedAt: normalizeText(item.publishedAt, todayIsoDate()),
        description: normalizeText(
          item.description,
          "Latest media and technology industry coverage from public news sources.",
        ),
        image: item.image?.trim(),
      }));
    }),
  );

  return buckets.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// ── The Guardian ──────────────────────────────────────────────────────────────
// Free API key at: https://bonobo.capi.gutools.co.uk/register/developer
// No daily quota limit (just 12 req/sec rate limit). Full archive since 1999.

type GuardianArticle = {
  webTitle?: string;
  webUrl?: string;
  webPublicationDate?: string;
  fields?: { trailText?: string; bodyText?: string; thumbnail?: string };
};

async function fetchGuardianArticles(
  from: string,
  to: string,
): Promise<MediaNewsArticle[]> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) return [];

  // Two query strategies:
  // 1. section=media  → Guardian's dedicated media industry section (professional trade news)
  // 2. keyword search → broader social/tech context that affects the industry
  // Each article gets a category tag so the AI can separate them in its output.
  const queryConfigs: Array<{ params: Record<string, string>; tag: string }> = [
    {
      params: { section: "media", "page-size": "12" },
      tag: "INDUSTRY",
    },
    {
      params: {
        q: "advertising OR \"creator economy\" OR streaming OR \"digital media\" OR \"social media platform\"",
        section: "technology,business",
        "page-size": "8",
      },
      tag: "CONTEXT",
    },
  ];

  const buckets = await Promise.allSettled(
    queryConfigs.map(async ({ params: extraParams, tag }) => {
      const params = new URLSearchParams({
        "from-date": from,
        "to-date": to,
        "order-by": "newest",
        "show-fields": "trailText,bodyText,thumbnail",
        "api-key": apiKey,
        ...extraParams,
      });
      const res = await fetch(
        `https://content.guardianapis.com/search?${params}`,
        { cache: "no-store" },
      );
      if (!res.ok) return [] as MediaNewsArticle[];
      const data = (await res.json()) as {
        response?: { results?: GuardianArticle[] };
      };
      return (data.response?.results ?? []).map((a): MediaNewsArticle => ({
        title: normalizeText(a.webTitle, "Untitled"),
        url: normalizeText(a.webUrl, ""),
        // Embed category tag in source so AI can distinguish trade vs context news.
        source: `The Guardian [${tag}]`,
        publishedAt: a.webPublicationDate
          ? a.webPublicationDate.slice(0, 10)
          : todayIsoDate(),
        description: normalizeText(
          (a.fields?.bodyText ?? a.fields?.trailText)
            ?.replace(/<[^>]+>/g, "")
            .slice(0, 800),
          "Media industry coverage from The Guardian.",
        ),
        image: a.fields?.thumbnail?.trim(),
      }));
    }),
  );

  return buckets.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// ── Combined fetcher ──────────────────────────────────────────────────────────

function parseDateMs(dateStr: string): number {
  try {
    // new Date() handles both "YYYY-MM-DD" and full ISO strings like "2026-02-26T12:34:56Z"
    const ms = new Date(dateStr).getTime();
    return isNaN(ms) ? 0 : ms;
  } catch {
    return 0;
  }
}

async function fetchMediaArticles(
  period: ReportPeriod,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<MediaNewsArticle[]> {
  // Historical = target date ended before today UTC start.
  // For historical runs: use a strict 1-day window (no overlap with adjacent days),
  // skip RSS (always returns today's articles), and skip forceMaxDataTimeWindow
  // in EventRegistry (it's relative to today, not the requested date range).
  const todayUtcStart = startOfUtcDay(new Date());
  const isHistorical = rangeEnd.getTime() <= todayUtcStart.getTime();

  // Lookback window:
  // - Historical: strict 1 day — each date gets ONLY its own day's articles,
  //   preventing the same dominant story from bleeding into every consecutive day.
  // - Today: 2 days — catches articles published early UTC that were filed "yesterday".
  // - Weekly: 14 days for broad coverage.
  const lookbackDays = period === "weekly" ? 14 : isHistorical ? 1 : 2;
  const expandedStart = new Date(rangeStart);
  expandedStart.setUTCDate(expandedStart.getUTCDate() - (lookbackDays - 1));
  const from = toIsoDate(expandedStart);
  const to = toIsoDate(new Date(rangeEnd.getTime() - 1000));

  // Fetch all source families in parallel.
  // Guardian    → no daily quota, full archive since 1999. Primary for historical.
  // EventRegistry → 100 req/day free. 1 query for historical, 3 for today.
  // GNews       → supplementary, English US focused.
  // RSS         → always fresh — skip for historical (would return today's articles).
  const [guardianArticles, erArticles, gnewsArticles, rssArticles] =
    await Promise.all([
      fetchGuardianArticles(from, to),
      fetchEventRegistryArticles(period, from, to, isHistorical),
      fetchGnewsArticles(from, to),
      isHistorical ? Promise.resolve([] as MediaNewsArticle[]) : fetchRssArticles(),
    ]);

  // Merge, sort newest-first so freshest articles survive the dedup slice.
  const merged = [...guardianArticles, ...erArticles, ...gnewsArticles, ...rssArticles].sort(
    (a, b) => parseDateMs(b.publishedAt) - parseDateMs(a.publishedAt),
  );

  const seen = new Set<string>();
  return merged
    .filter((item): item is MediaNewsArticle =>
      Boolean(item?.title && item?.url),
    )
    .filter((item) => {
      const key = `${item.url}::${item.title.toLowerCase()}`;
      if (!item.url || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, period === "weekly" ? 25 : 18);
}

export async function generateMediaIndustryReport(
  period: ReportPeriod = "daily",
  now: Date = new Date(),
): Promise<DailyMediaNewsReport | null> {
  const { reportDate, rangeStart, rangeEnd } = getPeriodRange(period, now);
  const sources = await fetchMediaArticles(period, rangeStart, rangeEnd);
  if (sources.length === 0) {
    return null;
  }

  const aiSummary = await generateAiSummary(sources, period, toIsoDate(reportDate));
  const fallback = fallbackSummary(sources, period);
  const summary = aiSummary ?? fallback;
  const coverImageUrl = sources.find((item) => item.image)?.image;

  return {
    period,
    date: toIsoDate(reportDate),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    titleEn: summary.titleEn,
    titleZh: summary.titleZh,
    summaryEn: summary.summaryEn,
    summaryZh: summary.summaryZh,
    highlightsEn: summary.highlightsEn,
    highlightsZh: summary.highlightsZh,
    coverImageUrl,
    sourceCount: sources.length,
    generatedAt: new Date().toISOString(),
    usedAi: Boolean(aiSummary),
  };
}

export async function saveMediaIndustryReport(
  report: DailyMediaNewsReport,
): Promise<DailyMediaNewsReport> {
  const delegate = getMediaIndustryReportDelegate();
  if (!delegate) {
    return saveMediaIndustryReportRaw(report);
  }

  try {
    const saved = (await delegate.upsert({
      where: {
        period_reportDate: {
          period: report.period,
          reportDate: new Date(`${report.date}T00:00:00.000Z`),
        },
      },
      create: {
        period: report.period,
        reportDate: new Date(`${report.date}T00:00:00.000Z`),
        rangeStart: new Date(report.rangeStart),
        rangeEnd: new Date(report.rangeEnd),
        titleEn: report.titleEn,
        titleZh: report.titleZh,
        summaryEn: report.summaryEn,
        summaryZh: report.summaryZh,
        highlightsEn: JSON.stringify(report.highlightsEn),
        highlightsZh: JSON.stringify(report.highlightsZh),
        coverImageUrl: report.coverImageUrl,
        sourceCount: report.sourceCount,
        usedAi: report.usedAi,
      },
      update: {
        rangeStart: new Date(report.rangeStart),
        rangeEnd: new Date(report.rangeEnd),
        titleEn: report.titleEn,
        titleZh: report.titleZh,
        summaryEn: report.summaryEn,
        summaryZh: report.summaryZh,
        highlightsEn: JSON.stringify(report.highlightsEn),
        highlightsZh: JSON.stringify(report.highlightsZh),
        coverImageUrl: report.coverImageUrl,
        sourceCount: report.sourceCount,
        usedAi: report.usedAi,
      },
    })) as MediaIndustryReportRow;

    return mapStoredReport(saved);
  } catch (error) {
    console.error("Failed to persist media industry report:", error);
    throw error;
  }
}

// ── Source article persistence ────────────────────────────────────────────────

export async function saveSourceArticles(
  articles: MediaNewsArticle[],
  reportDate: string,
  period: ReportPeriod,
): Promise<void> {
  if (articles.length === 0) return;

  // Upsert each article. Use ON CONFLICT DO NOTHING to skip duplicates cleanly.
  for (const article of articles) {
    if (!article.url || !article.title) continue;
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "MediaNewsSource"
        ("id","reportDate","period","title","url","source","publishedAt","description","imageUrl","createdAt")
      VALUES
        (${id},${reportDate},${period},${article.title},${article.url},${article.source},${article.publishedAt},${article.description},${article.image ?? null},NOW())
      ON CONFLICT ("reportDate","period","url") DO NOTHING
    `;
  }
}

export async function getSourceArticles(
  reportDate: string,
  period: ReportPeriod,
): Promise<MediaNewsArticle[]> {
  type Row = {
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    description: string;
    imageUrl: string | null;
  };

  try {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT "title","url","source","publishedAt","description","imageUrl"
      FROM "MediaNewsSource"
      WHERE "reportDate" = ${reportDate} AND "period" = ${period}
      ORDER BY "publishedAt" DESC
    `;
    return rows.map((r) => ({
      title: r.title,
      url: r.url,
      source: r.source,
      publishedAt: r.publishedAt,
      description: r.description,
      image: r.imageUrl ?? undefined,
    }));
  } catch {
    return [];
  }
}

// Delete source articles (and reports) older than retentionDays (default 90 days).
export async function deleteOldMediaNewsData(
  retentionDays = 90,
): Promise<{ sourcesDeleted: number; reportsDeleted: number }> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffStr = toIsoDate(cutoff); // "YYYY-MM-DD" for MediaNewsSource

  const [sourcesResult, reportsResult] = await Promise.all([
    prisma.$executeRaw`
      DELETE FROM "MediaNewsSource" WHERE "reportDate" < ${cutoffStr}
    `,
    prisma.$executeRaw`
      DELETE FROM "MediaIndustryReport" WHERE "reportDate" < ${cutoff}
    `,
  ]);

  return {
    sourcesDeleted: Number(sourcesResult),
    reportsDeleted: Number(reportsResult),
  };
}

export async function generateAndStoreMediaIndustryReport(
  period: ReportPeriod,
  now: Date = new Date(),
): Promise<DailyMediaNewsReport | null> {
  // Inline the generation steps so we keep a handle on `sources` for persistence.
  const { reportDate, rangeStart, rangeEnd } = getPeriodRange(period, now);
  const sources = await fetchMediaArticles(period, rangeStart, rangeEnd);
  if (sources.length === 0) return null;

  const aiSummary = await generateAiSummary(sources, period, toIsoDate(reportDate));
  const fallback = fallbackSummary(sources, period);
  const summary = aiSummary ?? fallback;
  const coverImageUrl = sources.find((item) => item.image)?.image;

  const report: DailyMediaNewsReport = {
    period,
    date: toIsoDate(reportDate),
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
    titleEn: summary.titleEn,
    titleZh: summary.titleZh,
    summaryEn: summary.summaryEn,
    summaryZh: summary.summaryZh,
    highlightsEn: summary.highlightsEn,
    highlightsZh: summary.highlightsZh,
    coverImageUrl,
    sourceCount: sources.length,
    generatedAt: new Date().toISOString(),
    usedAi: Boolean(aiSummary),
  };

  const saved = await saveMediaIndustryReport(report);

  // Persist source articles best-effort (don't fail the whole run if this errors).
  saveSourceArticles(sources, toIsoDate(reportDate), period).catch((err) =>
    console.error("Failed to save source articles:", err),
  );

  return saved;
}

export async function getLatestStoredMediaIndustryReport(
  period: ReportPeriod,
): Promise<DailyMediaNewsReport | null> {
  const delegate = getMediaIndustryReportDelegate();
  if (!delegate) {
    try {
      return await getLatestStoredMediaIndustryReportRaw(period);
    } catch (error) {
      console.error("Failed to read stored media report via raw query:", error);
      return null;
    }
  }

  let row: MediaIndustryReportRow | null = null;

  try {
    row = (await delegate.findFirst({
      where: { period },
      orderBy: { reportDate: "desc" },
    })) as typeof row;
  } catch (error) {
    console.error("Failed to read stored media industry report:", error);
    return null;
  }

  if (!row) return null;
  return mapStoredReport(row);
}

export async function getReportByDate(
  date: string,
  period: ReportPeriod = "daily",
): Promise<DailyMediaNewsReport | null> {
  const delegate = getMediaIndustryReportDelegate();
  const reportDate = new Date(`${date}T00:00:00.000Z`);

  if (!delegate) {
    try {
      const rows = await prisma.$queryRaw<MediaIndustryReportRow[]>`
        SELECT "period","reportDate","rangeStart","rangeEnd",
          "titleEn","titleZh","summaryEn","summaryZh",
          "highlightsEn","highlightsZh","coverImageUrl","sourceCount","updatedAt","usedAi"
        FROM "MediaIndustryReport"
        WHERE "period" = ${period} AND "reportDate" = ${reportDate}
        LIMIT 1
      `;
      if (!rows[0]) return null;
      return mapStoredReport(rows[0]);
    } catch {
      return null;
    }
  }

  try {
    const row = (await delegate.findFirst({
      where: { period, reportDate },
    })) as MediaIndustryReportRow | null;
    if (!row) return null;
    return mapStoredReport(row);
  } catch {
    return null;
  }
}

export async function fetchDailyMediaTechNews(): Promise<DailyMediaNewsReport | null> {
  const stored = await getLatestStoredMediaIndustryReport("daily");
  if (stored) return stored;
  return null;
}

export async function listStoredMediaIndustryReports(
  period: ReportPeriod,
  limit: number = 20,
): Promise<DailyMediaNewsReport[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const delegate = getMediaIndustryReportDelegate();

  if (!delegate) {
    try {
      return await listStoredMediaIndustryReportsRaw(period, safeLimit);
    } catch (error) {
      console.error(
        "Failed to list stored media reports via raw query:",
        error,
      );
      return [];
    }
  }

  try {
    const rows = (await delegate.findMany({
      where: { period },
      orderBy: { reportDate: "desc" },
      take: safeLimit,
    })) as MediaIndustryReportRow[];

    return rows.map(mapStoredReport);
  } catch (error) {
    console.error("Failed to list stored media reports:", error);
    return [];
  }
}
