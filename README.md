This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Cloudflare Cron Setup

This project can use Cloudflare Workers Cron Triggers to invoke backend automation routes:

- Every minute: `POST /api/scheduler`
- Daily at `00:00` UTC: `POST /api/daily-generate`

Configuration files:

- `cloudflare-cron/wrangler.toml`
- `cloudflare-cron/src/index.ts`

### 1. Install Wrangler

```bash
npm install -g wrangler
```

### 2. Authenticate

```bash
wrangler login
```

### 3. Configure Worker secrets/vars

Run these in `cloudflare-cron/`:

```bash
wrangler secret put APP_BASE_URL
wrangler secret put CRON_SECRET
```

Use your production app URL for `APP_BASE_URL` (for example, `https://your-app.vercel.app`) and the same `CRON_SECRET` value configured in your app environment.

### 4. Deploy the cron worker

```bash
cd cloudflare-cron
wrangler deploy
```

### 5. Verify

- In Cloudflare dashboard, check the Worker Cron Triggers for:
  - `* * * * *`
  - `0 0 * * *`
- Confirm your app logs show authorized calls to:
  - `/api/scheduler`
  - `/api/daily-generate`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
