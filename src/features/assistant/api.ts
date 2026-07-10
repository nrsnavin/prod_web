import { httpClient } from "@/core/http/httpClient";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const assistantService = {
  chat(messages: ChatMessage[]): Promise<{ success: boolean; reply: string; toolsUsed: string[] }> {
    return httpClient.post("/assistant/chat", { messages });
  },
};
