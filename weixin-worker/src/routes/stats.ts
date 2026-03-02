import type { FastifyInstance } from "fastify";
import { getMetrics } from "../services/metrics.js";
import { getActiveSessionCount } from "../services/qr-login-service.js";

export async function statsRoutes(app: FastifyInstance) {
  // JSON API
  app.get("/stats/json", async () => {
    const metrics = getMetrics();
    return {
      ...metrics,
      activeSessions: getActiveSessionCount(),
    };
  });

  // HTML dashboard
  app.get("/stats", async (_request, reply) => {
    const m = getMetrics();
    const activeSessions = getActiveSessionCount();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weixin Worker Stats</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; color: #f8fafc; }
    .subtitle { color: #94a3b8; font-size: 0.85rem; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 4px; }
    .card-value { font-size: 1.75rem; font-weight: 700; color: #f8fafc; }
    .card-sub { font-size: 0.8rem; color: #64748b; margin-top: 4px; }
    h2 { font-size: 1.1rem; margin-bottom: 12px; color: #f8fafc; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #334155; font-size: 0.85rem; }
    th { color: #94a3b8; font-weight: 500; }
    td { color: #cbd5e1; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
    .badge-success { background: #166534; color: #4ade80; }
    .badge-fail { background: #7f1d1d; color: #fca5a5; }
    .badge-active { background: #1e3a5f; color: #60a5fa; }
    .section { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px; }
    .cost-highlight { color: #fbbf24; font-weight: 600; }
    .refresh { position: fixed; bottom: 20px; right: 20px; background: #3b82f6; color: white; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
    .refresh:hover { background: #2563eb; }
    .mono { font-family: "SF Mono", Menlo, monospace; font-size: 0.8rem; }
  </style>
</head>
<body>
  <h1>Weixin Worker Stats</h1>
  <p class="subtitle">xpilot-weixin-worker.fly.dev &mdash; Singapore (sin) &mdash; Up ${m.uptime.uptimeHuman}</p>

  <div class="grid">
    <div class="card">
      <div class="card-label">Total Requests</div>
      <div class="card-value">${m.requests.total}</div>
      <div class="card-sub">${m.requests.lastHour} last hour</div>
    </div>
    <div class="card">
      <div class="card-label">Active Now</div>
      <div class="card-value">${m.requests.active}</div>
      <div class="card-sub">${activeSessions} QR sessions</div>
    </div>
    <div class="card">
      <div class="card-label">Success Rate</div>
      <div class="card-value">${m.performance.successRate}%</div>
      <div class="card-sub">Avg ${m.performance.avgDurationMs}ms</div>
    </div>
    <div class="card">
      <div class="card-label">Memory</div>
      <div class="card-value">${m.memory.rss}</div>
      <div class="card-sub">Heap: ${m.memory.heapUsed} / ${m.memory.heapTotal}</div>
    </div>
  </div>

  <div class="section">
    <h2>Cost Estimate</h2>
    <table>
      <tr><td>Machine</td><td>shared-cpu-1x / 1GB RAM / Singapore</td></tr>
      <tr><td>Hourly rate</td><td class="cost-highlight">$${m.cost.hourlyRateUsd}/hr</td></tr>
      <tr><td>Current session uptime</td><td>${m.cost.uptimeHours} hours</td></tr>
      <tr><td>This session cost</td><td class="cost-highlight">$${m.cost.estimatedSessionCostUsd}</td></tr>
      <tr><td>If running 24/7</td><td>~$${m.cost.monthlyEstimateUsd}/month</td></tr>
      <tr><td>Note</td><td>${m.cost.note}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Operations (Last 24h)</h2>
    <div class="grid" style="grid-template-columns: repeat(4, 1fr);">
      <div><div class="card-label">Scrape</div><div style="font-size:1.2rem;font-weight:600">${m.operations.last24h.scrape}</div></div>
      <div><div class="card-label">QR Login</div><div style="font-size:1.2rem;font-weight:600">${m.operations.last24h["qr-login"]}</div></div>
      <div><div class="card-label">Resolve URL</div><div style="font-size:1.2rem;font-weight:600">${m.operations.last24h.resolve}</div></div>
      <div><div class="card-label">Download</div><div style="font-size:1.2rem;font-weight:600">${m.operations.last24h.download}</div></div>
    </div>
  </div>

  ${m.users.length > 0 ? `
  <div class="section">
    <h2>Users</h2>
    <table>
      <tr><th>User</th><th>Requests</th><th>Scrape</th><th>Login</th><th>Resolve</th><th>Download</th><th>Last Active</th></tr>
      ${m.users.map((u) => `
        <tr>
          <td class="mono">${u.id}</td>
          <td>${u.requests}</td>
          <td>${u.operations.scrape}</td>
          <td>${u.operations.qrLogin}</td>
          <td>${u.operations.resolve}</td>
          <td>${u.operations.download}</td>
          <td>${new Date(u.lastActive).toLocaleString()}</td>
        </tr>
      `).join("")}
    </table>
  </div>` : ""}

  ${m.recentOperations.length > 0 ? `
  <div class="section">
    <h2>Recent Operations</h2>
    <table>
      <tr><th>Type</th><th>User</th><th>Duration</th><th>Status</th><th>Time</th></tr>
      ${m.recentOperations.map((op) => `
        <tr>
          <td>${op.type}</td>
          <td class="mono">${op.user}</td>
          <td>${op.durationMs ? (op.durationMs / 1000).toFixed(1) + "s" : "-"}</td>
          <td>${op.success === true ? '<span class="badge badge-success">OK</span>' : op.success === false ? '<span class="badge badge-fail">FAIL</span>' : '<span class="badge badge-active">Active</span>'}</td>
          <td>${new Date(op.at).toLocaleTimeString()}</td>
        </tr>
      `).join("")}
    </table>
  </div>` : ""}

  <button class="refresh" onclick="location.reload()">Refresh</button>
</body>
</html>`;

    return reply.type("text/html").send(html);
  });
}
