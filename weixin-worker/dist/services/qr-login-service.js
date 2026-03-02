"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveSessionCount = getActiveSessionCount;
exports.startLogin = startLogin;
exports.checkStatus = checkStatus;
exports.cleanupAllSessions = cleanupAllSessions;
const uuid_1 = require("uuid");
const browser_pool_js_1 = require("./browser-pool.js");
const config_js_1 = require("../config.js");
const sessions = new Map();
const PLATFORM_LOGIN_URL = "https://channels.weixin.qq.com/platform/login";
const PLATFORM_HOME_PATH = "/platform";
function getActiveSessionCount() {
    return sessions.size;
}
async function startLogin() {
    const browser = await (0, browser_pool_js_1.getBrowser)();
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "zh-CN",
        viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    console.log("[qr-login] Navigating to Channel Assistant login...");
    await page.goto(PLATFORM_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    // The page is an SPA — wait for actual content to render
    // Wait for any visible image to appear (the QR code is the main content on the login page)
    console.log("[qr-login] Waiting for page to render...");
    try {
        await page.waitForSelector("img", { timeout: 20000 });
    }
    catch {
        console.log("[qr-login] No img found, waiting extra time...");
        await page.waitForTimeout(5000);
    }
    // Additional wait for SPA rendering
    await page.waitForTimeout(3000);
    // Log the page state
    const pageUrl = page.url();
    const pageTitle = await page.title();
    console.log(`[qr-login] Page loaded: ${pageUrl} — "${pageTitle}"`);
    // Log all images on the page for debugging
    const imgInfo = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("img"));
        return imgs.map((img) => ({
            src: img.src?.substring(0, 100),
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            className: img.className?.substring(0, 80),
        }));
    });
    console.log(`[qr-login] Images on page: ${JSON.stringify(imgInfo)}`);
    // Log all iframes
    const frames = page.frames();
    for (const frame of frames) {
        console.log(`[qr-login] Frame: ${frame.url()}`);
    }
    // Try to find the QR code with multiple strategies
    let qrCodeBase64 = null;
    // The login page uses an iframe at /platform/login-for-iframe for the QR code
    // Strategy 1: Find the login iframe and look for QR inside it
    const loginFrame = page.frames().find((f) => f.url().includes("login-for-iframe") || f.url().includes("open.weixin"));
    if (loginFrame) {
        console.log(`[qr-login] Found login iframe: ${loginFrame.url()}`);
        // Wait for QR to render inside iframe
        try {
            await loginFrame.waitForSelector("img", { timeout: 10000 });
            await page.waitForTimeout(2000); // Extra time for QR render
        }
        catch {
            console.log("[qr-login] No img in iframe, waiting extra...");
            await page.waitForTimeout(3000);
        }
        // Log iframe images
        const iframeImgs = await loginFrame.evaluate(() => {
            return Array.from(document.querySelectorAll("img")).map((img) => ({
                src: img.src?.substring(0, 120),
                w: img.naturalWidth || img.width,
                h: img.naturalHeight || img.height,
                cls: img.className?.substring(0, 60),
            }));
        });
        console.log(`[qr-login] Iframe images: ${JSON.stringify(iframeImgs)}`);
        // Try to find the QR image inside the iframe
        const iframeImages = await loginFrame.$$("img");
        for (const img of iframeImages) {
            const box = await img.boundingBox();
            if (box && box.width > 80 && box.height > 80 && box.width < 500) {
                console.log(`[qr-login] Found QR in iframe: ${box.width}x${box.height}`);
                const buffer = await img.screenshot();
                qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
                break;
            }
        }
        // Try canvas inside iframe
        if (!qrCodeBase64) {
            const canvases = await loginFrame.$$("canvas");
            for (const canvas of canvases) {
                const box = await canvas.boundingBox();
                if (box && box.width > 50 && box.height > 50) {
                    console.log(`[qr-login] Found QR canvas in iframe: ${box.width}x${box.height}`);
                    const buffer = await canvas.screenshot();
                    qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
                    break;
                }
            }
        }
        // Screenshot the iframe element itself as fallback
        if (!qrCodeBase64) {
            console.log("[qr-login] Screenshotting iframe element...");
            const iframeEl = await page.$('iframe[src*="login-for-iframe"]');
            if (iframeEl) {
                const buffer = await iframeEl.screenshot();
                qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
            }
        }
    }
    // Strategy 2: Full viewport screenshot as final fallback
    if (!qrCodeBase64) {
        console.log("[qr-login] No iframe QR found, taking full page screenshot...");
        const buffer = await page.screenshot({ fullPage: false });
        qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
    }
    const sessionId = (0, uuid_1.v4)();
    const expiresAt = new Date(Date.now() + config_js_1.config.sessionTimeoutMs);
    // Set cleanup timer
    const cleanupTimer = setTimeout(() => {
        cleanupSession(sessionId);
    }, config_js_1.config.sessionTimeoutMs);
    const session = {
        sessionId,
        page,
        context,
        createdAt: new Date(),
        status: "pending",
        cleanupTimer,
    };
    sessions.set(sessionId, session);
    console.log(`[qr-login] Session ${sessionId} created, waiting for scan...`);
    return {
        sessionId,
        qrCodeBase64,
        expiresAt: expiresAt.toISOString(),
    };
}
async function checkStatus(sessionId) {
    const session = sessions.get(sessionId);
    if (!session)
        return null;
    if (session.status === "expired") {
        return { status: "expired", message: "QR code expired, please start a new session" };
    }
    if (session.status === "success") {
        return { status: "success" };
    }
    try {
        const currentUrl = session.page.url();
        // Check if page redirected away from login (login successful)
        if (!currentUrl.includes("/login") &&
            currentUrl.includes(PLATFORM_HOME_PATH)) {
            console.log(`[qr-login] Session ${sessionId}: login successful, extracting cookies...`);
            // Extract all cookies
            const playwrightCookies = await session.context.cookies();
            const cookies = playwrightCookies.map((c) => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path,
                expires: c.expires,
                httpOnly: c.httpOnly,
                secure: c.secure,
                sameSite: c.sameSite,
            }));
            session.status = "success";
            cleanupSession(sessionId);
            return { status: "success", cookies };
        }
        // Check for "scanned" visual state (WeChat shows a phone icon after scan)
        try {
            const scannedIndicator = await session.page.$('[class*="scanned"], [class*="confirm"], .login__type__container__scan__ft');
            if (scannedIndicator) {
                session.status = "scanned";
                return { status: "scanned", message: "QR code scanned, waiting for confirmation" };
            }
        }
        catch {
            // Ignore selector errors
        }
        return { status: "pending", message: "Waiting for QR code scan" };
    }
    catch (error) {
        console.error(`[qr-login] Error checking session ${sessionId}:`, error);
        cleanupSession(sessionId);
        return { status: "expired", message: "Session error, please try again" };
    }
}
async function cleanupSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session)
        return;
    clearTimeout(session.cleanupTimer);
    try {
        await session.page.close();
        await session.context.close();
    }
    catch {
        // Ignore cleanup errors
    }
    sessions.delete(sessionId);
    console.log(`[qr-login] Session ${sessionId} cleaned up`);
}
async function cleanupAllSessions() {
    for (const sessionId of sessions.keys()) {
        await cleanupSession(sessionId);
    }
}
