export const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  workerSecret: process.env.WEIXIN_WORKER_SECRET || "",
  sessionTimeoutMs: 5 * 60 * 1000, // 5 minutes for QR login
  browserArgs: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disk-cache-size=0",        // No shared disk cache between contexts
    "--aggressive-cache-discard",  // Discard cache aggressively
  ],
};
