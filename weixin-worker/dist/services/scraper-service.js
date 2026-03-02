"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeChannel = scrapeChannel;
const browser_pool_js_1 = require("./browser-pool.js");
const PLATFORM_URL = "https://channels.weixin.qq.com/platform";
async function scrapeChannel(cookies, channelId) {
    const browser = await (0, browser_pool_js_1.getBrowser)();
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "zh-CN",
    });
    try {
        // Set cookies before navigating
        await context.addCookies(cookies.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            expires: c.expires,
            httpOnly: c.httpOnly,
            secure: c.secure,
            sameSite: c.sameSite,
        })));
        const page = await context.newPage();
        // Navigate to the Channel Assistant platform
        const targetUrl = channelId
            ? `${PLATFORM_URL}/post/list`
            : `${PLATFORM_URL}/home`;
        console.log(`[scraper] Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
        // Check if we got redirected to login (cookies expired)
        const currentUrl = page.url();
        if (currentUrl.includes("/login")) {
            return {
                success: false,
                error: "Cookies expired or invalid, please re-login",
                cookieExpired: true,
            };
        }
        // Extract channel info from the platform page
        const title = await extractTitle(page);
        const videos = await extractVideos(page);
        const content = buildContent(title, videos);
        // Collect thumbnail images
        const images = [];
        for (const video of videos) {
            if (video.thumbnailUrl) {
                images.push({ url: video.thumbnailUrl, altText: video.title });
            }
        }
        await page.close();
        return {
            success: true,
            content,
            title,
            videos,
            images,
        };
    }
    catch (error) {
        console.error("[scraper] Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown scraping error",
        };
    }
    finally {
        await context.close();
    }
}
async function extractTitle(page) {
    try {
        // Try to get the channel name from the platform sidebar/header
        const nameEl = await page.$('[class*="finder-nickname"], [class*="account-name"], [class*="nick-name"], .header .name');
        if (nameEl) {
            const text = await nameEl.textContent();
            if (text?.trim())
                return text.trim();
        }
        // Fallback to page title
        const pageTitle = await page.title();
        return pageTitle.replace("视频号助手", "").trim() || "Weixin Channel";
    }
    catch {
        return "Weixin Channel";
    }
}
async function extractVideos(page) {
    const videos = [];
    try {
        // Wait for the post list to load
        await page.waitForSelector('[class*="post-feed"], [class*="post-item"], [class*="feed-item"], .post-list-item', { timeout: 10000 }).catch(() => null);
        // Extract video/post cards from the platform
        const items = await page.$$('[class*="post-feed-item"], [class*="post-item"], [class*="feed-item"], .post-list-item');
        for (const item of items.slice(0, 30)) {
            try {
                const titleEl = await item.$('[class*="title"], [class*="desc"], [class*="description"], h3, h4');
                const title = titleEl
                    ? ((await titleEl.textContent()) || "").trim()
                    : "";
                const descEl = await item.$('[class*="desc"], [class*="content"], p');
                const description = descEl
                    ? ((await descEl.textContent()) || "").trim()
                    : "";
                const imgEl = await item.$("img");
                const thumbnailUrl = imgEl
                    ? (await imgEl.getAttribute("src")) || undefined
                    : undefined;
                const dateEl = await item.$('[class*="date"], [class*="time"], time');
                const publishedAt = dateEl
                    ? ((await dateEl.textContent()) || "").trim()
                    : undefined;
                if (title || description) {
                    videos.push({
                        title: title || "Untitled",
                        description: description || undefined,
                        publishedAt,
                        thumbnailUrl: thumbnailUrl?.startsWith("http") ? thumbnailUrl : undefined,
                    });
                }
            }
            catch {
                // Skip items that fail to parse
            }
        }
    }
    catch (error) {
        console.log("[scraper] Could not extract videos:", error);
    }
    return videos;
}
function buildContent(title, videos) {
    const parts = [];
    parts.push(`# ${title}`);
    parts.push("");
    if (videos.length > 0) {
        parts.push(`## Posts (${videos.length})`);
        parts.push("");
        for (const video of videos) {
            parts.push(`### ${video.title}`);
            if (video.publishedAt) {
                parts.push(`Published: ${video.publishedAt}`);
            }
            if (video.description) {
                parts.push("");
                parts.push(video.description);
            }
            parts.push("");
        }
    }
    return parts.join("\n");
}
