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
Conduza a entrevista fazendo UMA pergunta por vez. Valide e estruture as respostas no objeto ProcessoFormData.
Quando fizer sentido, proponha preenchimentos com base nas respostas do usuário.

Sempre responda no formato JSON:
{
  "nextQuestion": "string | null",
  "partialUpdate": { ...campos de ProcessoFormData que podem ser preenchidos },
  "done": boolean
}

Regra: avance cobrindo objetivo, contexto, SIPOC (entradas/saídas/clientes), atividades e responsáveis, decisões, riscos, indicadores e plano de ação. Finalize quando houver dados mínimos.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      {
        role: "user",
        content: `Estado atual (JSON): ${JSON.stringify(current)}`,
      },
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
      }),
    });

    if (!response.ok) {
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
      parsed = { nextQuestion: "Descreva brevemente o objetivo do processo.", partialUpdate: {}, done: false };
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
