import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { resolveTextModel } from "./ai-models";
import type { TokenUsage } from "./usage-tracking";

interface CampaignInput {
  name: string;
  client: string | null;
  description: string | null;
  budgetCents: number | null;
  startDate: Date | null;
  endDate: Date | null;
  notes: string | null;
  materials: Array<{
    sourceName?: string | null;
    sourceContent?: string | null;
    sourceType?: string | null;
    sourceUrl?: string | null;
    imageAlt?: string | null;
    imageType?: string | null;
    note?: string | null;
  }>;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
  }>;
  modelId?: string;
  locale?: string;
}

function detectLanguage(input: CampaignInput): string {
  const text = [input.name, input.client, input.description, input.notes]
    .filter(Boolean)
    .join(" ");
  // Check for CJK characters (Chinese/Japanese/Korean)
  const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf]/;
  if (cjkPattern.test(text)) return "Chinese (简体中文)";
  if (input.locale === "zh") return "Chinese (简体中文)";
  return "English";
}

interface AnalysisResult {
  success: boolean;
  analysis?: string;
  error?: string;
  usage?: TokenUsage;
  modelId?: string;
}

export interface BudgetItem {
  category: string;
  item: string;
  amountCents: number;
  reasoning: string;
}

export interface BudgetData {
  currency: string;
  items: BudgetItem[];
  totalCents: number;
  summary: string;
}

interface BudgetResult {
  success: boolean;
  budget?: BudgetData;
  error?: string;
  usage?: TokenUsage;
  modelId?: string;
}

function buildCampaignContext(input: CampaignInput): string {
  const parts: string[] = [];
  parts.push(`Campaign: ${input.name}`);
  if (input.client) parts.push(`Client/Brand: ${input.client}`);
  if (input.description) parts.push(`Description: ${input.description}`);
  if (input.budgetCents) parts.push(`Budget: $${(input.budgetCents / 100).toFixed(2)}`);
  if (input.startDate) parts.push(`Start: ${input.startDate.toISOString().split("T")[0]}`);
  if (input.endDate) parts.push(`End: ${input.endDate.toISOString().split("T")[0]}`);
  if (input.notes) parts.push(`Notes: ${input.notes}`);

  if (input.materials.length > 0) {
    parts.push("\n--- Knowledge Base Materials ---");
    for (const m of input.materials) {
      if (m.sourceName) {
        parts.push(`\nSource: ${m.sourceName} (${m.sourceType || "website"})`);
        if (m.sourceUrl) parts.push(`URL: ${m.sourceUrl}`);
        if (m.note) parts.push(`Relevance: ${m.note}`);
        if (m.sourceContent) {
          const truncated = m.sourceContent.length > 3000
            ? m.sourceContent.substring(0, 3000) + "...(truncated)"
            : m.sourceContent;
          parts.push(`Content:\n${truncated}`);
        }
      }
      if (m.imageAlt) {
        parts.push(`Media: ${m.imageType || "image"} - ${m.imageAlt}`);
      }
    }
  }

  if (input.attachments && input.attachments.length > 0) {
    parts.push("\n--- Uploaded Attachments ---");
    for (const att of input.attachments) {
      parts.push(`File: ${att.fileName} (${att.fileType}, ${(att.fileSize / 1024).toFixed(1)} KB)`);
    }
  }

  return parts.join("\n");
}

