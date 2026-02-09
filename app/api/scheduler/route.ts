import { NextResponse } from "next/server";
import { runScheduler } from "@/lib/scheduler";

// This endpoint can be triggered by:
// 1. A cron job (e.g., Vercel Cron, external cron service)
// 2. Manual trigger from the UI
// 3. A background worker process

export async function POST() {
  const result = await runScheduler();
  return NextResponse.json(result);
}

// Also support GET for easy testing
export async function GET() {
  const result = await runScheduler();
  return NextResponse.json(result);
}
