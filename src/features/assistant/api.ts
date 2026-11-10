import { httpClient } from "@/core/http/httpClient";
import { MODEL_TIMEOUT_MS } from "@/core/http/timeouts";
import type { EngineQuery, Period } from "@/features/reports/engine/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A report Jarvis ran to answer; the first rows, and the query to open it whole. */
export interface AssistantReport {
  title: string;
  sql: string;
  query: EngineQuery;
  period: Period;
  rangeLabel: string;
  dataset: string;
  rowCount: number;
  columns: { key: string; label: string; type: string }[];
  rows: Record<string, unknown>[];
  totals: Record<string, number>;
}

export const assistantService = {
  chat(messages: ChatMessage[]): Promise<{ success: boolean; reply: string; toolsUsed: string[]; reports?: AssistantReport[] }> {
    return httpClient.post("/assistant/chat", { messages }, { timeoutMs: MODEL_TIMEOUT_MS });
  },
};
