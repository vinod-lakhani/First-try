/**
 * Chat service for MVP Simulator – calls /api/chat
 */
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatRequest {
  messages: Message[];
  context?: string;
  userPlanData?: Record<string, unknown>;
}

export async function sendChatMessage(request: ChatRequest): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (response.status === 404) {
    throw new Error('Chat requires a server. Run the simulator with npm run dev.');
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || response.statusText);
  }
  const data = (await response.json()) as { response?: string };
  return data.response ?? 'I could not generate a response.';
}
