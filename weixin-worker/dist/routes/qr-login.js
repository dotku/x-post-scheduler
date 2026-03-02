"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qrLoginRoutes = qrLoginRoutes;
const qr_login_service_js_1 = require("../services/qr-login-service.js");
async function qrLoginRoutes(app) {
    app.post("/qr-login/start", async (_request, reply) => {
        try {
            const result = await (0, qr_login_service_js_1.startLogin)();
            return reply.send(result);
        }
        catch (error) {
            console.error("[qr-login] Start error:", error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Failed to start QR login",
            });
        }
    });
    app.get("/qr-login/:sessionId/status", async (request, reply) => {
        const { sessionId } = request.params;
        try {
            const result = await (0, qr_login_service_js_1.checkStatus)(sessionId);
            if (!result) {
                return reply.send({ status: "pending", message: "Session not found on this instance" });
            }
            return reply.send(result);
        }
        catch (error) {
            console.error("[qr-login] Status check error:", error);
            return reply.status(500).send({
                error: error instanceof Error ? error.message : "Failed to check status",
            });
        }
    });
}
