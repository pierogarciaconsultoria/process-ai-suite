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
    const { processoData, customScript, aiSkin } = await req.json();
    if (!processoData) {
      return new Response(
        JSON.stringify({ error: "Dados do processo são obrigatórios para gerar o resumo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Nenhuma chave de IA configurada (OPENAI_API_KEY). Configure as variáveis de ambiente para gerar o resumo.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const personaName = aiSkin?.nome || "Peter";
    const personaTone = aiSkin?.tom || "descontraído e ágil";
    const personaStyle = aiSkin?.estilo || "entusiasmado";

    const systemPrompt = `Seu nome é ${personaName}. Você é um consultor de processos experiente, com linguagem leve e clara (tom: ${personaTone}, estilo: ${personaStyle}).
${customScript ? `\n### DIRETRIZES DA EMPRESA:\n${customScript}\n` : ""}

Gere um TEXTO CORRIDO em português do Brasil descrevendo o processo a partir dos dados estruturados recebidos.

Objetivo do texto:
- Ser lido por gestores e analistas que não estão vendo o formulário técnico.
- Explicar o processo de ponta a ponta, em linguagem simples, mas profissional.

Instruções:
- Comece com um parágrafo de CONTEXTO (onde o processo se encaixa na operação).
- Em seguida descreva o FLUXO principal em ordem lógica: gatilho, principais etapas, decisões, saídas.
- Destaque, em frases naturais, principais riscos, dores e pontos de atenção.
- Evite bullets e títulos; escreva como um texto corrido de 3 a 6 parágrafos curtos.
- Não use markdown, não use listas. Apenas texto puro.
`;

    const userContent = `Dados estruturados do processo em JSON:\n${JSON.stringify(
      processoData,
      null,
      2,
    )}`;

    const response = await fetch(
      isOpenAI && OPENAI_API_KEY
        ? "https://api.openai.com/v1/chat/completions"
        : "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization:
            isOpenAI && OPENAI_API_KEY
              ? `Bearer ${OPENAI_API_KEY}`
              : `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: isOpenAI ? AI_MODEL.replace(/^openai\//, "") : AI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await response.text();
      return new Response(
        JSON.stringify({ error: `AI error ${response.status}: ${txt}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await response.json();
    let content = json.choices?.[0]?.message?.content || "";
    content = content.replace(/```[a-zA-Z]*\s*/g, "").replace(/```\s*/g, "").trim();

    return new Response(
      JSON.stringify({ resumo: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
