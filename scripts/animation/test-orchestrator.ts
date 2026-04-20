/**
 * End-to-end test: user prompt → Director → Orchestrator → final video.
 *
 * Costs ~$2-3 depending on scene count and durations.
 *
 * Usage:
 *   npx tsx scripts/animation/test-orchestrator.ts ["user prompt"]
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { planAnimation } from "../../lib/animation/director";
import { orchestrateAnimation } from "../../lib/animation/orchestrator";
import { estimatePlanCostUsd } from "../../lib/animation/types";

async function main() {
  const prompt =
    process.argv[2] ||
    "A 16-second anime short about a girl and her cat on a rainy afternoon — the cat jumps onto her lap while she's reading, and they fall asleep together.";

  console.log("=== Animation End-to-End Test ===\n");
  console.log(`User prompt:\n  ${prompt}\n`);

  // Step 1: Director
  console.log("→ Step 1: Director (prompt → plan)");
  const planStart = Date.now();
  const plan = await planAnimation({ prompt });
  console.log(`  ✓ plan ready in ${((Date.now() - planStart) / 1000).toFixed(1)}s`);
  console.log(`    title: ${plan.title}`);
  console.log(`    scenes: ${plan.scenes.length} (${plan.scenes.reduce((s, sc) => s + sc.duration, 0)}s)`);
  console.log(`    est cost: $${estimatePlanCostUsd(plan).toFixed(2)}\n`);

  // Step 2: Orchestrator
  console.log("→ Step 2: Orchestrator (plan → final video)");
  const jobId = `test-${Date.now()}`;
  const orchStart = Date.now();
  const result = await orchestrateAnimation({
    plan,
    r2Prefix: `animation/${jobId}`,
    outputLocalPath: `/Users/wlin/dev/x-post-scheduler/public/videos/animation-${jobId}.mp4`,
    onProgress: (step, detail) => {
      const elapsed = Math.round((Date.now() - orchStart) / 1000);
      console.log(`  [${elapsed}s] ${step}${detail ? ": " + detail : ""}`);
    },
  });

  const totalSec = Math.round((Date.now() - orchStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Done in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`\n📁 Local:    ${result.finalLocalPath}`);
  console.log(`🎬 Final R2: ${result.finalUrl}`);
  console.log(`🎵 BGM:      ${result.bgmUrl}`);
  console.log(`🗣️  Narration clips: ${result.narrationUrls.length}`);
  console.log(`📷 Keyframes:`);
  result.keyframes.forEach((k) => console.log(`   ${k.id}: ${k.url}`));
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
