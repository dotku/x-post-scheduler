"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeRoutes = scrapeRoutes;
const scraper_service_js_1 = require("../services/scraper-service.js");
async function scrapeRoutes(app) {
    app.post("/scrape/channel", async (request, reply) => {
        const { cookies, channelId } = request.body;
        if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
            return reply.status(400).send({
                success: false,
                error: "cookies array is required",
            });
        }
        try {
            const result = await (0, scraper_service_js_1.scrapeChannel)(cookies, channelId);
            return reply.send(result);
        }
        catch (error) {
            console.error("[scrape] Error:", error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : "Scraping failed",
            });
        }
    });
}
