import { Browser, chromium } from "playwright";
import { config } from "../config.js";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    console.log("[browser-pool] Launching Chromium...");
    browser = await chromium.launch({
      headless: true,
      args: config.browserArgs,
    });
    console.log("[browser-pool] Chromium launched");
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    console.log("[browser-pool] Closing Chromium...");
    await browser.close();
    browser = null;
    console.log("[browser-pool] Chromium closed");
  }
}
