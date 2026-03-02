import { getBrowser } from "./browser-pool.js";
import type { CookieData, ScrapeResponse, ThumbnailData, VideoMeta } from "../types.js";

const PLATFORM_URL = "https://channels.weixin.qq.com/platform";

// Timeout for individual screenshot operations (fonts may block indefinitely)
const SCREENSHOT_TIMEOUT = 15000;

// API paths that the Channel Assistant SPA calls internally
const POST_LIST_API_PATTERNS = [
  "/cgi-bin/mmfinderassistant-bin/post/post_list",
  "/cgi-bin/mmfinderassistant-bin/post/post_get",
  "/cgi-bin/mmfinderassistant-bin/helper/helper_upload_params",
  "post_list",
  "finder/post",
];

export async function scrapeChannel(
  cookies: CookieData[],
  channelId?: string
): Promise<ScrapeResponse> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "zh-CN",
    viewport: { width: 1280, height: 800 },
  });

  try {
    // Set cookies before navigating
    await context.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
      }))
    );

    const page = await context.newPage();

    // Collect intercepted API responses
    const interceptedData: Array<Record<string, unknown>> = [];
    // Track ALL network requests for debugging
    const allApiUrls: string[] = [];

    // Log ALL network requests to discover API patterns
    page.on("response", async (response) => {
      const url = response.url();
      const status = response.status();

      // Log all non-static requests from channels.weixin.qq.com
      if (
        url.includes("channels.weixin.qq.com") &&
        !url.endsWith(".js") &&
        !url.endsWith(".css") &&
        !url.endsWith(".png") &&
        !url.endsWith(".jpg") &&
        !url.endsWith(".svg") &&
        !url.endsWith(".woff") &&
        !url.endsWith(".woff2") &&
        !url.includes("/platform/post/list") &&
        !url.includes("/platform/home")
      ) {
        allApiUrls.push(`[${status}] ${url.substring(0, 200)}`);
        console.log(`[scraper] Network: [${status}] ${url.substring(0, 200)}`);
      }

      // Capture any JSON response from channels.weixin.qq.com (broader matching)
      // Note: Channel Assistant APIs return HTTP 201, not 200
      if (
        url.includes("channels.weixin.qq.com") &&
        (status === 200 || status === 201) &&
        !url.endsWith(".js") &&
        !url.endsWith(".css")
      ) {
        try {
          const contentType = response.headers()["content-type"] || "";
          // Log content-type for post_list specifically
          if (url.includes("post_list") || url.includes("post/list")) {
            console.log(`[scraper] POST_LIST content-type: ${contentType}, status: ${status}`);
          }

          if (contentType.includes("json") || contentType.includes("octet-stream") || contentType.includes("text") || contentType.includes("protobuf")) {
            const text = await response.text().catch(() => "");

            // Extra logging for post_list
            if (url.includes("post_list") || url.includes("post/list")) {
              console.log(`[scraper] POST_LIST body length: ${text.length}`);
              console.log(`[scraper] POST_LIST body starts with: ${text.substring(0, 100)}`);
              console.log(`[scraper] POST_LIST body sample: ${text.substring(0, 500)}`);
            }

            if (text && text.startsWith("{")) {
              const body = JSON.parse(text);
              console.log(`[scraper] JSON response from: ${url.substring(0, 120)}`);
              console.log(`[scraper] JSON keys: ${Object.keys(body).join(", ")}`);
              // Log a preview of the data structure
              const preview = JSON.stringify(body).substring(0, 300);
              console.log(`[scraper] JSON preview: ${preview}`);
              interceptedData.push(body);
            }
          }
        } catch {
          // Ignore
        }
      }
    });

    // Navigate to the platform — try home first, then post list
    // The home page is what the user sees after QR login, so it's more reliable
    let targetUrl = `${PLATFORM_URL}/home`;
    console.log(`[scraper] Navigating to ${targetUrl}...`);

    try {
      // Use "commit" (fires on HTTP response) — TLS to WeChat from Fly.io is very slow
      await page.goto(targetUrl, { waitUntil: "commit", timeout: 120000 });
      console.log("[scraper] HTTP response received, waiting for JS to execute...");
      try {
        await page.waitForLoadState("load", { timeout: 90000 });
        console.log("[scraper] Page fully loaded");
      } catch {
        console.log("[scraper] Page load timed out, continuing anyway...");
      }
    } catch (navError) {
      console.log(`[scraper] Home navigation failed: ${navError}, trying post/list...`);
      targetUrl = `${PLATFORM_URL}/post/list`;
      await page.goto(targetUrl, { waitUntil: "commit", timeout: 120000 });
      try {
        await page.waitForLoadState("load", { timeout: 90000 });
      } catch {
        console.log("[scraper] Post list load timed out, continuing anyway...");
      }
    }

    // Check if we got redirected to login (cookies expired)
    const currentUrl = page.url();
    console.log(`[scraper] Current URL after navigation: ${currentUrl}`);

    if (currentUrl.includes("/login")) {
      return {
        success: false,
        error: "Cookies expired or invalid, please re-login",
        cookieExpired: true,
      };
    }

    // Wait for the SPA to fully render and make its API calls
    console.log("[scraper] Waiting for SPA to load data...");
    await page.waitForTimeout(5000);

    // If we're on home, navigate to post list to trigger the post list API
    if (!currentUrl.includes("/post/list")) {
      console.log("[scraper] Navigating to post list...");
      try {
        await page.goto(`${PLATFORM_URL}/post/list`, {
          waitUntil: "commit",
          timeout: 120000,
        });
        try {
          await page.waitForLoadState("load", { timeout: 90000 });
        } catch {
          console.log("[scraper] Post list load timed out, continuing...");
        }
        await page.waitForTimeout(5000);
      } catch {
        console.log("[scraper] Post list navigation failed, continuing with current data...");
      }
    }

    // Try scrolling to trigger loading more content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    // Take a diagnostic screenshot of the page state
    const pageTitle = await page.title();
    console.log(`[scraper] Page: ${page.url()} — "${pageTitle}"`);
    console.log(`[scraper] Intercepted ${interceptedData.length} API responses`);

    // Log ALL network requests for debugging
    console.log(`[scraper] Total API URLs captured: ${allApiUrls.length}`);
    for (const apiUrl of allApiUrls) {
      console.log(`[scraper] API: ${apiUrl}`);
    }

    // Take a screenshot for debugging — use CDP to bypass font-loading timeout
    let screenshotBase64 = "";
    try {
      const cdp = await page.context().newCDPSession(page);
      const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
      });
      screenshotBase64 = `data:image/png;base64,${result.data}`;
      console.log("[scraper] CDP screenshot taken successfully");
    } catch (e) {
      console.log(`[scraper] CDP screenshot failed: ${e instanceof Error ? e.message : e}`);
      try {
        const buffer = await page.screenshot({ fullPage: false, timeout: SCREENSHOT_TIMEOUT });
        screenshotBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
      } catch {
        console.log("[scraper] Fallback screenshot also failed");
      }
    }

    // Log the page's DOM structure for debugging
    const domInfo = await page.evaluate(() => {
      const body = document.body;
      const elements = body.querySelectorAll("*");
      const classNames = new Set<string>();
      elements.forEach((el) => {
        if (el.className && typeof el.className === "string") {
          el.className.split(/\s+/).forEach((cls) => {
            if (cls.length > 3 && cls.length < 40) classNames.add(cls);
          });
        }
      });

      // Get main content area text (skip sidebar)
      const mainContent = document.querySelector('[class*="main"], [class*="content"], [class*="body"], [class*="post"]');
      const mainText = mainContent ? (mainContent as HTMLElement).innerText?.substring(0, 1000) : "";

      return {
        totalElements: elements.length,
        sampleClasses: Array.from(classNames).slice(0, 80),
        bodyText: body.innerText?.substring(0, 1000),
        mainText,
      };
    });
    console.log(`[scraper] DOM: ${domInfo.totalElements} elements`);
    console.log(`[scraper] Classes: ${JSON.stringify(domInfo.sampleClasses)}`);
    console.log(`[scraper] Body text: ${domInfo.bodyText?.substring(0, 500)}`);
    console.log(`[scraper] Main content: ${domInfo.mainText?.substring(0, 500)}`);

    // The Channel Assistant uses wujie micro-frontend — content is in iframes
    // Try to extract videos from wujie iframe first
    let videos = await extractVideosFromWujieIframe(page);

    // If iframe extraction didn't work, try intercepted API data
    if (videos.length === 0) {
      console.log("[scraper] No videos from iframe, trying API interception...");
      videos = parseInterceptedVideos(interceptedData);
    }

    // Last resort: try DOM extraction from main page
    if (videos.length === 0) {
      console.log("[scraper] No videos from API interception, trying DOM extraction...");
      videos = await extractVideosFromDom(page);
    }

    // Extract channel title
    const title = await extractTitle(page);
    const content = buildContent(title, videos);

    // Collect thumbnail images (URL references)
    const images: Array<{ url: string; altText?: string }> = [];
    for (const video of videos) {
      if (video.thumbnailUrl) {
        images.push({ url: video.thumbnailUrl, altText: video.title });
      }
    }

    // Download thumbnails as base64 using the browser context (needs cookies)
    const thumbnails: ThumbnailData[] = [];
    for (const video of videos) {
      if (!video.thumbnailUrl) continue;
      try {
        const result = await page.evaluate(async (url: string) => {
          try {
            const response = await fetch(url, { credentials: "include" });
            if (!response.ok) return null;
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            return {
              base64: btoa(binary),
              contentType: response.headers.get("content-type") || "image/jpeg",
            };
          } catch {
            return null;
          }
        }, video.thumbnailUrl);

        if (result?.base64) {
          thumbnails.push({
            url: video.thumbnailUrl,
            base64: `data:${result.contentType};base64,${result.base64}`,
            altText: video.title,
          });
        }
      } catch (e) {
        console.log(`[scraper] Thumbnail download failed for "${video.title}": ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`[scraper] Downloaded ${thumbnails.length}/${videos.length} thumbnails`);

    await page.close();

    return {
      success: true,
      content,
      title,
      videos,
      images,
      thumbnails,
      debugScreenshot: screenshotBase64,
      debugApiUrls: allApiUrls,
    };
  } catch (error) {
    console.error("[scraper] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown scraping error",
    };
  } finally {
    await context.close();
  }
}

/**
 * Parse videos from intercepted API response data.
 * The Channel Assistant API typically returns data in structures like:
 * { data: { post_list: [...] } } or { data: { list: [...] } }
 */
function parseInterceptedVideos(
  responses: Array<Record<string, unknown>>
): VideoMeta[] {
  const videos: VideoMeta[] = [];
  const seenIds = new Set<string>();

  for (const response of responses) {
    try {
      // Try various response structures
      const candidates = findVideoArrays(response);

      for (const items of candidates) {
        if (!Array.isArray(items)) continue;

        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const obj = item as Record<string, unknown>;

          const video = extractVideoFromApiItem(obj);
          if (video && !seenIds.has(video.objectId || video.title)) {
            seenIds.add(video.objectId || video.title);
            videos.push(video);
          }
        }
      }
    } catch {
      // Skip unparseable responses
    }
  }

  console.log(`[scraper] Parsed ${videos.length} videos from API data`);
  return videos;
}

/**
 * Recursively search response data for arrays that might contain video items.
 */
function findVideoArrays(obj: unknown, depth = 0): unknown[][] {
  if (depth > 5 || !obj || typeof obj !== "object") return [];
  const results: unknown[][] = [];

  if (Array.isArray(obj)) {
    // Check if this array contains objects with video-like fields
    if (
      obj.length > 0 &&
      obj.some(
        (item) =>
          item &&
          typeof item === "object" &&
          (hasField(item, "objectDesc") ||
            hasField(item, "object_desc") ||
            hasField(item, "mediaInfo") ||
            hasField(item, "media_info") ||
            hasField(item, "objectId") ||
            hasField(item, "object_id") ||
            hasField(item, "exportId") ||
            hasField(item, "export_id") ||
            hasField(item, "title") ||
            hasField(item, "desc") ||
            hasField(item, "description") ||
            hasField(item, "nickname") ||
            hasField(item, "fileUrl") ||
            hasField(item, "file_url") ||
            hasField(item, "url") ||
            hasField(item, "videoUrl") ||
            hasField(item, "video_url"))
      )
    ) {
      results.push(obj);
    }
    return results;
  }

  // Search object properties
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (Array.isArray(value) || (value && typeof value === "object")) {
      results.push(...findVideoArrays(value, depth + 1));
    }
  }

  return results;
}

function hasField(obj: unknown, field: string): boolean {
  return obj !== null && typeof obj === "object" && field in (obj as Record<string, unknown>);
}

/**
 * Extract a VideoMeta from a single API response item.
 * Handles multiple possible field name conventions (camelCase and snake_case).
 */
function extractVideoFromApiItem(
  obj: Record<string, unknown>
): VideoMeta | null {
  const getString = (
    ...keys: string[]
  ): string | undefined => {
    for (const key of keys) {
      const val = getNestedValue(obj, key);
      if (typeof val === "string" && val.trim()) return val.trim();
    }
    return undefined;
  };

  const getNumber = (...keys: string[]): number | undefined => {
    for (const key of keys) {
      const val = getNestedValue(obj, key);
      if (typeof val === "number") return val;
    }
    return undefined;
  };

  // Extract title
  const title =
    getString(
      "objectDesc.description",
      "object_desc.description",
      "objectDesc.desc",
      "object_desc.desc",
      "description",
      "desc",
      "title",
      "nickname"
    ) || "Untitled";

  // Extract video URL — try multiple possible paths
  const videoUrl = getString(
    "objectDesc.media.0.url",
    "object_desc.media.0.url",
    "objectDesc.media.0.videoPlayUrl",
    "object_desc.media.0.video_play_url",
    "objectDesc.media.0.mediaUrl",
    "object_desc.media.0.media_url",
    "mediaInfo.videoUrl",
    "media_info.video_url",
    "mediaInfo.url",
    "media_info.url",
    "fileUrl",
    "file_url",
    "videoUrl",
    "video_url",
    "url"
  );

  // Extract thumbnail
  const thumbnailUrl = getString(
    "objectDesc.media.0.thumbUrl",
    "object_desc.media.0.thumb_url",
    "objectDesc.media.0.coverUrl",
    "object_desc.media.0.cover_url",
    "objectDesc.coverUrl",
    "object_desc.cover_url",
    "coverImgUrl",
    "cover_img_url",
    "coverUrl",
    "cover_url",
    "thumbUrl",
    "thumb_url",
    "thumbnailUrl",
    "thumbnail_url"
  );

  // Extract IDs
  const objectId = getString(
    "objectId",
    "object_id",
    "objectNonceId",
    "object_nonce_id",
    "id"
  );
  const exportId = getString("exportId", "export_id");

  // Extract duration
  const duration = getNumber(
    "objectDesc.media.0.mediaDuration",
    "object_desc.media.0.media_duration",
    "mediaInfo.duration",
    "media_info.duration",
    "duration"
  );

  // Extract publish time
  const publishTimestamp = getNumber(
    "createTime",
    "create_time",
    "publishTime",
    "publish_time",
    "createtime",
    "updateTime",
    "update_time"
  );
  const publishedAt = publishTimestamp
    ? new Date(publishTimestamp * 1000).toISOString()
    : undefined;

  // Skip if we don't have at least a title or video URL
  if (title === "Untitled" && !videoUrl && !objectId) return null;

  return {
    title,
    description: getString("objectDesc.description", "object_desc.description", "description", "desc"),
    publishedAt,
    thumbnailUrl: thumbnailUrl?.startsWith("http") ? thumbnailUrl : undefined,
    videoUrl: videoUrl?.startsWith("http") ? videoUrl : undefined,
    objectId,
    exportId,
    duration,
  };
}

/**
 * Get a nested value from an object using dot notation.
 * Supports numeric indices for arrays (e.g., "media.0.url").
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index)) return undefined;
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Find the wujie content iframe that contains the post list.
 */
function findContentFrame(page: import("playwright").Page): import("playwright").Frame | null {
  const frames = page.frames();
  console.log(`[scraper] Found ${frames.length} frames`);
  for (const frame of frames) {
    console.log(`[scraper] Frame: ${frame.url().substring(0, 100)}`);
  }

  return (
    frames.find((f) => f.url().includes("micro/content/post/list")) ||
    frames.find((f) => f.url().includes("micro/content")) ||
    frames.find((f) =>
      f.url().includes("post-card") ||
      (f.url().includes("post/list") && f !== page.mainFrame())
    ) || null
  );
}

/**
 * Extract videos from the wujie micro-frontend iframe.
 * Uses multiple strategies: Vue state, DOM structure, and text parsing.
 */
async function extractVideosFromWujieIframe(
  page: import("playwright").Page
): Promise<VideoMeta[]> {
  try {
    const contentFrame = findContentFrame(page);
    if (!contentFrame) {
      console.log("[scraper] No content frame found");
      return [];
    }
    console.log(`[scraper] Found content frame: ${contentFrame.url().substring(0, 100)}`);
    await page.waitForTimeout(2000);

    // Strategy 1: Try to access Vue/React component state for full video data
    const stateVideos = await contentFrame.evaluate(() => {
      const results: Array<{
        title: string;
        objectId?: string;
        exportId?: string;
        thumbnailUrl?: string;
        videoUrl?: string;
        duration?: number;
        publishedAt?: string;
      }> = [];

      // Try Vue 3 (__vue_app__) on the root element
      const appEl = document.querySelector("#app") || document.querySelector("[id*='app']") || document.body.firstElementChild;
      if (appEl) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vue = (appEl as any).__vue_app__ || (appEl as any).__vue__;
        if (vue) {
          console.log("[scraper] Found Vue instance on app element");
        }
      }

      // Try to find post data in any Vue component tree
      // Look for elements with __vue__ (Vue 2) or __vueParentComponent (Vue 3)
      const allElements = document.querySelectorAll("*");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let postListData: any = null;

      for (const el of Array.from(allElements).slice(0, 200)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vueComp = (el as any).__vue__ || (el as any).__vueParentComponent;
        if (!vueComp) continue;

        // Look for component with post list data
        const data = vueComp.data || vueComp.setupState || vueComp.ctx || vueComp.proxy;
        if (!data) continue;

        // Check for post-list-like data
        const checkObj = typeof data === "function" ? data() : data;
        if (!checkObj || typeof checkObj !== "object") continue;

        for (const key of Object.keys(checkObj)) {
          const val = checkObj[key];
          if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === "object") {
            const first = val[0];
            // Check if this looks like a post/video list
            if (first.objectDesc || first.object_desc || first.objectId || first.object_id ||
                first.objectNonceId || first.object_nonce_id || first.title ||
                first.mediaInfo || first.media_info) {
              console.log(`[scraper] Found post data in Vue state: key="${key}", items=${val.length}`);
              postListData = val;
              break;
            }
          }
        }
        if (postListData) break;
      }

      // Also try window.__INITIAL_STATE__ or similar globals
      if (!postListData) {
        const win = window as unknown as Record<string, unknown>;
        for (const key of Object.keys(win)) {
          if (key.startsWith("__") && typeof win[key] === "object" && win[key]) {
            try {
              const state = JSON.stringify(win[key]).substring(0, 200);
              if (state.includes("objectDesc") || state.includes("post_list") || state.includes("objectId")) {
                console.log(`[scraper] Found potential state in window.${key}`);
              }
            } catch { /* skip */ }
          }
        }
      }

      if (postListData && Array.isArray(postListData)) {
        for (const item of postListData) {
          if (!item || typeof item !== "object") continue;
          const obj = item as Record<string, unknown>;

          // Extract fields — handle both camelCase and snake_case
          const getStr = (...paths: string[]): string | undefined => {
            for (const path of paths) {
              const parts = path.split(".");
              let current: unknown = obj;
              for (const p of parts) {
                if (current && typeof current === "object") {
                  current = (current as Record<string, unknown>)[p];
                } else {
                  current = undefined;
                  break;
                }
              }
              if (typeof current === "string" && current.trim()) return current.trim();
            }
            return undefined;
          };
          const getNum = (...paths: string[]): number | undefined => {
            for (const path of paths) {
              const parts = path.split(".");
              let current: unknown = obj;
              for (const p of parts) {
                if (current && typeof current === "object") {
                  current = (current as Record<string, unknown>)[p];
                } else {
                  current = undefined;
                  break;
                }
              }
              if (typeof current === "number") return current;
            }
            return undefined;
          };

          const title = getStr("objectDesc.description", "object_desc.description", "objectDesc.desc", "object_desc.desc", "description", "desc", "title") || "";
          const objectId = getStr("objectId", "object_id", "objectNonceId", "object_nonce_id", "id");
          const exportId = getStr("exportId", "export_id");
          const thumbnailUrl = getStr(
            "objectDesc.media.0.thumbUrl", "object_desc.media.0.thumb_url",
            "objectDesc.media.0.coverUrl", "object_desc.media.0.cover_url",
            "objectDesc.coverUrl", "object_desc.cover_url",
            "coverImgUrl", "cover_img_url", "coverUrl", "cover_url"
          );
          const videoUrl = getStr(
            "objectDesc.media.0.url", "object_desc.media.0.url",
            "objectDesc.media.0.videoPlayUrl", "object_desc.media.0.video_play_url",
            "mediaInfo.videoUrl", "media_info.video_url",
            "fileUrl", "file_url", "videoUrl", "video_url"
          );
          const duration = getNum(
            "objectDesc.media.0.mediaDuration", "object_desc.media.0.media_duration",
            "mediaInfo.duration", "media_info.duration", "duration"
          );
          const publishTs = getNum("createTime", "create_time", "publishTime", "publish_time");
          const publishedAt = publishTs ? new Date(publishTs * 1000).toISOString() : undefined;

          if (title || objectId) {
            results.push({
              title: title || "Untitled",
              objectId,
              exportId,
              thumbnailUrl: thumbnailUrl?.startsWith("http") ? thumbnailUrl : undefined,
              videoUrl: videoUrl?.startsWith("http") ? videoUrl : undefined,
              duration,
              publishedAt,
            });
          }
        }
      }

      return results;
    }).catch((err: Error) => {
      console.log(`[scraper] Vue state extraction error: ${err.message}`);
      return [];
    });

    if (stateVideos.length > 0) {
      console.log(`[scraper] Vue state: found ${stateVideos.length} videos`);
      for (const v of stateVideos.slice(0, 3)) {
        console.log(`[scraper] Video: "${v.title?.substring(0, 40)}" id=${v.objectId} url=${v.videoUrl?.substring(0, 60) || "none"} thumb=${v.thumbnailUrl?.substring(0, 60) || "none"}`);
      }
      return stateVideos;
    }

    // Strategy 2: Extract structured data from post card DOM elements
    console.log("[scraper] Vue state empty, trying DOM extraction...");
    const domCards = await contentFrame.evaluate(() => {
      const cards: Array<{
        text: string;
        thumbnailUrl: string | null;
        links: string[];
        objectId: string | null;
      }> = [];

      // Find post feed cards — these are the main video items
      // Try multiple selectors for the post card container
      let postElements = document.querySelectorAll(
        '.post-feed-card, [class*="post-feed"], [class*="post_feed"]'
      );

      // Broaden if nothing found
      if (postElements.length === 0) {
        postElements = document.querySelectorAll(
          '[class*="post-card"], [class*="post-item"], [class*="feed-card"], [class*="feed-item"]'
        );
      }

      // Try table rows if still nothing
      if (postElements.length === 0) {
        postElements = document.querySelectorAll('.post-list tr, .post-list [class*="row"]');
      }

      // Log what we found for debugging
      console.log(`[DOM] Found ${postElements.length} post elements`);
      if (postElements.length > 0) {
        console.log(`[DOM] First element class: ${postElements[0].className?.substring(0, 100)}`);
        console.log(`[DOM] First element HTML: ${(postElements[0] as HTMLElement).innerHTML?.substring(0, 300)}`);
      }

      // Also try to find ALL elements with specific patterns
      // Log elements that have links containing objectId or post/detail
      const allLinks = document.querySelectorAll('a[href*="objectId"], a[href*="object_id"], a[href*="detail"], a[href*="edit"]');
      console.log(`[DOM] Links with objectId/detail/edit: ${allLinks.length}`);
      allLinks.forEach((a) => {
        console.log(`[DOM] Link: ${(a as HTMLAnchorElement).href}`);
      });

      // Look for video-link class elements
      const videoLinks = document.querySelectorAll('.video-link, [class*="video-link"]');
      console.log(`[DOM] video-link elements: ${videoLinks.length}`);
      videoLinks.forEach((el) => {
        const tag = el.tagName.toLowerCase();
        const href = (el as HTMLAnchorElement).href || "";
        const text = (el as HTMLElement).innerText?.substring(0, 80) || "";
        console.log(`[DOM] video-link <${tag}>: href="${href}" text="${text}"`);
      });

      // Try to find thumbnail images within the content area
      const contentImgs = document.querySelectorAll('.post-list img, [class*="cover"] img, [class*="thumb"] img');
      console.log(`[DOM] Content images: ${contentImgs.length}`);
      contentImgs.forEach((img, i) => {
        if (i < 5) {
          const src = (img as HTMLImageElement).src || (img as HTMLImageElement).getAttribute("data-src") || "";
          console.log(`[DOM] Image: ${src.substring(0, 100)}`);
        }
      });

      postElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const text = htmlEl.innerText?.substring(0, 500) || "";

        // Extract thumbnail
        const img = htmlEl.querySelector('img[src*="http"], img[data-src*="http"]');
        let thumbnailUrl = (img as HTMLImageElement)?.src ||
          (img as HTMLImageElement)?.getAttribute("data-src") || null;

        // Also check background-image on cover elements
        if (!thumbnailUrl) {
          const coverEl = htmlEl.querySelector('[class*="cover"], [class*="thumb"], [class*="poster"]');
          if (coverEl) {
            const bg = getComputedStyle(coverEl).backgroundImage;
            const bgMatch = bg?.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
            if (bgMatch) thumbnailUrl = bgMatch[1];
          }
        }

        // Extract links
        const linkElements = htmlEl.querySelectorAll("a[href]");
        const links: string[] = [];
        linkElements.forEach((a) => {
          const href = (a as HTMLAnchorElement).href;
          if (href && !href.startsWith("javascript:")) links.push(href);
        });

        // Try to find objectId
        let objectId: string | null = null;
        // From links: /platform/post/detail?objectId=xxx
        for (const link of links) {
          const match = link.match(/objectId=([^&]+)/i) || link.match(/object_id=([^&]+)/i);
          if (match) { objectId = match[1]; break; }
        }
        // From data attributes
        if (!objectId) {
          for (const attr of Array.from(htmlEl.attributes)) {
            if (attr.name.includes("object") && attr.value) {
              objectId = attr.value;
              break;
            }
          }
        }

        if (text.length > 4) {
          cards.push({ text, thumbnailUrl, links, objectId });
        }
      });

      // If no post cards found, also extract links from the body
      if (cards.length === 0) {
        const bodyLinks = document.querySelectorAll('a[href*="objectId"], a[href*="detail"]');
        bodyLinks.forEach((a) => {
          const href = (a as HTMLAnchorElement).href;
          const match = href.match(/objectId=([^&]+)/i);
          if (match) {
            cards.push({
              text: (a as HTMLElement).innerText?.substring(0, 200) || "",
              thumbnailUrl: null,
              links: [href],
              objectId: match[1],
            });
          }
        });
      }

      return cards;
    }).catch((err: Error) => {
      console.log(`[scraper] DOM card extraction error: ${err.message}`);
      return [];
    });

    console.log(`[scraper] DOM: found ${domCards.length} post cards`);

    // Build videos from DOM cards + text parsing
    const bodyText = await contentFrame.evaluate(() =>
      document.body?.innerText?.substring(0, 5000) || ""
    ).catch(() => "");

    const textVideos = parseWujieBodyText(bodyText);
    console.log(`[scraper] Text parsing: found ${textVideos.length} videos`);

    // If DOM cards have objectIds, merge with text-parsed videos
    if (domCards.length > 0 && domCards.some((c) => c.objectId || c.thumbnailUrl)) {
      const videos: VideoMeta[] = [];
      for (let i = 0; i < domCards.length; i++) {
        const card = domCards[i];
        // Try to match with text-parsed video by index
        const textVideo = textVideos[i];
        videos.push({
          title: textVideo?.title || card.text.split("\n")[0]?.substring(0, 200) || "Untitled",
          publishedAt: textVideo?.publishedAt,
          objectId: card.objectId || undefined,
          thumbnailUrl: card.thumbnailUrl?.startsWith("http") ? card.thumbnailUrl : undefined,
        });
      }
      return videos;
    }

    // Fallback: return text-parsed videos
    return textVideos;
  } catch (error) {
    console.log("[scraper] Wujie iframe extraction error:", error);
    return [];
  }
}

// UI texts to skip when parsing the Channel Assistant page
const SKIP_TEXTS = new Set([
  "评论管理", "可见权限", "弹幕管理", "发表视频", "特效创作工具",
  "内容管理", "视频管理", "搜索视频", "视频", "图文", "音乐", "音频",
  "草稿箱", "主页", "活动", "合集", "首页", "互动管理", "收入与服务",
  "带货中心", "数据中心", "通知中心", "蛋壳生活", "创作工具",
  "直播", "橱窗", "下一页", "跳转", "上一页", "删除", "编辑",
  "置顶", "取消置顶", "设为封面", "更多", "分享", "投诉",
]);

function parseWujieBodyText(bodyText: string): VideoMeta[] {
  const videos: VideoMeta[] = [];
  const lines = bodyText.split("\n").map((l) => l.trim()).filter(Boolean);
  let currentVideo: Partial<VideoMeta> | null = null;

  for (const line of lines) {
    // Skip known UI texts
    if (SKIP_TEXTS.has(line)) continue;
    // Skip lines containing navigation patterns
    if (line.includes("秒剪") || line.includes("自动字幕") || line.includes("腾讯") || line.includes("All Rights Reserved") || line.includes("运营规范")) continue;
    // Skip pagination patterns like "1 2 下一页  跳转"
    if (line.includes("下一页") || line.includes("跳转")) continue;

    // Date pattern: "2025年01月06日 03:38"
    const dateMatch = line.match(/(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2})/);
    if (dateMatch) {
      if (currentVideo) {
        const [, year, month, day, hour, minute] = dateMatch;
        currentVideo.publishedAt = `${year}-${month}-${day}T${hour}:${minute}:00.000Z`;
      }
      continue;
    }

    // Pure number lines are view counts — skip
    if (/^\d[\d,.万]*$/.test(line)) continue;

    // Stats pattern like "57 0 0 0 0"
    const statsMatch = line.match(/^\d+(\s+\d+){2,}$/);
    if (statsMatch) continue;

    // Skip short lines that look like UI elements (single Chinese word/phrase)
    if (line.length <= 4 && /^[\u4e00-\u9fff]+$/.test(line)) continue;

    // Skip lines that match common tab/header patterns "视频 (40)"
    if (/^[\u4e00-\u9fff]+\s*\(\d+\)$/.test(line)) continue;

    // This looks like a video title
    if (line.length > 4 && line.length < 500) {
      // Save previous video
      if (currentVideo && currentVideo.title) {
        videos.push(currentVideo as VideoMeta);
      }
      currentVideo = { title: line };
    }
  }

  // Save last video
  if (currentVideo && currentVideo.title) {
    videos.push(currentVideo as VideoMeta);
  }

  return videos;
}

/**
 * Fallback: Extract video info from the DOM when API interception fails.
 */
async function extractVideosFromDom(
  page: import("playwright").Page
): Promise<VideoMeta[]> {
  const videos: VideoMeta[] = [];

  try {
    // Get all text content and look for structured data
    const pageData = await page.evaluate(() => {
      // Look for any data embedded in script tags or window variables
      const scripts = Array.from(document.querySelectorAll("script"));
      const dataScripts: string[] = [];
      for (const script of scripts) {
        const text = script.textContent || "";
        if (text.includes("post_list") || text.includes("objectDesc") || text.includes("videoUrl")) {
          dataScripts.push(text.substring(0, 2000));
        }
      }

      // Check for data in window.__INITIAL_STATE__ or similar
      const win = window as unknown as Record<string, unknown>;
      const stateKeys = Object.keys(win).filter(
        (k) =>
          k.includes("STATE") ||
          k.includes("DATA") ||
          k.includes("PROPS") ||
          k.includes("__NEXT")
      );

      // Get all visible post/card elements
      const allElements = document.querySelectorAll('[class*="post"], [class*="card"], [class*="item"], [class*="feed"]');
      const postElements: Array<{ text: string; classes: string }> = [];
      allElements.forEach((el) => {
        const text = (el as HTMLElement).innerText?.substring(0, 200);
        if (text && text.length > 10) {
          postElements.push({
            text,
            classes: el.className?.substring(0, 100) || "",
          });
        }
      });

      return {
        dataScripts: dataScripts.slice(0, 3),
        stateKeys,
        postElements: postElements.slice(0, 20),
      };
    });

    console.log(`[scraper] DOM fallback: ${pageData.postElements.length} post-like elements`);
    console.log(`[scraper] State keys: ${JSON.stringify(pageData.stateKeys)}`);
    if (pageData.dataScripts.length > 0) {
      console.log(`[scraper] Found data scripts: ${pageData.dataScripts.length}`);
    }

    // Parse post elements from DOM text
    for (const el of pageData.postElements) {
      const lines = el.text.split("\n").filter((l) => l.trim());
      if (lines.length > 0) {
        videos.push({
          title: lines[0].substring(0, 100),
          description: lines.slice(1).join(" ").substring(0, 300) || undefined,
        });
      }
    }
  } catch (error) {
    console.log("[scraper] DOM extraction error:", error);
  }

  return videos;
}

async function extractTitle(page: import("playwright").Page): Promise<string> {
  try {
    // Try multiple selectors for the channel/account name
    const selectors = [
      '[class*="finder-nickname"]',
      '[class*="account-name"]',
      '[class*="nick-name"]',
      '[class*="header"] [class*="name"]',
      '[class*="sidebar"] [class*="name"]',
      '[class*="user-info"] [class*="name"]',
    ];

    for (const selector of selectors) {
      const el = await page.$(selector);
      if (el) {
        const text = await el.textContent();
        if (text?.trim()) return text.trim();
      }
    }

    // Fallback to page title
    const pageTitle = await page.title();
    return pageTitle.replace("视频号助手", "").trim() || "Weixin Channel";
  } catch {
    return "Weixin Channel";
  }
}

function buildContent(title: string, videos: VideoMeta[]): string {
  const parts: string[] = [];
  parts.push(`# ${title}`);
  parts.push("");

  if (videos.length > 0) {
    parts.push(`## Videos (${videos.length})`);
    parts.push("");

    for (const video of videos) {
      parts.push(`### ${video.title}`);
      if (video.publishedAt) {
        parts.push(`Published: ${video.publishedAt}`);
      }
      if (video.duration) {
        const mins = Math.floor(video.duration / 60);
        const secs = video.duration % 60;
        parts.push(`Duration: ${mins}:${secs.toString().padStart(2, "0")}`);
      }
      if (video.description && video.description !== video.title) {
        parts.push("");
        parts.push(video.description);
      }
      if (video.videoUrl) {
        parts.push(`Video: ${video.videoUrl}`);
      }
      if (video.objectId) {
        parts.push(`ID: ${video.objectId}`);
      }
      parts.push("");
    }
  } else {
    parts.push("No videos found. The Channel Assistant page may have a different structure.");
    parts.push("");
    parts.push("Debug: Check worker logs for intercepted API patterns.");
  }

  return parts.join("\n");
}

/**
 * Resolve video download URLs by navigating to each video's detail/edit page.
 * The Channel Assistant detail page loads a video player with the actual media URL.
 * This is the only reliable way to get video download URLs since the listing API
 * doesn't include them.
 */
export async function resolveVideoUrls(
  cookies: CookieData[],
  videos: Array<{ objectId?: string; title: string }>
): Promise<Array<{ title: string; objectId?: string; videoUrl?: string; error?: string }>> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "zh-CN",
    viewport: { width: 1280, height: 800 },
  });

  const results: Array<{ title: string; objectId?: string; videoUrl?: string; error?: string }> = [];

  try {
    await context.addCookies(
      cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
      }))
    );

    const page = await context.newPage();

    // If we have objectIds, navigate to each video's detail page
    // If not, navigate to the post list and click on each video
    const videosWithIds = videos.filter((v) => v.objectId);
    const videosWithoutIds = videos.filter((v) => !v.objectId);

    // Resolve videos with objectIds via detail page
    for (const video of videosWithIds) {
      try {
        console.log(`[resolve] Resolving video: "${video.title}" (${video.objectId})`);

        // Intercept video source URLs from network requests
        let resolvedUrl: string | undefined;
        const videoUrlPromise = new Promise<string | undefined>((resolve) => {
          const timeout = setTimeout(() => resolve(undefined), 20000);
          const handler = (response: import("playwright").Response) => {
            const url = response.url();
            // Video URLs typically come from CDN domains
            if (
              (url.includes("finder.video.qq.com") ||
                url.includes("mpvideo.qpic.cn") ||
                url.includes("wxsnsdy.tc.qq.com") ||
                url.includes(".mp4") ||
                url.includes("stodownload")) &&
              response.status() === 200
            ) {
              console.log(`[resolve] Found video URL from network: ${url.substring(0, 120)}`);
              resolvedUrl = url;
              clearTimeout(timeout);
              page.off("response", handler);
              resolve(url);
            }
          };
          page.on("response", handler);
        });

        // Navigate to the video detail/edit page
        const detailUrl = `${PLATFORM_URL}/post/detail?objectId=${video.objectId}`;
        await page.goto(detailUrl, { waitUntil: "commit", timeout: 30000 });
        try {
          await page.waitForLoadState("load", { timeout: 20000 });
        } catch { /* continue */ }
        await page.waitForTimeout(3000);

        // Also try to find video URL from the DOM (video element src)
        if (!resolvedUrl) {
          resolvedUrl = await page.evaluate(() => {
            // Check <video> elements
            const videoEl = document.querySelector("video[src], video source[src]");
            if (videoEl) {
              const src = (videoEl as HTMLVideoElement).src ||
                videoEl.querySelector("source")?.src;
              if (src?.startsWith("http")) return src;
            }

            // Check within iframes
            for (const frame of Array.from(document.querySelectorAll("iframe"))) {
              try {
                const frameDoc = (frame as HTMLIFrameElement).contentDocument;
                if (!frameDoc) continue;
                const fVideo = frameDoc.querySelector("video[src], video source[src]");
                if (fVideo) {
                  const src = (fVideo as HTMLVideoElement).src ||
                    fVideo.querySelector("source")?.src;
                  if (src?.startsWith("http")) return src;
                }
              } catch { /* cross-origin */ }
            }

            return undefined;
          }).catch(() => undefined);
        }

        // Wait a bit more for network interception
        if (!resolvedUrl) {
          resolvedUrl = await Promise.race([
            videoUrlPromise,
            new Promise<undefined>((r) => setTimeout(() => r(undefined), 5000)),
          ]);
        }

        results.push({
          title: video.title,
          objectId: video.objectId,
          videoUrl: resolvedUrl,
          error: resolvedUrl ? undefined : "Could not find video URL on detail page",
        });
      } catch (error) {
        console.error(`[resolve] Error resolving "${video.title}":`, error);
        results.push({
          title: video.title,
          objectId: video.objectId,
          error: error instanceof Error ? error.message : "Resolution failed",
        });
      }
    }

    // For videos without objectIds, try navigating to post list and clicking each video
    if (videosWithoutIds.length > 0) {
      console.log(`[resolve] ${videosWithoutIds.length} videos without objectId, trying post list click approach...`);

      // Navigate to post list
      await page.goto(`${PLATFORM_URL}/post/list`, { waitUntil: "commit", timeout: 30000 });
      try {
        await page.waitForLoadState("load", { timeout: 20000 });
      } catch { /* continue */ }
      await page.waitForTimeout(5000);

      const contentFrame = findContentFrame(page);

      for (const video of videosWithoutIds) {
        try {
          console.log(`[resolve] Trying to find and click: "${video.title}"`);

          if (!contentFrame) {
            results.push({ title: video.title, error: "No content frame found" });
            continue;
          }

          // Find the video by title text and click it
          const clicked = await contentFrame.evaluate((title: string) => {
            // Find element containing the title text
            const elements = document.querySelectorAll(
              '[class*="post-feed"], [class*="post-card"], [class*="video-link"], a'
            );
            for (const el of Array.from(elements)) {
              if ((el as HTMLElement).innerText?.includes(title.substring(0, 30))) {
                // Click the element or its parent link
                const link = el.closest("a") || el.querySelector("a") || el;
                (link as HTMLElement).click();
                return true;
              }
            }
            return false;
          }, video.title).catch(() => false);

          if (!clicked) {
            results.push({ title: video.title, error: "Could not find video in list" });
            continue;
          }

          // Wait for navigation to detail page
          await page.waitForTimeout(3000);

          // Try to find video URL
          const videoUrl = await page.evaluate(() => {
            for (const frame of [document, ...Array.from(document.querySelectorAll("iframe")).map((f) => {
              try { return (f as HTMLIFrameElement).contentDocument; } catch { return null; }
            }).filter(Boolean)]) {
              if (!frame) continue;
              const videoEl = frame.querySelector("video[src], video source[src]");
              if (videoEl) {
                const src = (videoEl as HTMLVideoElement).src ||
                  videoEl.querySelector("source")?.src;
                if (src?.startsWith("http")) return src;
              }
            }
            return undefined;
          }).catch(() => undefined);

          results.push({
            title: video.title,
            videoUrl,
            error: videoUrl ? undefined : "Could not find video URL",
          });

          // Go back to post list for the next video
          await page.goBack({ waitUntil: "commit", timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(2000);
        } catch (error) {
          results.push({
            title: video.title,
            error: error instanceof Error ? error.message : "Resolution failed",
          });
        }
      }
    }

    await page.close();
  } catch (error) {
    console.error("[resolve] Fatal error:", error);
  } finally {
    await context.close();
  }

  const resolved = results.filter((r) => r.videoUrl).length;
  console.log(`[resolve] Resolved ${resolved}/${results.length} video URLs`);
  return results;
}
