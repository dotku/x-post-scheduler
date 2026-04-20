/**
 * OpenAI-compatible /v1/chat/completions endpoint.
 *
 * Allows any OpenAI-compatible client (Cline, Cursor, Continue, Zed, etc.)
 * to use xPilot as their LLM provider. Routes internally through the
 * Vercel AI Gateway so Claude/GPT/Gemini are billed at upstream cost (0% markup).
 *
 * Auth: Authorization: Bearer xp_...
 * Docs: /docs/api
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, apiError } from "@/lib/api-auth";
import { streamText, generateText, type ModelMessage } from "ai";
import { getModel } from "@/lib/ai-gateway";
import { resolveTextModel } from "@/lib/ai-models";
import { deductCredits, getCreditBalance } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";

export const maxDuration = 300; // 5 minutes for long generations

// ── OpenAI request/response types (subset we support) ────────────────────────

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string }>;
  name?: string;
  tool_call_id?: string;
}

interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
  n?: number;
  user?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toPlainText(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((p) => (typeof p === "string" ? p : p.text ?? ""))
    .filter(Boolean)
    .join("\n");
}

function normalizeMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.map((m) => ({
    role: m.role as ModelMessage["role"],
    content: toPlainText(m.content),
  })) as ModelMessage[];
}

function makeId(): string {
  return `chatcmpl-${Math.random().toString(36).slice(2, 12)}`;
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth(request.headers.get("authorization"));
  if (auth instanceof NextResponse) return auth;

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return apiError("Invalid JSON body", 400, "INVALID_BODY");
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return apiError("messages is required", 400, "INVALID_PARAMS");
  }

  // Pre-flight credit check
  const balanceCents = await getCreditBalance(auth.userId);
  if (balanceCents <= 0) {
    return apiError("Insufficient credits", 402, "INSUFFICIENT_CREDITS");
  }

  const model = resolveTextModel(body.model);
  const messages = normalizeMessages(body.messages);
  const created = Math.floor(Date.now() / 1000);
  const id = makeId();

  // Strip a leading system message if present (AI SDK accepts it inside messages too)
  const systemMessage = messages.find((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  const callOptions = {
    model: getModel(model.id),
    system: typeof systemMessage?.content === "string" ? systemMessage.content : undefined,
    messages: nonSystemMessages,
    temperature: body.temperature ?? 0.7,
    maxOutputTokens: body.max_tokens ?? 2048,
    topP: body.top_p,
    stopSequences:
      typeof body.stop === "string"
        ? [body.stop]
        : Array.isArray(body.stop)
          ? body.stop
          : undefined,
  };

  // ── Streaming response ────────────────────────────────────────────────────
  if (body.stream) {
    try {
      const result = streamText(callOptions);

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // First chunk: role
          const firstChunk = {
            id,
            object: "chat.completion.chunk",
            created,
            model: model.id,
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "" },
                finish_reason: null,
              },
            ],
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(firstChunk)}\n\n`),
          );

          let promptTokens = 0;
          let completionTokens = 0;
          let finishReason: string | null = null;

          try {
            for await (const chunk of result.textStream) {
              const delta = {
                id,
                object: "chat.completion.chunk",
                created,
                model: model.id,
                choices: [
                  {
                    index: 0,
                    delta: { content: chunk },
                    finish_reason: null,
                  },
                ],
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(delta)}\n\n`),
              );
            }

            // Capture final usage
            const usage = await result.usage;
            const reason = await result.finishReason;
            promptTokens = usage?.inputTokens ?? 0;
            completionTokens = usage?.outputTokens ?? 0;
            finishReason = reason === "stop" ? "stop" : reason || "stop";

            // Final chunk with finish reason + usage
            const finalChunk = {
              id,
              object: "chat.completion.chunk",
              created,
              model: model.id,
              choices: [
                { index: 0, delta: {}, finish_reason: finishReason },
              ],
              usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (err) {
            const errorChunk = {
              error: {
                message: err instanceof Error ? err.message : "Stream error",
                code: "STREAM_ERROR",
              },
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`),
            );
          } finally {
            controller.close();

            // Post-stream: deduct credits + track usage (fire-and-forget)
            const finalUsage = {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            };
            if (finalUsage.totalTokens > 0) {
              void deductCredits({
                userId: auth.userId,
                usage: finalUsage,
                model: model.id,
                source: "api_v1_chat_completions",
              }).catch((e) =>
                console.error("Failed to deduct chat credits:", e),
              );
              void trackTokenUsage({
                userId: auth.userId,
                source: "api_v1_chat_completions",
                usage: finalUsage,
                model: model.id,
                metadata: { apiKeyId: auth.apiKeyId, streamed: true },
              }).catch((e) =>
                console.error("Failed to track chat usage:", e),
              );
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    } catch (error) {
      console.error("API v1 chat completions (stream) error:", error);
      return apiError(
        error instanceof Error ? error.message : "Streaming failed",
        500,
        "GENERATION_FAILED",
      );
    }
  }

  // ── Non-streaming response ────────────────────────────────────────────────
  try {
    const result = await generateText(callOptions);

    const usage = {
      promptTokens: result.usage.inputTokens ?? 0,
      completionTokens: result.usage.outputTokens ?? 0,
      totalTokens:
        (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
    };

    // Deduct + track
    try {
      await deductCredits({
        userId: auth.userId,
        usage,
        model: model.id,
        source: "api_v1_chat_completions",
      });
    } catch (err) {
      console.error("Failed to deduct chat credits:", err);
    }
    try {
      await trackTokenUsage({
        userId: auth.userId,
        source: "api_v1_chat_completions",
        usage,
        model: model.id,
        metadata: { apiKeyId: auth.apiKeyId, streamed: false },
      });
    } catch (err) {
      console.error("Failed to track chat usage:", err);
    }

    const finishReason =
      result.finishReason === "stop" ? "stop" : result.finishReason || "stop";

    return NextResponse.json({
      id,
      object: "chat.completion",
      created,
      model: model.id,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: result.text,
          },
          finish_reason: finishReason,
        },
      ],
      usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    });
  } catch (error) {
    console.error("API v1 chat completions error:", error);
    return apiError(
      error instanceof Error ? error.message : "Generation failed",
      500,
      "GENERATION_FAILED",
    );
  }
}
