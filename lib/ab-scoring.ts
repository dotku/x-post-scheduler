import { getOpenAIClient } from "./openai";
import type { TokenUsage } from "./usage-tracking";

export interface ScoredCandidate {
  content: string;
  score: number;
  reasoning: string;
}

export interface ABScoringResult {
  success: boolean;
  candidates?: ScoredCandidate[];
  usage?: TokenUsage;
  error?: string;
}

/**
 * Score multiple tweet candidates using AI based on predicted engagement.
 * Optionally uses the user's content profile for personalized scoring.
 * Returns candidates sorted by score (highest first).
 */
export async function scoreTweetCandidates(
  candidates: string[],
  contentProfile?: string,
): Promise<ABScoringResult> {
  if (candidates.length === 0) {
    return { success: false, error: "No candidates to score" };
  }

  if (candidates.length === 1) {
    return {
      success: true,
      candidates: [{ content: candidates[0], score: 50, reasoning: "Single candidate" }],
    };
  }

  try {
    const client = getOpenAIClient();

    const profileSection = contentProfile
      ? `\n## This account's content profile (what works for them):\n${contentProfile}\n`
      : "";

    const candidatesList = candidates
      .map((c, i) => `[${i + 1}] "${c}"`)
      .join("\n\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a social media engagement predictor. Score tweet candidates on predicted engagement (0-100).
${profileSection}
Respond ONLY in this exact JSON format (no markdown, no code blocks):
[{"index":1,"score":85,"reasoning":"..."},{"index":2,"score":72,"reasoning":"..."}]`,
        },
        {
          role: "user",
          content: `Score these tweet candidates:\n\n${candidatesList}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const usage: TokenUsage | undefined = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens ?? 0,
          completionTokens: response.usage.completion_tokens ?? 0,
          totalTokens: response.usage.total_tokens ?? 0,
        }
      : undefined;

    // Parse JSON response
    let scores: Array<{ index: number; score: number; reasoning: string }>;
    try {
      const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      scores = JSON.parse(cleaned);
    } catch {
      // Fallback: return equal scores
      return {
        success: true,
        candidates: candidates.map((c) => ({
          content: c,
          score: 50,
          reasoning: "Scoring parse failed",
        })),
        usage,
      };
    }

    // Map scores back to candidates
    const scored: ScoredCandidate[] = candidates.map((c, i) => {
      const match = scores.find((s) => s.index === i + 1);
      return {
        content: c,
        score: match?.score ?? 50,
        reasoning: match?.reasoning ?? "No reasoning provided",
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return { success: true, candidates: scored, usage };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
