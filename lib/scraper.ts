import * as cheerio from "cheerio";

export interface ScrapeResult {
  success: boolean;
  content?: string;
  title?: string;
  pagesScraped?: number;
  error?: string;
}

interface PageContent {
  url: string;
  title: string;
  content: string;
}

// Get base URL from a full URL
function getBaseUrl(url: string): string {
  const urlObj = new URL(url);
  return `${urlObj.protocol}//${urlObj.host}`;
}

// Check if a URL is internal (same domain)
function isInternalLink(link: string, baseUrl: string): boolean {
  try {
    if (link.startsWith("/")) return true;
    if (link.startsWith("#")) return false;
    if (link.startsWith("mailto:") || link.startsWith("tel:")) return false;
    const linkUrl = new URL(link);
    const baseUrlObj = new URL(baseUrl);
    return linkUrl.host === baseUrlObj.host;
  } catch {
    return false;
  }
}

// Normalize URL to absolute
function normalizeUrl(link: string, baseUrl: string): string {
  if (link.startsWith("/")) {
    return `${getBaseUrl(baseUrl)}${link}`;
  }
  return link;
}

// Scrape a single page
async function scrapeSinglePage(url: string): Promise<PageContent | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; XPostScheduler/1.0; +https://example.com)",
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $(
      "script, style, nav, header, footer, aside, iframe, noscript, .nav, .menu, .sidebar, .advertisement, .ad, .cookie, .popup"
    ).remove();

    // Get title
    const title = $("title").text().trim() || $("h1").first().text().trim();

    // Try to find main content area
    let content = "";
    const contentSelectors = [
      "article",
      "main",
      ".content",
      ".post",
      ".entry-content",
      "#content",
      ".article-content",
      ".page-content",
      "body",
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text();
        break;
      }
    }

    content = cleanText(content);

    // For CJK languages, use lower threshold since each character carries more meaning
    const minContentLength = containsCJK(content) ? 30 : 100;
    if (content.length < minContentLength) return null; // Skip pages with too little content

    return { url, title, content };
  } catch {
    return null;
  }
}

// Extract internal links from a page
async function extractInternalLinks(
  url: string,
  baseUrl: string
): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; XPostScheduler/1.0; +https://example.com)",
      },
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    const links: Set<string> = new Set();

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href");
      if (href && isInternalLink(href, baseUrl)) {
        const normalizedUrl = normalizeUrl(href, baseUrl);
        // Skip anchors, images, documents
        if (
          !normalizedUrl.includes("#") &&
          !normalizedUrl.match(/\.(jpg|jpeg|png|gif|pdf|doc|zip|mp4|mp3)$/i)
        ) {
          links.add(normalizedUrl);
        }
      }
    });

    return Array.from(links);
  } catch {
    return [];
  }
}

// Scrape website including child pages
export async function scrapeWebsite(
  url: string,
  maxPages: number = 20
): Promise<ScrapeResult> {
  try {
    const baseUrl = getBaseUrl(url);
    const visitedUrls: Set<string> = new Set();
    const pagesToVisit: string[] = [url];
    const allContent: PageContent[] = [];

    console.log(`Starting scrape of ${url} (max ${maxPages} pages)`);

    while (pagesToVisit.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = pagesToVisit.shift()!;

      // Skip if already visited
      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);

      console.log(`Scraping: ${currentUrl}`);

      // Scrape the page
      const pageContent = await scrapeSinglePage(currentUrl);
      if (pageContent) {
        allContent.push(pageContent);
      }

      // Only extract links from the first few pages to avoid explosion
      if (visitedUrls.size <= 5) {
        const links = await extractInternalLinks(currentUrl, baseUrl);
        for (const link of links) {
          if (!visitedUrls.has(link) && !pagesToVisit.includes(link)) {
            pagesToVisit.push(link);
          }
        }
      }

      // Small delay to be respectful
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (allContent.length === 0) {
      return {
        success: false,
        error: "No content could be extracted from the website",
      };
    }

    // Combine all content
    const combinedContent = allContent
      .map((page) => `## ${page.title}\nSource: ${page.url}\n\n${page.content}`)
      .join("\n\n---\n\n");

    // Truncate if too long (keep first 50000 chars for comprehensive knowledge base)
    const finalContent =
      combinedContent.length > 50000
        ? combinedContent.substring(0, 50000) + "\n\n... (truncated)"
        : combinedContent;

    return {
      success: true,
      content: finalContent,
      title: allContent[0]?.title || "Website",
      pagesScraped: allContent.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Simple single-page scrape (kept for backwards compatibility)
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  return scrapeWebsite(url, 20);
}

// Detect if text contains significant non-ASCII characters (like Chinese, Japanese, Korean)
function containsCJK(text: string): boolean {
  // CJK Unified Ideographs range
  return /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text);
}

// Clean up scraped text - supports foreign languages including Chinese
function cleanText(text: string): string {
  const isCJK = containsCJK(text);
  // For CJK languages, each character carries more meaning, so use lower threshold
  const minLineLength = isCJK ? 5 : 20;

  return text
    .replace(/\s+/g, " ")
    .trim()
    .split("\n")
    .filter((line) => line.trim().length > minLineLength)
    .join("\n");
}
