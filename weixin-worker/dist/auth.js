"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuth = verifyAuth;
const config_js_1 = require("./config.js");
async function verifyAuth(request, reply) {
    // Skip auth in dev when no secret is set
    if (!config_js_1.config.workerSecret)
        return;
    const header = request.headers.authorization;
    if (header !== `Bearer ${config_js_1.config.workerSecret}`) {
        reply.code(401).send({ error: "Unauthorized" });
    }
}
