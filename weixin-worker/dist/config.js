"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    port: parseInt(process.env.PORT || "8080", 10),
    workerSecret: process.env.WEIXIN_WORKER_SECRET || "",
    sessionTimeoutMs: 5 * 60 * 1000, // 5 minutes for QR login
    browserArgs: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
    ],
};
