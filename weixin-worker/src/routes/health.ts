import type { FastifyInstance } from "fastify";
import { getActiveSessionCount } from "../services/qr-login-service.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      ok: true,
      activeSessions: getActiveSessionCount(),
      timestamp: new Date().toISOString(),
    };
  });
}
