import type { FastifyInstance } from "fastify";

export async function homeRoutes(app: FastifyInstance) {
  app.get("/", async (_request, reply) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Weixin Worker — JY Tech LLC</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      max-width: 600px;
      text-align: center;
    }
    .logo {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    .company {
      font-size: 1rem;
      color: #94a3b8;
      margin-bottom: 32px;
      letter-spacing: 0.05em;
    }
    .tagline {
      font-size: 1.15rem;
      color: #cbd5e1;
      line-height: 1.6;
      margin-bottom: 40px;
    }
    .badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 500;
      background: #1e293b;
      border: 1px solid #334155;
      color: #94a3b8;
      margin-bottom: 32px;
    }
    .badge .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      margin-right: 8px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .links {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .links a {
      padding: 10px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    .links a.primary {
      background: #3b82f6;
      color: white;
    }
    .links a.primary:hover { background: #2563eb; }
    .links a.secondary {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
    }
    .links a.secondary:hover { background: #334155; color: #e2e8f0; }
    .footer {
      margin-top: 64px;
      font-size: 0.75rem;
      color: #475569;
      line-height: 1.8;
    }
    .footer a { color: #64748b; text-decoration: none; }
    .footer a:hover { color: #94a3b8; }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
      text-align: left;
    }
    .feature {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 16px;
    }
    .feature-icon { font-size: 1.3rem; margin-bottom: 8px; }
    .feature-title { font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 4px; }
    .feature-desc { font-size: 0.75rem; color: #64748b; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Weixin Worker</div>
    <div class="company">A product of JY Tech LLC</div>

    <div class="badge"><span class="dot"></span>Operational &mdash; Singapore (sin)</div>

    <p class="tagline">
      Headless browser automation service for WeChat Channel content management.
      Handles QR login, channel scraping, video resolution, and media downloads.
    </p>

    <div class="features">
      <div class="feature">
        <div class="feature-icon">&#128274;</div>
        <div class="feature-title">QR Login</div>
        <div class="feature-desc">Secure WeChat authentication via QR code scanning</div>
      </div>
      <div class="feature">
        <div class="feature-icon">&#128240;</div>
        <div class="feature-title">Channel Scraping</div>
        <div class="feature-desc">Extract video metadata from WeChat Channel Assistant</div>
      </div>
      <div class="feature">
        <div class="feature-icon">&#127916;</div>
        <div class="feature-title">Video Download</div>
        <div class="feature-desc">Download and store video files to cloud storage</div>
      </div>
      <div class="feature">
        <div class="feature-icon">&#128200;</div>
        <div class="feature-title">Monitoring</div>
        <div class="feature-desc">Real-time usage stats and cost estimation</div>
      </div>
    </div>

    <div class="links">
      <a href="/stats" class="primary">View Stats</a>
      <a href="/health" class="secondary">Health Check</a>
    </div>

    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} JY Tech LLC. All rights reserved.</p>
      <p>Powered by <a href="https://fly.io">Fly.io</a> &middot; <a href="https://playwright.dev">Playwright</a> &middot; <a href="https://fastify.dev">Fastify</a></p>
    </div>
  </div>
</body>
</html>`;

    return reply.type("text/html").send(html);
  });
}
