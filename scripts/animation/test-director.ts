/**
 * Test the AI Director: give it a user prompt, inspect the generated plan.
 * Costs ~$0.01-0.05 per run (pure LLM, no video generation).
 *
 * Usage:
 *   npx tsx scripts/animation/test-director.ts "大学初恋，舞蹈课相遇"
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { planAnimation } from "../../lib/animation/director";
import { estimatePlanCostUsd } from "../../lib/animation/types";

async function main() {
  const prompt =
    process.argv[2] ||
    "A 30-second anime short about two college students — a Caucasian girl and an Asian boy — meeting in a ballroom dance class on the first day of the semester. They're shy, their first steps are clumsy, but they quickly find their rhythm and fall for each other.";

  console.log("=== AI Director Test ===");
  console.log(`\nUser prompt:\n  ${prompt}\n`);
  console.log("→ Calling director…\n");

  const start = Date.now();
  const plan = await planAnimation({ prompt });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`✓ Plan generated in ${elapsed}s\n`);
  console.log(JSON.stringify(plan, null, 2));

  const totalSec = plan.scenes.reduce((s, sc) => s + sc.duration, 0);
  console.log("\n────────────────────────────────────────");
  console.log(`Title:          ${plan.title}`);
  console.log(`Scenes:         ${plan.scenes.length}`);
  console.log(`Video duration: ${totalSec}s`);
  console.log(`Video model:    ${plan.videoModel}`);
  console.log(`Narration:      ${plan.scenes.filter((s) => s.narration).length} / ${plan.scenes.length} scenes`);
  console.log(`Est. cost:      $${estimatePlanCostUsd(plan).toFixed(2)}`);

  // Sanity check: characters anchor appears in every scene?
  const charSnippet = plan.characters.slice(0, 50);
  const allContainChars = plan.scenes.every((s) => s.imagePrompt.includes(charSnippet));
  console.log(`Char consistency: ${allContainChars ? "✓ all scenes include characters anchor" : "✗ some scenes missing anchor"}`);

  const styleSnippet = plan.style.slice(0, 50);
  const allContainStyle = plan.scenes.every((s) => s.imagePrompt.includes(styleSnippet));
  console.log(`Style consistency: ${allContainStyle ? "✓ all scenes include style anchor" : "✗ some scenes missing anchor"}`);
}

main().catch((e) => {
  console.error("Fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
