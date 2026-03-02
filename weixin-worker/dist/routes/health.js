"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const qr_login_service_js_1 = require("../services/qr-login-service.js");
async function healthRoutes(app) {
    app.get("/health", async () => {
        return {
            ok: true,
            activeSessions: (0, qr_login_service_js_1.getActiveSessionCount)(),
            timestamp: new Date().toISOString(),
        };
    });
}
