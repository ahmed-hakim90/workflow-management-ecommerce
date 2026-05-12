import { getServerEnv } from "@/lib/config/env";
import {
  classifyReplyHeuristic,
  type ReplyIntent,
} from "@/lib/logic/reply-intent-classify";
import type { EscalationDepartment } from "@/lib/logic/reply-intent-classify";
import { getTenantAutomation } from "@/lib/services/tenant-settings.service";
import type {
  IntentClassificationResult,
  IntentLlmProvider,
  IntentPipelineProvider,
} from "@/lib/services/ai/intent-pipeline.types";
const VALID_INTENTS: ReplyIntent[] = [
  "confirm",
  "cancel",
  "address_change",
  "ask_shipping",
  "complaint",
  "greeting",
  "return_request",
  "exchange_request",
  "unknown",
];

function coerceIntent(raw: string | undefined): ReplyIntent {
  const t = (raw ?? "unknown").trim().toLowerCase().replace(/[- ]/g, "_");
  const map: Record<string, ReplyIntent> = {
    change_address: "address_change",
    address_change: "address_change",
    inquiry: "ask_shipping",
    unclear: "unknown",
  };
  const mapped = map[t] ?? (t as ReplyIntent);
  return VALID_INTENTS.includes(mapped) ? mapped : "unknown";
}

function parseLlmJson(text: string): {
  intent?: string;
  confidence?: number;
  reason?: string;
} {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(text.slice(start, end + 1)) as {
      intent?: string;
      confidence?: number;
      reason?: string;
    };
  } catch {
    return {};
  }
}

function departmentFromIntent(
  intent: ReplyIntent,
  fallback?: EscalationDepartment,
): EscalationDepartment | undefined {
  if (intent === "address_change") return "confirmation";
  if (intent === "complaint") return "support";
  if (intent === "return_request" || intent === "exchange_request")
    return "returns";
  if (intent === "ask_shipping") return "shipping";
  return fallback;
}

async function classifyWithOpenRouter(body: string): Promise<{
  intent: ReplyIntent;
  confidence: number;
  reason: string;
  raw: string;
}> {
  const env = getServerEnv();
  const key = env.OPENROUTER_API_KEY?.trim();
  const model = env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
  if (!key) {
    return {
      intent: "unknown",
      confidence: 0.4,
      reason: "openrouter_not_configured",
      raw: "",
    };
  }
  const system = `You classify WhatsApp customer messages for e-commerce ops. Reply with a single JSON object only: {"intent":"...","confidence":0-1,"reason":"short"}. Intents: confirm, cancel, address_change, ask_shipping, complaint, greeting, return_request, exchange_request, unknown.`;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: body.slice(0, 2000) },
      ],
      temperature: 0.1,
      max_tokens: 120,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    return {
      intent: "unknown",
      confidence: 0.45,
      reason: `openrouter_http_${res.status}`,
      raw: raw.slice(0, 500),
    };
  }
  let content = "";
  try {
    const j = JSON.parse(raw) as {
      choices?: { message?: { content?: string } }[];
    };
    content = j.choices?.[0]?.message?.content ?? "";
  } catch {
    return {
      intent: "unknown",
      confidence: 0.4,
      reason: "openrouter_bad_json",
      raw: raw.slice(0, 300),
    };
  }
  const p = parseLlmJson(content);
  return {
    intent: coerceIntent(p.intent),
    confidence:
      typeof p.confidence === "number" &&
      p.confidence >= 0 &&
      p.confidence <= 1
        ? p.confidence
        : 0.7,
    reason: (p.reason ?? "llm").slice(0, 300),
    raw: content.slice(0, 500),
  };
}

