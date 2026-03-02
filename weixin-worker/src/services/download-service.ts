import { getBrowser } from "./browser-pool.js";
import type { CookieData, DownloadResponse } from "../types.js";

/**
 * Download a video file using a browser context with cookies set.
 * This ensures the download works even if the video URL requires authentication.
 * Returns base64-encoded video data.
 */
export async function downloadVideo(
  cookies: CookieData[],
  videoUrl: string,
  filename?: string
): Promise<DownloadResponse> {
  console.log(`[download] Starting download: ${videoUrl.substring(0, 100)}...`);

  // First try a direct fetch (many CDN URLs don't need cookies)
  try {
    const directResult = await directDownload(videoUrl);
    if (directResult.success) {
      console.log(`[download] Direct download succeeded: ${directResult.size} bytes`);
      return { ...directResult, filename: filename || generateFilename(videoUrl) };
    }
  } catch {
    console.log("[download] Direct download failed, trying with browser cookies...");
  }

  // Fall back to browser-context download
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "zh-CN",
  });

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

    // Use page.evaluate to fetch the video with cookies
    const result = await page.evaluate(async (url: string) => {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const contentType = response.headers.get("content-type") || "video/mp4";
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Convert to base64 in chunks to avoid call stack overflow
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);

      return {
        success: true,
        data: base64,
        contentType,
        size: bytes.length,
      };
    }, videoUrl);

    await page.close();

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Download failed in browser context",
      };
    }

    return {
      success: true,
      data: result.data,
      contentType: result.contentType,
      filename: filename || generateFilename(videoUrl),
      size: result.size,
    };
  } catch (error) {
    console.error("[download] Browser download error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download error",
    };
  } finally {
    await context.close();
  }
}

/**
 * Try a direct HTTP download without browser cookies.
 */
async function directDownload(videoUrl: string): Promise<DownloadResponse> {
  const response = await fetch(videoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://channels.weixin.qq.com/",
    },
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const contentType = response.headers.get("content-type") || "video/mp4";
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    success: true,
    data: buffer.toString("base64"),
    contentType,
    size: buffer.length,
  };
}

function generateFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop() || "mp4";
    return `weixin_video_${Date.now()}.${ext}`;
  } catch {
    return `weixin_video_${Date.now()}.mp4`;
  }
}
