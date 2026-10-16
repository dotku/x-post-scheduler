# Cloudflare Cron Worker

All of xPilot's scheduled jobs are driven by a small Cloudflare Worker (`cloudflare-cron/`). On each tick it POSTs to authenticated route handlers in the main app.

- `cloudflare-cron/wrangler.toml`: trigger schedule (production + `dev` env)
- `cloudflare-cron/src/index.ts`: job fan-out logic

## Schedule (production)

The Cloudflare free plan allows 5 cron triggers per account, shared across all workers. The worker therefore runs on a 2-minute trigger and gates the less frequent jobs by UTC hour.

| When (UTC) | Endpoint |
| --- | --- |
| Every 2 min | `POST /api/toolbox/tasks/process` |
| Every 2 min | `POST /api/cron/recurring-youtube` |
| Every 2 min | `POST /api/scheduler/youtube-post` |
| 01:00, 13:00, 23:00 | `POST /api/scheduler` |
| 01:00 | `POST /api/daily-generate` |
| 01:00 | `POST /api/cron/media-news?period=daily` (plus `period=weekly` on Mondays) |
| 01:00 | `POST /api/cron/snapshot-followers` |
| 23:00 | `POST /api/cron/media-x?period=daily` (plus `period=weekly` on Sundays) |

Each request carries `Authorization: Bearer <CRON_SECRET>`, and the app rejects requests whose secret does not match. Every run is logged to the `CronRunEvent` table.

The `dev` environment (`xpilot-cron-dev`) runs every 5 minutes.

## Setup

```bash
npm install -g wrangler
wrangler login
cd cloudflare-cron

# Production
wrangler secret put APP_BASE_URL   # e.g. https://your-app.example.com
wrangler secret put CRON_SECRET    # must equal the app's CRON_SECRET
wrangler deploy

# Dev / staging
wrangler secret put APP_BASE_URL --env dev
wrangler secret put CRON_SECRET --env dev
wrangler deploy --env dev
```

## Verify

- In the Cloudflare dashboard, open the worker's **Triggers** tab and confirm that the cron expressions match `wrangler.toml`.
- Use the worker's observability logs to see failed calls (`<label> failed (<status>)`).
- In the app, look for new `CronRunEvent` rows (shown in the admin dashboard).

## Running a job manually

```bash
curl -X POST "$APP_BASE_URL/api/scheduler" -H "Authorization: Bearer $CRON_SECRET"
```
