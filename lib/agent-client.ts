const AGENT_URL = process.env.AGENT_SERVICE_URL;
const AGENT_SECRET = process.env.AGENT_API_SECRET;

interface GenerateResult {
  success: boolean;
  content?: string;
  suggestions?: string[];
  media_asset_id?: string;
  pipeline_log?: Record<string, string>;
  error?: string;
}

interface BatchGenerateResult {
  success: boolean;
  posts_created?: number;
  post_ids?: string[];
  error?: string;
}

export async function generateWithAgents(params: {
  userId: string;
  prompt?: string;
  language?: string;
  multiple?: boolean;
}): Promise<GenerateResult> {
  if (!AGENT_URL) {
    return { success: false, error: "Agent service not configured" };
  }

  const res = await fetch(`${AGENT_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AGENT_SECRET || ""}`,
    },
    body: JSON.stringify({
      user_id: params.userId,
      prompt: params.prompt,
      language: params.language,
      multiple: params.multiple ?? false,
    }),
  });

  return res.json();
}

export async function batchGenerateWithAgents(params: {
  userId: string;
  count?: number;
  scheduleTimes?: string[];
}): Promise<BatchGenerateResult> {
  if (!AGENT_URL) {
    return { success: false, error: "Agent service not configured" };
  }

  const res = await fetch(`${AGENT_URL}/batch-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AGENT_SECRET || ""}`,
    },
    body: JSON.stringify({
      user_id: params.userId,
      count: params.count ?? 3,
      schedule_times: params.scheduleTimes ?? [],
    }),
  });

  return res.json();
}

export function isAgentServiceConfigured(): boolean {
  return !!AGENT_URL;
}
