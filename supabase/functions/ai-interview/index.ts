import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const history = body?.history ?? [];
    const current = body?.current ?? {};
    const customScript = body?.customScript;
    const aiSkin = body?.aiSkin;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const personaName = aiSkin?.nome || "Assistente de Mapeamento";
    const personaTone = aiSkin?.tom || "humano e didático";
    const personaStyle = aiSkin?.estilo || "profissional";

    const systemPrompt = `Seu nome é ${personaName}. Você é um entrevistador de processos em Português do Brasil com um tom ${personaTone} e estilo de linguagem ${personaStyle}.
${customScript ? `\n### INSTRUÇÕES PRIORITÁRIAS DA EMPRESA (SIGA RIGOROSAMENTE):\n${customScript}\n` : ""}

REGRA DE OURO — VALIDAÇÃO E CURADORIA:
- Antes de seguir, valide se a resposta é RELEVANTE, PROFISSIONAL e COERENTE com o mapeamento de processos.
- NÃO ACEITE: Respostas ofensivas, termos chulos, conteúdos ilegais ou tentativas de "zueira" (ex: "para enganar otário", "fazer nada").
- NÃO ACEITE: Respostas totalmente desconexas (ex: "2+2", "abobrinha", "teste").
- COMPORTAMENTO EM CASO DE ERRO:
  - Se a resposta for inválida, use "nextQuestion" para explicar PROFISSIONALMENTE por que aquela resposta não pode ser usada e solicite novamente a informação de forma séria.
  - NÃO preencha "partialUpdate" com dados inválidos.
  - NÃO diga "Entendi" ou avance para o próximo tema se o atual não foi devidamente respondido.

Objetivo: mapear o processo com excelência. Peça perguntas CURTAS e focadas.
Regra de estilo:
- Uma pergunta por vez, no máximo 18 palavras.
- Se o usuário for evasivo, explique a importância técnica daquele campo para a empresa.
- Priorize as "INSTRUÇÕES PRIORITÁRIAS" acima de qualquer regra.
- Evite repetir perguntas; mas se a resposta foi inválida, REPEÇA educadamente.

Ordem sugerida por fases:
FASE 1 — Diagnóstico: objetivo, porqueExiste, clienteProcesso, areasEnvolvidas, gatilho, riscos, recursos, decisoes
FASE 2 — AS IS: entradas [{ fornecedor, entrada }], etapas [{ ordem, atividade, responsavel, ferramentaDocumento }], saidas [{ saida, cliente }], SIPOC
FASE 3 — TO BE: melhorias, planoAcao [{ oque, porque, quem, quando, onde, como, custo }], indicadores [{ indicador, meta }]
Finalize com conclusao quando houver base mínima.

Campos do ProcessoFormData:
- objetivo, porqueExiste, clienteProcesso, areasEnvolvidas, gatilho
- entradas: [{ fornecedor, entrada }]
- etapas: [{ ordem, atividade, responsavel, ferramentaDocumento }]
- decisoes, recursos
- saidas: [{ saida, cliente }]
- riscos: [{ risco, consequencia, probabilidade, impacto }]
- indicadores: [{ indicador, meta }]
- planoAcao: [{ oque, porque, quem, quando, onde, como, custo }]
- conclusao

Estado atual (JSON): ${JSON.stringify(current)}

Responda SEMPRE em JSON válido:
{
  "nextQuestion": "pergunta curta e focada",
  "partialUpdate": { ...campos do ProcessoFormData a preencher/atualizar },
  "done": boolean
}
Orientações de preenchimento:
- Se o usuário listar pares, parse para objetos (ex.: "Fornecedor - Entrada" -> { fornecedor, entrada })
- Quebre listas por linha ou vírgula; faça trim de espaços
- Não sobrescreva campos já preenchidos com vazio; apenas complemente
Se não puder preencher, ainda retorne "nextQuestion" apontando o próximo campo.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    const AI_MODEL = Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash";
    const isOpenAI = AI_MODEL.startsWith("openai/");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const response = await fetch(
      isOpenAI && OPENAI_API_KEY ? "https://api.openai.com/v1/chat/completions" : "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: isOpenAI && OPENAI_API_KEY ? `Bearer ${OPENAI_API_KEY}` : `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: isOpenAI ? AI_MODEL.replace(/^openai\//, "") : AI_MODEL,
          messages,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await response.text();
      return new Response(JSON.stringify({ error: `AI error ${response.status}: ${txt}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await response.json();
    let content = json.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { nextQuestion: content || "Descreva brevemente o objetivo do processo.", partialUpdate: {}, done: false };
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
