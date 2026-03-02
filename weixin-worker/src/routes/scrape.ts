import type { FastifyInstance } from "fastify";
import type { ScrapeRequest, DownloadRequest, ResolveVideoUrlsRequest } from "../types.js";
import { scrapeChannel, resolveVideoUrls } from "../services/scraper-service.js";
import { downloadVideo } from "../services/download-service.js";
import { recordRequestStart, recordRequestEnd } from "../services/metrics.js";
import { randomUUID } from "crypto";

export async function scrapeRoutes(app: FastifyInstance) {
  app.post<{ Body: ScrapeRequest }>("/scrape/channel", async (request, reply) => {
    const { cookies, channelId } = request.body;
    const userId = request.headers["x-user-id"] as string | undefined;
    const opId = randomUUID();

    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      return reply.status(400).send({
        success: false,
        error: "cookies array is required",
      });
    }

    recordRequestStart(opId, "scrape", userId);
    try {
      const result = await scrapeChannel(cookies, channelId);
      recordRequestEnd(opId, result.success, result.error);
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Scraping failed";
      recordRequestEnd(opId, false, msg);
      console.error("[scrape] Error:", error);
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  app.post<{ Body: ResolveVideoUrlsRequest }>("/resolve/video-urls", async (request, reply) => {
    const { cookies, videos } = request.body;
    const userId = request.headers["x-user-id"] as string | undefined;
    const opId = randomUUID();

    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      return reply.status(400).send({ results: [], error: "cookies array is required" });
    }
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      return reply.status(400).send({ results: [], error: "videos array is required" });
    }

    recordRequestStart(opId, "resolve", userId);
    try {
      const results = await resolveVideoUrls(cookies, videos);
      const anyResolved = results.some((r) => r.videoUrl);
      recordRequestEnd(opId, anyResolved);
      return reply.send({ results });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Resolution failed";
      recordRequestEnd(opId, false, msg);
      console.error("[resolve] Error:", error);
      return reply.status(500).send({ results: [], error: msg });
    }
  });

  app.post<{ Body: DownloadRequest }>("/download/video", async (request, reply) => {
    const { cookies, videoUrl, filename } = request.body;
    const userId = request.headers["x-user-id"] as string | undefined;
    const opId = randomUUID();

    if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
      return reply.status(400).send({
        success: false,
        error: "cookies array is required",
      });
    }

    if (!videoUrl) {
      return reply.status(400).send({
        success: false,
        error: "videoUrl is required",
      });
    }

    recordRequestStart(opId, "download", userId);
    try {
      const result = await downloadVideo(cookies, videoUrl, filename);
      recordRequestEnd(opId, result.success, result.error);
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Download failed";
      recordRequestEnd(opId, false, msg);
      console.error("[download] Error:", error);
      return reply.status(500).send({ success: false, error: msg });
    }
  });
}
