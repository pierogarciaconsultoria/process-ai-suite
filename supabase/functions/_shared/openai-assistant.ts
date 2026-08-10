type AssistantMessage = {
  role?: string;
  content?: Array<{ type?: string; text?: { value?: string } }>;
};

export async function runConfiguredAssistant(
  apiKey: string,
  instructions: string,
  userContent: string,
): Promise<string> {
  const assistantId = Deno.env.get("OPENAI_ASSISTANT_ID");
  if (!assistantId) throw new Error("OPENAI_ASSISTANT_ID não configurado.");
  const baseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "OpenAI-Beta": "assistants=v2",
  };
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`OpenAI Assistant error ${response.status}: ${await response.text()}`);
    return await response.json() as T;
  };

  const thread = await request<{ id: string }>("/threads", { method: "POST", body: "{}" });
  await request(`/threads/${thread.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ role: "user", content: userContent }),
  });
  const run = await request<{ id: string }>(`/threads/${thread.id}/runs`, {
    method: "POST",
    body: JSON.stringify({ assistant_id: assistantId, additional_instructions: instructions }),
  });

  const startedAt = Date.now();
  let completed = false;
  while (Date.now() - startedAt < 60_000) {
    const status = await request<{ status: string; last_error?: { message?: string } }>(
      `/threads/${thread.id}/runs/${run.id}`,
      { method: "GET" },
    );
    if (status.status === "completed") {
      completed = true;
      break;
    }
    if (["failed", "cancelled", "expired", "incomplete", "requires_action"].includes(status.status)) {
      throw new Error(status.last_error?.message || `Assistant encerrado com status ${status.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  if (!completed) throw new Error("Tempo limite excedido ao aguardar o Assistant.");

  const messages = await request<{ data: AssistantMessage[] }>(`/threads/${thread.id}/messages?order=desc&limit=20`);
  const assistantMessage = messages.data.find((message) => message.role === "assistant");
  const content = assistantMessage?.content
    ?.filter((item) => item.type === "text")
    .map((item) => item.text?.value || "")
    .join("\n")
    .trim();
  if (!content) throw new Error("O Assistant não retornou conteúdo.");
  return content;
}

export function stripCodeFence(content: string): string {
  return content.replace(/^```(?:json|xml)?\s*/i, "").replace(/```\s*$/i, "").trim();
}
