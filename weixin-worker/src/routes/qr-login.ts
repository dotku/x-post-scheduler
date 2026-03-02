import type { FastifyInstance } from "fastify";
import { startLogin, checkStatus } from "../services/qr-login-service.js";
import { recordRequestStart, recordRequestEnd } from "../services/metrics.js";
import { randomUUID } from "crypto";

export async function qrLoginRoutes(app: FastifyInstance) {
  app.post("/qr-login/start", async (request, reply) => {
    const userId = request.headers["x-user-id"] as string | undefined;
    const opId = randomUUID();
    recordRequestStart(opId, "qr-login", userId);

    try {
      const result = await startLogin();
      recordRequestEnd(opId, true);
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to start QR login";
      recordRequestEnd(opId, false, msg);
      console.error("[qr-login] Start error:", error);
      return reply.status(500).send({ error: msg });
    }
  });

  app.get<{ Params: { sessionId: string } }>(
    "/qr-login/:sessionId/status",
    async (request, reply) => {
      const { sessionId } = request.params;

      try {
        const result = await checkStatus(sessionId);
        if (!result) {
          return reply.send({ status: "pending", message: "Session not found on this instance" });
        }
        return reply.send(result);
      } catch (error) {
        console.error("[qr-login] Status check error:", error);
        return reply.status(500).send({
          error: error instanceof Error ? error.message : "Failed to check status",
        });
      }
    }
  );
}
