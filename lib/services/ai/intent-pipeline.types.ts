import type { ReplyIntent } from "@/lib/logic/reply-intent-classify";
import type { EscalationDepartment } from "@/lib/logic/reply-intent-classify";

export type IntentLlmProvider = "openrouter" | "ollama";

export type IntentPipelineProvider = "heuristic" | IntentLlmProvider;

export type IntentClassificationResult = {
  intent: ReplyIntent;
  confidence: number;
  departmentHint?: EscalationDepartment;
  reason: string;
  provider: IntentPipelineProvider;
  raw?: string;
};
