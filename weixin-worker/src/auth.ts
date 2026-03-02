import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "./config.js";

export async function verifyAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip auth in dev when no secret is set
  if (!config.workerSecret) return;

  const header = request.headers.authorization;
  if (header !== `Bearer ${config.workerSecret}`) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}
