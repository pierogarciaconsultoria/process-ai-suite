export async function callResponsesAPI(params: {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string | Array<any> }>;
  responseSchema: object;
  openaiApiKey: string;
}): Promise<object> {
  const { systemPrompt, messages, responseSchema, openaiApiKey } = params;
  const baseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";

  const input: any[] = [];

  if (typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
    input.push({ role: "system", content: systemPrompt });
  }

  for (const msg of messages) {
    if (!msg) continue;
    if (msg.role !== "user" && msg.role !== "assistant") continue;

    if (typeof msg.content === "string") {
      if (!msg.content.trim()) continue;
      input.push({ role: msg.role, content: msg.content });
      continue;
    }

    if (Array.isArray(msg.content)) {
      if (msg.content.length === 0) continue;
      input.push({ role: msg.role, content: msg.content });
    }
  }

  const body = {
    model: "gpt-4o",
    input,
    text: {
      format: {
        type: "json_schema",
        name: "InterviewResponse",
        strict: true,
        schema: responseSchema,
      },
    },
  };

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status !== 200) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenAI Responses API error ${response.status}${text ? `: ${text}` : ""}`
    );
  }

  const data = await response.json();
  const rawText = extractOutputText(data);

  if (!rawText) {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch {
      throw new Error("OpenAI Responses API retornou resposta sem texto parseável.");
    }
  }

  const cleaned = stripCodeFence(rawText);
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Não foi possível parsear JSON da resposta: ${cleaned.slice(0, 500)}`);
  }
}

// Usado por diagnóstico, BPMN e documentos: resposta em texto livre via Responses API.
// Mantém a assinatura da antiga implementação sobre a Assistants API.
export async function runConfiguredAssistant(
  openaiApiKey: string,
  instructions: string,
  userContent: string,
): Promise<string> {
  const baseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-4o", instructions, input: userContent }),
  });

  if (response.status !== 200) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI Responses API error ${response.status}${text ? `: ${text}` : ""}`);
  }

  const content = extractOutputText(await response.json()).trim();
  if (!content) throw new Error("A OpenAI não retornou conteúdo.");
  return content;
}

function extractOutputText(data: any): string {
  let rawText = "";
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (item?.type === "message" && Array.isArray(item?.content)) {
        for (const part of item.content) {
          if (part?.type === "output_text" && typeof part?.text === "string") {
            rawText = part.text;
            break;
          }
        }
        if (rawText) break;
      }
    }
  }
  if (!rawText && typeof data?.output_text === "string") rawText = data.output_text;
  if (!rawText && typeof data?.content === "string") rawText = data.content;
  return rawText;
}

export function stripCodeFence(content: string): string {
  return content.replace(/^```(?:json|xml)?\s*/i, "").replace(/```\s*$/i, "").trim();
}
