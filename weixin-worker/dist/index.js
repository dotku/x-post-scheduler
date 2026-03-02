"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const config_js_1 = require("./config.js");
const auth_js_1 = require("./auth.js");
const health_js_1 = require("./routes/health.js");
const qr_login_js_1 = require("./routes/qr-login.js");
const scrape_js_1 = require("./routes/scrape.js");
const browser_pool_js_1 = require("./services/browser-pool.js");
const qr_login_service_js_1 = require("./services/qr-login-service.js");
async function main() {
    const app = (0, fastify_1.default)({ logger: true });
    // Auth middleware (skips /health)
    app.addHook("preHandler", async (request, reply) => {
        if (request.url === "/health")
            return;
        return (0, auth_js_1.verifyAuth)(request, reply);
    });
    // Register routes
    await app.register(health_js_1.healthRoutes);
    await app.register(qr_login_js_1.qrLoginRoutes);
    await app.register(scrape_js_1.scrapeRoutes);
    // Graceful shutdown
    async function shutdown() {
        console.log("[server] Shutting down...");
        (0, qr_login_service_js_1.cleanupAllSessions)();
        await (0, browser_pool_js_1.closeBrowser)();
        await app.close();
        process.exit(0);
    }
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
    // Start server
    try {
        await app.listen({ port: config_js_1.config.port, host: "0.0.0.0" });
        console.log(`[server] Weixin worker listening on port ${config_js_1.config.port}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
main();
