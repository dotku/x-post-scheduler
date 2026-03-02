export interface Trend {
  name: string;
  url?: string;
  tweetVolume?: number;
  description?: string;
}

export interface TrendingResult {
  success: boolean;
  trends?: Trend[];
  error?: string;
  location?: string;
  timestamp?: string;
}

// WOEID → GNews country code
const woeidToGNewsCountry: Record<number, string> = {
  1: "us",
  23424977: "us",
  23424856: "cn",
  23424908: "za",
  23424768: "ng",
  23424785: "eg",
  23424809: "ke",
  2988: "gb",
  23424819: "jp",
  23424829: "mx",
  23424982: "in",
};

// WOEID → newsapi.ai language
const woeidToLang: Record<number, string> = {
  1: "eng",
  23424977: "eng",
  23424856: "zho",
  23424908: "eng",
  23424768: "eng",
  23424785: "ara",
  23424809: "eng",
  2988: "eng",
  23424819: "jpn",
  23424829: "spa",
  23424982: "eng",
};

const locationMap: Record<number, string> = {
  1: "Global",
  23424977: "USA",
  23424856: "China",
  2988: "UK",
  23424819: "Japan",
  23424829: "Mexico",
  23424982: "India",
  23424908: "South Africa",
  23424768: "Nigeria",
  23424785: "Egypt",
  23424809: "Kenya",
};

// GNews 不支持所有国家，cn 用 zh 语言代替
const gNewsUnsupportedCountries: Record<string, { lang: string }> = {
  cn: { lang: "zh" },
};

/**
 * 从 GNews API 获取热门新闻（主要来源）
 * 注册免费 Key：https://gnews.io
 */
async function fetchFromGNews(country: string, apiKey: string): Promise<Trend[]> {
  const unsupported = gNewsUnsupportedCountries[country];
  const params = unsupported
    ? `lang=${unsupported.lang}&max=15`
    : `country=${country}&lang=en&max=15`;

  const url = `https://gnews.io/api/v4/top-headlines?${params}&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GNews API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const articles: any[] = data?.articles ?? [];
  return articles
    .filter((a: any) => a.title)
    .map((a: any) => ({
      name: a.title,
      url: a.url,
      description: a.source?.name ?? undefined,
    }));
}

/**
 * 从 newsapi.ai (EventRegistry) 获取补充新闻
 * 使用现有 NEWS_API_KEY（UUID 格式）
 */
async function fetchFromNewsApiAi(lang: string, apiKey: string): Promise<Trend[]> {
  const res = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      lang,
      articlesCount: 5,
      articlesSortBy: "date",
      resultType: "articles",
      forceMaxDataTimeWindow: 1,
    }),
    next: { revalidate: 900 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const articles: any[] = data?.articles?.results ?? [];
  return articles
    .filter((a: any) => a.title)
    .map((a: any) => ({
      name: a.title,
      url: a.url ?? undefined,
      description: a.body ? a.body.slice(0, 120) : undefined,
    }));
}

/**
 * 获取热门话题
 * 主要来源：GNews API（GNEWS_API_KEY）
 * 补充来源：newsapi.ai（NEWS_API_KEY）
 */
export async function fetchTrendingTopics(
  _userId: string,
  woeid: number = 1,
): Promise<TrendingResult> {
  const country = woeidToGNewsCountry[woeid] ?? "us";
  const lang = woeidToLang[woeid] ?? "eng";
  const gNewsKey = process.env.GNEWS_API_KEY;
  const newsAiKey = process.env.NEWS_API_KEY;

  if (!gNewsKey) {
    return {
      success: false,
      error: "GNEWS_API_KEY is not configured. Register at https://gnews.io to get a free key.",
    };
  }

  try {
    // 1. 主要来源：GNews
    const trends = await fetchFromGNews(country, gNewsKey);

    // 2. 补充来源：newsapi.ai（若有 Key）
    if (newsAiKey) {
      try {
        const aiItems = await fetchFromNewsApiAi(lang, newsAiKey);
        return {
          success: true,
          trends: [...trends, ...aiItems].slice(0, 20),
          location: locationMap[woeid] ?? "Custom Location",
          timestamp: new Date().toISOString(),
        };
      } catch (aiErr) {
        console.warn("newsapi.ai fetch failed:", aiErr);
      }
    }

    return {
      success: true,
      trends,
      location: locationMap[woeid] ?? "Custom Location",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching trending topics:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch trending topics",
    };
  }
}

/**
 * 从多个地区获取热门话题
 */
export async function fetchMultiRegionalTrends(
  _userId: string,
  locations: "global" | "usa" | "china" | "africa" | "all" = "global",
): Promise<{
  success: boolean;
  data?: Record<string, Trend[]>;
  error?: string;
}> {
  const woeids: Record<string, number> = {
    global: 1,
    usa: 23424977,
    china: 23424856,
    africa: 23424908,
  };

  const selectedWoeids =
    locations === "all"
      ? [1, 23424977, 23424856, 23424908]
      : locations === "africa"
        ? [23424908, 23424768, 23424785, 23424809]
        : [woeids[locations] ?? 1];

  try {
    const results = await Promise.all(
      selectedWoeids.map((woeid) => fetchTrendingTopics(_userId, woeid)),
    );

    const locationKeyMap: Record<number, string> = {
      1: "global",
      23424977: "usa",
      23424856: "china",
      23424908: "south_africa",
      23424768: "nigeria",
      23424785: "egypt",
      23424819: "kenya",
    };

    const data: Record<string, Trend[]> = {};
    results.forEach((result, index) => {
      const locationKey = locationKeyMap[selectedWoeids[index]];
      if (result.success && result.trends) {
        data[locationKey] = result.trends;
      }
    });

    return {
      success: Object.keys(data).length > 0,
      data,
    };
  } catch (error) {
    console.error("Error fetching multi-regional trends:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch trends",
    };
  }
}

export const trendRegionWoeid: Record<string, number> = {
  global: 1,
  usa: 23424977,
  china: 23424856,
  africa: 23424908,
};

/**
 * 根据地区获取 top 3 热点，构建注入 AI 生成的上下文 prompt
 * 供 recurring scheduler 和 test 路由调用
 */
export async function buildTrendPrompt(
  userId: string,
  trendRegion: string,
  basePrompt?: string | null,
): Promise<string> {
  const woeid = trendRegionWoeid[trendRegion] ?? 1;
  const result = await fetchTrendingTopics(userId, woeid);

  if (!result.success || !result.trends?.length) {
    return basePrompt ?? "";
  }

  const top3 = result.trends
    .slice(0, 3)
    .map((t) => `"${t.name}"`)
    .join(", ");

  const trendContext = `Today's top trending news for this region: ${top3}. Pick the most relevant topic for my business, connect it naturally to my business context, and create an engaging post.`;

  return basePrompt
    ? `${trendContext} Additional direction: ${basePrompt}`
    : trendContext;
}

/**
 * 从热门话题名称中提取关键词和 hashtag
 */
export function parseTrendingKeywords(trendName: string): string[] {
  const cleanName = trendName.replace(/^#/, "");
  const words = cleanName
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return [cleanName, ...words];
}