export async function analyzeCampaign(input: CampaignInput): Promise<AnalysisResult> {
  const model = resolveTextModel(input.modelId);
  const campaignContext = buildCampaignContext(input);
  const lang = detectLanguage(input);

  const systemPrompt = `You are an expert advertising strategist and marketing consultant. Analyze the campaign information and linked knowledge base materials to produce a comprehensive advertising strategy.

Your analysis should be practical, actionable, and tailored to the specific client/brand. You MUST write your entire response in ${lang}.

Structure your analysis with the following sections using markdown headers:

## Executive Summary
A brief overview of the recommended strategy (2-3 sentences).

## Target Audience
- Primary audience demographics and psychographics
- Secondary audiences to consider
- Key audience insights from the knowledge base materials

## Content Strategy
- Content pillars and themes
- Content formats recommended (video, image, text, etc.)
- Tone and voice guidelines
- Key messages and talking points

## Platform Recommendations
- Which social platforms to prioritize and why
- Platform-specific tactics
- Cross-platform synergy opportunities

## Key Messages
- 3-5 core messages for the campaign
- Supporting points for each message

## Posting Calendar
- Recommended posting frequency per platform
- Best times to post
- Campaign phases and milestones

${input.budgetCents ? `## Budget Allocation
- Recommended budget split across platforms and activities
- Priority investments
- Cost optimization tips` : ""}

## Success Metrics
- KPIs to track
- Benchmarks and targets
- Measurement tools and methods`;

  try {
    const result = await generateText({
      model: gateway(model.id),
      system: systemPrompt,
      prompt: `Analyze this campaign and provide a comprehensive advertising strategy:\n\n${campaignContext}`,
      maxOutputTokens: 2000,
      temperature: 0.7,
    });

    const analysis = result.text?.trim();
    if (!analysis) {
      return { success: false, error: "No analysis generated", modelId: model.id };
    }

    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;

    return {
      success: true,
      analysis,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      modelId: model.id,
    };
  } catch (error) {
    console.error("[campaign-analysis] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
      modelId: model.id,
    };
  }
}

export async function analyzeBudget(input: CampaignInput): Promise<BudgetResult> {
  const model = resolveTextModel(input.modelId);
  const campaignContext = buildCampaignContext(input);
  const lang = detectLanguage(input);

  const systemPrompt = `You are an expert advertising budget planner and media buying specialist. Analyze the campaign information and linked knowledge base materials to produce a detailed budget recommendation.

Your response MUST be valid JSON only — no markdown, no extra text, no code fences. You MUST write all text fields (category, item, reasoning, summary) in ${lang}.

Return this exact JSON structure:
{
  "currency": "USD",
  "items": [
    {
      "category": "Category name (e.g. Content Production, Media Buy, Influencer, Platform Fees, Design, Analytics)",
      "item": "Specific line item description",
      "amountCents": 10000,
      "reasoning": "Why this cost is needed and how the amount was estimated"
    }
  ],
  "totalCents": 10000,
  "summary": "1-2 sentence overall budget rationale"
}

Guidelines:
- All amounts in cents (e.g. $100.00 = 10000)
- Include 5-15 line items covering all major budget areas
- If the campaign has a stated budget, distribute within that budget
- If no budget is stated, recommend an appropriate budget based on campaign scope
- Group items by category (Content Production, Media Buy, Influencer Marketing, Platform/Tools, Creative/Design, Analytics/Reporting, etc.)
- Each reasoning field should explain the cost estimation logic
- totalCents must equal the sum of all item amountCents`;

  try {
    const result = await generateText({
      model: gateway(model.id),
      system: systemPrompt,
      prompt: `Analyze this campaign and provide a detailed budget recommendation as JSON:\n\n${campaignContext}`,
      maxOutputTokens: 2000,
      temperature: 0.5,
    });

    const text = result.text?.trim();
    if (!text) {
      return { success: false, error: "No budget generated", modelId: model.id };
    }

    // Parse JSON — strip code fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    let budget: BudgetData;
    try {
      budget = JSON.parse(jsonStr);
    } catch {
      return { success: false, error: "Failed to parse budget JSON", modelId: model.id };
    }

    // Validate structure
    if (!budget.items || !Array.isArray(budget.items) || budget.items.length === 0) {
      return { success: false, error: "Invalid budget structure", modelId: model.id };
    }

    // Recalculate total from items to ensure consistency
    budget.totalCents = budget.items.reduce((sum, item) => sum + (item.amountCents || 0), 0);
    budget.currency = budget.currency || "USD";

    const inputTokens = result.usage.inputTokens ?? 0;
    const outputTokens = result.usage.outputTokens ?? 0;

    return {
      success: true,
      budget,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      modelId: model.id,
    };
  } catch (error) {
    console.error("[campaign-budget] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Budget analysis failed",
      modelId: model.id,
    };
  }
}
