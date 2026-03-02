import { v4 as uuidv4 } from "uuid";
import { getBrowser } from "./browser-pool.js";
import { config } from "../config.js";
import type {
  QrLoginSession,
  QrLoginStartResponse,
  QrLoginStatusResponse,
  CookieData,
} from "../types.js";

const sessions = new Map<string, QrLoginSession>();

// Use login.html directly — /platform/login is an SPA that may fail to render
// login.html consistently includes the QR iframe (login-for-iframe)
const PLATFORM_LOGIN_URL = "https://channels.weixin.qq.com/login.html";
const PLATFORM_HOME_PATH = "/platform";

// Timeout for individual screenshot operations (fonts may block indefinitely)
const SCREENSHOT_TIMEOUT = 15000;

export function getActiveSessionCount(): number {
  return sessions.size;
}

export async function startLogin(): Promise<QrLoginStartResponse> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    locale: "zh-CN",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  console.log("[qr-login] Navigating to Channel Assistant login...");
  // Use "commit" — fires when HTTP response is received (before parsing).
  // TLS to WeChat from Fly.io can be very slow; domcontentloaded may exceed 60s.
  await page.goto(PLATFORM_LOGIN_URL, { waitUntil: "commit", timeout: 120000 });
  console.log("[qr-login] Page response received, waiting for JS to execute...");

  // Wait for page JS to execute — the iframe is dynamically inserted by JavaScript.
  // After "commit", JS hasn't executed yet. Wait for "load" to ensure JS runs.
  try {
    await page.waitForLoadState("load", { timeout: 90000 });
    console.log("[qr-login] Page fully loaded");
  } catch {
    console.log("[qr-login] Page load timed out, continuing anyway...");
  }

  // Now wait for the login iframe — should be in DOM after JS execution
  try {
    await page.waitForSelector('iframe[src*="login"]', { timeout: 30000 });
    console.log("[qr-login] Login iframe found");
    // Give iframe time to load its own content (QR code rendering)
    await page.waitForTimeout(5000);
  } catch {
    console.log("[qr-login] No login iframe found, trying fallback selectors...");
    const fallbackSelectors = ["canvas", 'img[src*="qrcode"]', ".qrcode", "img"];
    for (const selector of fallbackSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        console.log(`[qr-login] Found fallback element: ${selector}`);
        break;
      } catch {
        // Try next
      }
    }
    await page.waitForTimeout(3000);
  }

  // Log page state
  const pageUrl = page.url();
  const pageTitle = await page.title();
  console.log(`[qr-login] Page: ${pageUrl} — "${pageTitle}"`);

  // Log what elements we can see
  const pageInfo = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.src?.substring(0, 120),
      w: img.naturalWidth || img.width,
      h: img.naturalHeight || img.height,
    }));
    const canvases = Array.from(document.querySelectorAll("canvas")).map((c) => ({
      w: c.width, h: c.height,
    }));
    const iframes = Array.from(document.querySelectorAll("iframe")).map((f) => ({
      src: f.src?.substring(0, 120),
    }));
    return { imgs, canvases, iframes };
  });
  console.log(`[qr-login] Page elements: ${JSON.stringify(pageInfo)}`);

  // --- Extract QR code ---
  let qrCodeBase64: string | null = null;

  // Strategy 1: Canvas element (common on newer login pages)
  if (!qrCodeBase64) {
    const canvases = await page.$$("canvas");
    for (const canvas of canvases) {
      const box = await canvas.boundingBox();
      if (box && box.width > 50 && box.height > 50) {
        console.log(`[qr-login] Found QR canvas: ${box.width}x${box.height}`);
        try {
          const buffer = await canvas.screenshot({ timeout: SCREENSHOT_TIMEOUT });
          qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
        } catch (e) {
          console.log(`[qr-login] Canvas screenshot failed: ${e instanceof Error ? e.message : e}`);
        }
        break;
      }
    }
  }

  // Strategy 2: QR code image
  if (!qrCodeBase64) {
    const images = await page.$$("img");
    for (const img of images) {
      const box = await img.boundingBox();
      if (box && box.width > 80 && box.height > 80 && box.width < 500) {
        const src = await img.getAttribute("src");
        console.log(`[qr-login] Found candidate image: ${box.width}x${box.height} src=${src?.substring(0, 80)}`);
        try {
          const buffer = await img.screenshot({ timeout: SCREENSHOT_TIMEOUT });
          qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
        } catch (e) {
          console.log(`[qr-login] Image screenshot failed: ${e instanceof Error ? e.message : e}`);
        }
        break;
      }
    }
  }

  // Strategy 3: Login iframe
  if (!qrCodeBase64) {
    const loginFrame = page.frames().find((f) =>
      f.url().includes("login-for-iframe") || f.url().includes("open.weixin")
    );
    if (loginFrame) {
      console.log(`[qr-login] Found login iframe: ${loginFrame.url()}`);
      try {
        await loginFrame.waitForSelector("img, canvas", { timeout: 10000 });
        await page.waitForTimeout(2000);
      } catch {
        // ignore
      }

      // Try canvas in iframe
      const iframeCanvases = await loginFrame.$$("canvas");
      for (const canvas of iframeCanvases) {
        const box = await canvas.boundingBox();
        if (box && box.width > 50 && box.height > 50) {
          try {
            const buffer = await canvas.screenshot({ timeout: SCREENSHOT_TIMEOUT });
            qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
          } catch (e) {
            console.log(`[qr-login] Iframe canvas screenshot failed: ${e instanceof Error ? e.message : e}`);
          }
          break;
        }
      }

      // Try img in iframe
      if (!qrCodeBase64) {
        const iframeImages = await loginFrame.$$("img");
        for (const img of iframeImages) {
          const box = await img.boundingBox();
          if (box && box.width > 80 && box.height > 80 && box.width < 500) {
            try {
              const buffer = await img.screenshot({ timeout: SCREENSHOT_TIMEOUT });
              qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
            } catch (e) {
              console.log(`[qr-login] Iframe img screenshot failed: ${e instanceof Error ? e.message : e}`);
            }
            break;
          }
        }
      }
    }
  }

  // Strategy 4: Full viewport screenshot (disable font waiting via CDP)
  if (!qrCodeBase64) {
    console.log("[qr-login] No QR element found, taking full page screenshot...");
    try {
      // Use CDP to take screenshot — bypasses Playwright's font waiting
      const cdp = await page.context().newCDPSession(page);
      const result = await cdp.send("Page.captureScreenshot", {
        format: "png",
        clip: { x: 0, y: 0, width: 1280, height: 800, scale: 1 },
      });
      qrCodeBase64 = `data:image/png;base64,${result.data}`;
      console.log("[qr-login] CDP screenshot taken successfully");
    } catch (e) {
      console.log(`[qr-login] CDP screenshot failed: ${e instanceof Error ? e.message : e}`);
      // Last resort: try with timeout
      try {
        const buffer = await page.screenshot({ fullPage: false, timeout: SCREENSHOT_TIMEOUT });
        qrCodeBase64 = `data:image/png;base64,${buffer.toString("base64")}`;
      } catch (e2) {
        console.log(`[qr-login] Fallback screenshot also failed: ${e2 instanceof Error ? e2.message : e2}`);
        // Return a placeholder
        qrCodeBase64 = "";
      }
    }
  }

  const sessionId = uuidv4();
  const expiresAt = new Date(Date.now() + config.sessionTimeoutMs);

  const cleanupTimer = setTimeout(() => {
    cleanupSession(sessionId);
  }, config.sessionTimeoutMs);

  const session: QrLoginSession = {
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

export async function checkStatus(
  sessionId: string
): Promise<QrLoginStatusResponse | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (session.status === "expired") {
    return { status: "expired", message: "QR code expired, please start a new session" };
  }

  if (session.status === "success") {
    return { status: "success" };
  }

  try {
    const currentUrl = session.page.url();

    // Check if page redirected away from login (login successful)
    if (
      !currentUrl.includes("/login") &&
      currentUrl.includes(PLATFORM_HOME_PATH)
    ) {
      console.log(`[qr-login] Session ${sessionId}: login successful, extracting cookies...`);

      const playwrightCookies = await session.context.cookies([
        "https://channels.weixin.qq.com",
        "https://weixin.qq.com",
        "https://qq.com",
        "https://wx.qq.com",
        "https://mp.weixin.qq.com",
      ]);
      console.log(`[qr-login] Found ${playwrightCookies.length} cookies across all domains`);
      console.log(`[qr-login] Cookie names: ${playwrightCookies.map(c => `${c.name}@${c.domain}`).join(", ")}`);

      const cookies: CookieData[] = playwrightCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as CookieData["sameSite"],
      }));

      session.status = "success";
      cleanupSession(sessionId);

      return { status: "success", cookies };
    }

    // Check for "scanned" visual state
    try {
      const scannedIndicator = await session.page.$(
        '[class*="scanned"], [class*="confirm"], .login__type__container__scan__ft'
      );
      if (scannedIndicator) {
        session.status = "scanned";
        return { status: "scanned", message: "QR code scanned, waiting for confirmation" };
      }
    } catch {
      // Ignore selector errors
    }

    return { status: "pending", message: "Waiting for QR code scan" };
  } catch (error) {
    console.error(`[qr-login] Error checking session ${sessionId}:`, error);
    cleanupSession(sessionId);
    return { status: "expired", message: "Session error, please try again" };
  }
}

async function cleanupSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;

  clearTimeout(session.cleanupTimer);

  try {
    await session.page.close();
    await session.context.close();
  } catch {
    // Ignore cleanup errors
  }

  sessions.delete(sessionId);
  console.log(`[qr-login] Session ${sessionId} cleaned up`);
}

export async function cleanupAllSessions(): Promise<void> {
  for (const sessionId of sessions.keys()) {
    await cleanupSession(sessionId);
  }
}
