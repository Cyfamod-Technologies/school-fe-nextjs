import { apiFetch } from "@/lib/apiClient";
import { API_ROUTES } from "@/lib/config";

export type AiChatResponse = {
  reply: string;
  intent?: string | null;
  can_delete?: boolean;
  suggestions?: string[];
};

export type AiChatLog = {
  id: string;
  school_id: string;
  user_id: string;
  user_message: string;
  assistant_reply: string;
  intent?: string | null;
  created_at: string;
};

export type AiChatHistoryResponse = {
  data: AiChatLog[];
};

export async function sendAiChat(message: string): Promise<AiChatResponse> {
  return apiFetch<AiChatResponse>(API_ROUTES.aiChat, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function fetchAiChatHistory(
  scope: "school" | "user" = "school",
  limit = 100,
): Promise<AiChatHistoryResponse> {
  const query = new URLSearchParams({
    scope,
    limit: String(limit),
  });
  return apiFetch<AiChatHistoryResponse>(
    `${API_ROUTES.aiChatHistory}?${query.toString()}`,
  );
}
