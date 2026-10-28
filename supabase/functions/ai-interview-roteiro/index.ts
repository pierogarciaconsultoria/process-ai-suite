import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, authorizeCompany, authorizeProcess, errorResponse, HttpError, requireString } from "../_shared/auth.ts";
import { acquireAiQuota } from "../_shared/quota.ts";
import { callResponsesAPI } from "../_shared/openai-assistant.ts";
import { checkModeration } from "../_shared/moderation.ts";
import { carregarPersonaPeter } from "../_shared/peter-persona.ts";
import { ROTEIRO_PADRAO } from "../_shared/roteiro-entrevista.ts";
import { iniciarRoteiro, proximoPasso } from "../_shared/roteiro-engine.ts";
import {
  aplicarAvaliacao,
  aplicarConfirmacao,
  aplicarAnalise,
  aplicarExtracao,
  iniciarTurno,
  perguntasEmAberto,
  promptAnalise,
  promptAvaliacao,
  promptConfirmacao,
  promptExtracao,
  sanitizarEstado,
  sanitizarHistorico,
  schemaAnalise,
  schemaAvaliacao,
  schemaConfirmacao,
  schemaExtracao,
  validarArquivo,
  type ResultadoTurno,
} from "../_shared/roteiro-peter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_RESPOSTA = 8_000;
const MAX_CURRENT = 100_000;

function jsonResponse(body: ResultadoTurno): Response {
  return new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function lerCurrent(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  if (JSON.stringify(raw).length > MAX_CURRENT) throw new HttpError(400, "Dados atuais do processo excedem o tamanho máximo.");
  return raw as Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, user } = await authenticateRequest(req);
    const body = await req.json();
    const operacao = body?.operacao;
    const companyId = requireString(body?.company_id, "company_id");
    const processId = typeof body?.process_id === "string" && body.process_id.trim() ? body.process_id.trim() : null;
    await authorizeCompany(client, user.id, companyId);
    if (processId) await authorizeProcess(client, processId, companyId);

    const roteiro = ROTEIRO_PADRAO;

    if (operacao === "iniciar") {
      return jsonResponse(iniciarTurno(roteiro, iniciarRoteiro(roteiro)));
    }

    if (operacao !== "responder" && operacao !== "extrair" && operacao !== "analisar") {
      throw new HttpError(400, "Operação inválida.");
    }

    const estado = sanitizarEstado(roteiro, body?.estado);

    const resposta = typeof body?.resposta === "string" ? body.resposta.trim() : "";
    if (operacao === "responder" && !resposta) throw new HttpError(400, "Resposta vazia.");
    if (resposta.length > MAX_RESPOSTA) throw new HttpError(400, "Resposta excede 8.000 caracteres.");
    if (checkModeration(resposta).blocked) throw new HttpError(422, "Conteúdo inapropriado. Use linguagem profissional.");

    const origem = body?.origem === "anexo" ? "anexo" : "texto_livre";
    const partes = operacao === "extrair"
      ? validarArquivo(body?.arquivo_content ?? (resposta ? [{ type: "text", text: resposta }] : []))
      : [];
    // Texto colado passa pela mesma moderação das respostas; documentos anexados não.
    if (origem === "texto_livre" && partes.some((parte) => parte.type === "input_text" && checkModeration(parte.text).blocked)) {
      throw new HttpError(422, "Conteúdo inapropriado. Use linguagem profissional.");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurado");

    const persona = await carregarPersonaPeter(client, companyId);
    const current = lerCurrent(body?.current);
    const historico = sanitizarHistorico(body?.history);

    const quotaLease = await acquireAiQuota(client, "ai-interview-roteiro", companyId);
    let consumo = JSON.stringify(historico).length + resposta.length;
    try {
      if (operacao === "analisar") {
        const raw = await callResponsesAPI({
          systemPrompt: promptAnalise(persona, roteiro, estado),
          messages: [{ role: "user", content: "Gere a análise com base nas informações coletadas." }],
          responseSchema: schemaAnalise(roteiro, estado),
          openaiApiKey: OPENAI_API_KEY,
        });
        return jsonResponse(aplicarAnalise(roteiro, estado, raw));
      }

      if (operacao === "extrair") {
        consumo += JSON.stringify(partes).length;
        const raw = await callResponsesAPI({
          systemPrompt: promptExtracao(persona, roteiro, estado, current),
          messages: [{ role: "user", content: partes }],
          responseSchema: schemaExtracao(roteiro, estado),
          openaiApiKey: OPENAI_API_KEY,
        });
        return jsonResponse(aplicarExtracao(roteiro, estado, raw, origem));
      }

      const passo = proximoPasso(roteiro, estado);
      const mensagens = [...historico, { role: "user" as const, content: resposta }];

      if (passo.tipo === "pergunta") {
        const raw = await callResponsesAPI({
          systemPrompt: promptAvaliacao(persona, roteiro, estado, current),
          messages: mensagens,
          responseSchema: schemaAvaliacao(passo.pergunta, perguntasEmAberto(roteiro, estado, passo.pergunta.id)),
          openaiApiKey: OPENAI_API_KEY,
        });
        return jsonResponse(aplicarAvaliacao(roteiro, estado, raw));
      }

      if (passo.tipo === "confirmar_etapa") {
        const raw = await callResponsesAPI({
          systemPrompt: promptConfirmacao(persona, roteiro, estado, current),
          messages: mensagens,
          responseSchema: schemaConfirmacao(passo.etapa),
          openaiApiKey: OPENAI_API_KEY,
        });
        return jsonResponse(aplicarConfirmacao(roteiro, estado, raw, resposta));
      }

      throw new HttpError(409, "A entrevista não está aguardando uma resposta neste momento.");
    } finally {
      await quotaLease.complete(consumo, Math.max(1, Math.ceil(consumo / 200)));
    }
  } catch (e) {
    return errorResponse(e, corsHeaders);
  }
});
