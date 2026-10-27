import { createServer } from "node:http";

const port = Number(process.env.MOCK_AI_PORT ?? 54329);
const delayMs = Number(process.env.MOCK_AI_DELAY_MS ?? 0);
let calls = [];

// Instância mínima e válida de um JSON Schema no modo strict: cada função recebe
// uma resposta que passa na validação, mesmo quando o schema muda.
function instanciaDoSchema(schema) {
  if (!schema || typeof schema !== "object") return null;
  if (Array.isArray(schema.anyOf)) return instanciaDoSchema(schema.anyOf.find((opcao) => opcao.type !== "null") ?? schema.anyOf[0]);
  if (Array.isArray(schema.enum)) return schema.enum[0];
  const tipo = Array.isArray(schema.type) ? schema.type.find((item) => item !== "null") ?? "null" : schema.type;
  if (tipo === "object") {
    return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([chave, filho]) => [chave, instanciaDoSchema(filho)]));
  }
  if (tipo === "array") return [];
  if (tipo === "string") return "Resposta integrada";
  if (tipo === "boolean") return true;
  if (tipo === "integer" || tipo === "number") return 1;
  return null;
}

function respostaResponses(body) {
  const schema = body.text?.format?.schema;
  if (schema) return JSON.stringify(instanciaDoSchema(schema));
  const pedido = `${body.instructions ?? ""} ${JSON.stringify(body.input ?? "")}`;
  if (pedido.includes("BPMN")) return '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" />';
  if (pedido.includes("content_markdown")) return JSON.stringify({ title: "Documento", content_markdown: "# Documento", content_text: "Documento" });
  return "{}";
}

const json = (response, status, body) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

createServer(async (request, response) => {
  if (request.url === "/metrics") return json(response, 200, { count: calls.length, calls });
  if (request.url === "/reset" && request.method === "POST") {
    calls = [];
    return json(response, 200, { count: 0 });
  }

  let rawBody = "";
  for await (const chunk of request) rawBody += chunk;
  const body = rawBody ? JSON.parse(rawBody) : {};
  calls.push({ method: request.method, url: request.url });
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (request.url === "/v1/threads" && request.method === "POST") return json(response, 200, { id: "thread-test" });
  if (request.url === "/v1/threads/thread-test/messages" && request.method === "POST") return json(response, 200, { id: "message-test" });
  if (request.url === "/v1/threads/thread-test/runs" && request.method === "POST") return json(response, 200, { id: "run-test" });
  if (request.url === "/v1/threads/thread-test/runs/run-test" && request.method === "GET") return json(response, 200, { status: "completed" });
  if (request.url?.startsWith("/v1/threads/thread-test/messages?") && request.method === "GET") {
    return json(response, 200, {
      data: [{ role: "assistant", content: [{ type: "text", text: { value: JSON.stringify({ nextQuestion: "Pergunta integrada", partialUpdate: {} }) } }] }],
    });
  }

  if (request.url === "/v1/responses" && request.method === "POST") {
    return json(response, 200, { output: [{ type: "message", content: [{ type: "output_text", text: respostaResponses(body) }] }] });
  }

  if (request.url !== "/v1/chat/completions") return json(response, 404, { error: "mock route not found" });

  if (Array.isArray(body.tools)) {
    return json(response, 200, {
      choices: [{ message: { tool_calls: [{ function: { arguments: "{}" } }] } }],
    });
  }

  const prompt = JSON.stringify(body.messages ?? []);
  let content = "Resposta integrada";
  if (prompt.includes("BPMN 2.0")) content = '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" />';
  else if (prompt.includes("roteiroSugerido")) content = JSON.stringify({ comentarios: "ok", roteiroSugerido: "roteiro", skinSugerida: "skin" });
  else if (prompt.includes("content_markdown")) content = JSON.stringify({ title: "Documento", content_markdown: "# Documento", content_text: "Documento" });
  else if (request.headers.authorization === "Bearer mock-lovable-key") content = "{}";

  return json(response, 200, { choices: [{ message: { content } }] });
}).listen(port, "0.0.0.0", () => {
  process.stdout.write(`mock-ai-ready:${port}\n`);
});
