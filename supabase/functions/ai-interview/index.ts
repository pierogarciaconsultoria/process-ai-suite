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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um entrevistador especializado em mapeamento de processos (SIPOC, atividades, decisões, riscos, indicadores, plano de ação).
Conduza a entrevista fazendo UMA pergunta por vez, avançando progressivamente. Valide e estruture respostas no objeto ProcessoFormData.
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

Responda SEMPRE em JSON válido com:
{
  "nextQuestion": "string",
  "partialUpdate": { ...campos do ProcessoFormData a preencher/atualizar },
  "done": boolean
}
Se for impossível responder com preenchimentos, ainda assim retorne um JSON com "nextQuestion" informando explicitamente a próxima pergunta.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

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