async function classifyWithOllama(body: string): Promise<{
  intent: ReplyIntent;
  confidence: number;
  reason: string;
  raw: string;
}> {
  const env = getServerEnv();
  const base = env.OLLAMA_BASE_URL?.trim();
  const model = env.OLLAMA_MODEL?.trim() || "llama3.2";
  if (!base) {
    return {
      intent: "unknown",
      confidence: 0.4,
      reason: "ollama_not_configured",
      raw: "",
    };
  }
  const system = `Classify the user message. Respond with JSON only: {"intent":"...","confidence":0-1,"reason":"..."}. Intents: confirm, cancel, address_change, ask_shipping, complaint, greeting, return_request, exchange_request, unknown.`;
  const res = await fetch(`${base.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: body.slice(0, 2000) },
      ],
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    return {
      intent: "unknown",
      confidence: 0.45,
      reason: `ollama_http_${res.status}`,
      raw: raw.slice(0, 400),
    };
  }
  let content = "";
  try {
    const j = JSON.parse(raw) as { message?: { content?: string } };
    content = j.message?.content ?? "";
  } catch {
    return {
      intent: "unknown",
      confidence: 0.4,
      reason: "ollama_bad_json",
      raw: raw.slice(0, 300),
    };
  }
  const p = parseLlmJson(content);
  return {
    intent: coerceIntent(p.intent),
    confidence:
      typeof p.confidence === "number" &&
      p.confidence >= 0 &&
      p.confidence <= 1
        ? p.confidence
        : 0.7,
    reason: (p.reason ?? "llm").slice(0, 300),
    raw: content.slice(0, 500),
  };
}

/** استدعاء مباشر لـ n8n أو اختبارات — نفس نماذج البيئة العامة. */
export async function classifyIntentWithProvider(input: {
  text: string;
  provider: IntentLlmProvider;
}): Promise<{
  intent: ReplyIntent;
  confidence: number;
  reason: string;
  raw: string;
} | null> {
  const r =
    input.provider === "ollama"
      ? await classifyWithOllama(input.text)
      : await classifyWithOpenRouter(input.text);
  if (r.reason.endsWith("_not_configured")) return null;
  return r;
}

function heuristicResult(
  h: ReturnType<typeof classifyReplyHeuristic>,
): IntentClassificationResult {
  return {
    intent: h.intent,
    confidence: h.confidence,
    departmentHint: h.departmentHint,
    reason: "heuristic",
    provider: "heuristic",
  };
}

function llmToResult(
  llm: { intent: ReplyIntent; confidence: number; reason: string; raw: string },
  provider: IntentPipelineProvider,
  h: ReturnType<typeof classifyReplyHeuristic>,
): IntentClassificationResult {
  return {
    intent: llm.intent,
    confidence: Math.max(llm.confidence, h.confidence * 0.85),
    departmentHint: departmentFromIntent(llm.intent, h.departmentHint),
    reason: llm.reason,
    provider,
    raw: llm.raw,
  };
}

/**
 * مسار التصنيف — يقرأ `replyIntentClassifierProvider` من إعدادات المستأجر.
 */
export async function classifyCustomerReplyIntent(input: {
  tenantId: string;
  body: string;
}): Promise<IntentClassificationResult> {
  const settings = await getTenantAutomation(input.tenantId);
  const h = classifyReplyHeuristic(input.body);
  const mode = settings.replyIntentClassifierProvider ?? "heuristic";
  const th = settings.replyIntentClassifierLlmThreshold ?? 0.72;

  if (mode === "heuristic") {
    return heuristicResult(h);
  }

  if (mode === "openrouter") {
    const llm = await classifyWithOpenRouter(input.body);
    return llmToResult(llm, "openrouter", h);
  }

  if (mode === "ollama") {
    const llm = await classifyWithOllama(input.body);
    return llmToResult(llm, "ollama", h);
  }

  if (h.confidence >= th) {
    return heuristicResult(h);
  }

  let used: IntentPipelineProvider = "openrouter";
  let llm = await classifyWithOpenRouter(input.body);
  if (
    llm.reason === "openrouter_not_configured" ||
    llm.reason.startsWith("openrouter_http_")
  ) {
    llm = await classifyWithOllama(input.body);
    used = "ollama";
  }
  return llmToResult(llm, used, h);
}
