"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBrowser = getBrowser;
exports.closeBrowser = closeBrowser;
const playwright_1 = require("playwright");
const config_js_1 = require("../config.js");
let browser = null;
async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        console.log("[browser-pool] Launching Chromium...");
        browser = await playwright_1.chromium.launch({
            headless: true,
            args: config_js_1.config.browserArgs,
        });
        console.log("[browser-pool] Chromium launched");
    }
    return browser;
}
async function closeBrowser() {
    if (browser) {
        console.log("[browser-pool] Closing Chromium...");
        await browser.close();
        browser = null;
        console.log("[browser-pool] Chromium closed");
    }
}
