import Fastify from "fastify";
import { config } from "./config.js";
import { verifyAuth } from "./auth.js";
import { homeRoutes } from "./routes/home.js";
import { healthRoutes } from "./routes/health.js";
import { statsRoutes } from "./routes/stats.js";
import { qrLoginRoutes } from "./routes/qr-login.js";
import { scrapeRoutes } from "./routes/scrape.js";
import { closeBrowser } from "./services/browser-pool.js";
import { cleanupAllSessions } from "./services/qr-login-service.js";

async function main() {
  const app = Fastify({ logger: true });

  // Auth middleware (skips public pages: /, /health, /stats)
  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/" || request.url === "/health" || request.url.startsWith("/stats")) return;
    return verifyAuth(request, reply);
  });

  // Register routes
  await app.register(homeRoutes);
  await app.register(healthRoutes);
  await app.register(statsRoutes);
  await app.register(qrLoginRoutes);
  await app.register(scrapeRoutes);

  // Graceful shutdown
  async function shutdown() {
    console.log("[server] Shutting down...");
    cleanupAllSessions();
    await closeBrowser();
    await app.close();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start server
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`[server] Weixin worker listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
