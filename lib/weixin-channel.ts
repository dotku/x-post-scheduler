import { ScrapeResult } from "./scraper";
import { scrapeChannel as workerScrapeChannel } from "./weixin-worker-client";

const CHANNEL_HOME_URL =
  "https://channels.weixin.qq.com/web/pages/home";

/**
 * Register a Weixin Channel with basic metadata (no scraping).
 * Used when the user has no stored WeChat cookies.
 */
export async function scrapeWeixinChannel(
  channelId: string,
  channelName?: string
): Promise<ScrapeResult> {
  try {
    const homeUrl = `${CHANNEL_HOME_URL}?finderUserName=${encodeURIComponent(channelId)}`;
    const displayName = channelName || `Weixin Channel ${channelId}`;

    console.log(`[weixin-channel] Registering channel: ${channelId}`);

    const contentParts: string[] = [];
    contentParts.push(`# ${displayName}`);
    contentParts.push("");
    contentParts.push(`Channel ID: ${channelId}`);
    contentParts.push(`Source: ${homeUrl}`);
    contentParts.push("");
    contentParts.push("---");
    contentParts.push("");
    contentParts.push(
      "Connect WeChat to scrape channel content automatically, or edit this content manually."
    );

    const content = contentParts.join("\n");

    return {
      success: true,
      content,
      title: displayName,
      pagesScraped: 1,
      images: [],
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error registering Weixin Channel",
    };
  }
}

/**
 * Scrape a Weixin Channel via the Playwright worker using stored cookies.
 * Returns real content from the Channel Assistant platform.
 */
export async function scrapeWeixinChannelWithWorker(
  channelId: string,
  cookiesJson: string,
  userId?: string
): Promise<ScrapeResult> {
  try {
    const cookies = JSON.parse(cookiesJson);
    console.log(`[weixin-channel] Scraping channel via worker: ${channelId}`);

    const result = await workerScrapeChannel(cookies, channelId, userId);

    if (!result.success) {
      if (result.cookieExpired) {
        return {
          success: false,
          error: "WeChat cookies expired. Please re-connect WeChat via QR login.",
        };
      }
      return {
        success: false,
        error: result.error || "Worker scraping failed",
      };
    }

    const images = (result.images || []).map((img) => ({
      url: img.url,
      altText: img.altText,
    }));

    const thumbnails = (result.thumbnails || []).map((thumb) => ({
      url: thumb.url,
      base64Data: thumb.base64,
      altText: thumb.altText,
    }));

    return {
      success: true,
      content: result.content || "",
      title: result.title,
      pagesScraped: (result.videos?.length || 0) + 1,
      images,
      thumbnails,
      videos: result.videos,
    };
  } catch (error) {
    console.error("[weixin-channel] Worker scraping error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error scraping via worker",
    };
  }
}
