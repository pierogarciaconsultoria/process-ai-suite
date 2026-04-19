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
    const roteiro: string = body?.roteiro || "";
    const skin = body?.skin || null;

    const AI_MODEL = Deno.env.get("AI_MODEL") || "google/gemini-2.5-flash";
    const isOpenAI = AI_MODEL.startsWith("openai/");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!OPENAI_API_KEY && !LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          comentarios:
            "A IA de revisão não está configurada (sem OPENAI_API_KEY ou LOVABLE_API_KEY). Ajuste as variáveis de ambiente para usar esta função.",
          roteiroSugerido: roteiro,
          skinSugerida: skin,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Você é especialista em design de prompts e personas para assistentes de IA em produtos SaaS de processos (BPM, mapeamento, diagnóstico).
Seu papel é analisar e sugerir melhorias no Roteiro IA (system prompt) e na Skin (nome, tom e estilo) de um assistente que conduz entrevistas de mapeamento de processos em português do Brasil.

Regras:
- Mantenha o português brasileiro, com tom leve, humano e profissional.
- Foque em clareza, engajamento e alinhamento com boas práticas de entrevistas de processos.
- Evite linguagem muito técnica ou robótica.
- Proteja dados sensíveis e não prometa coisas que o sistema não faz.

Responda SEMPRE em JSON com as chaves:
- "comentarios": string com feedback geral e pontos fortes/fracos.
- "roteiroSugerido": string com o texto sugerido para o Roteiro IA (pronto para colar na tela de configuração).
- "skinSugerida": objeto { "nome": string, "tom": string, "estilo": string } sugerido para a Skin.`;

    const userPayload = {
      roteiro,
      skin,
      contextoProduto:
        "Plataforma ProcessAI Suite para mapeamento de processos, diagnóstico e geração de BPMN com IA, usada por consultores e empresas B2B.",
    };

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
            { role: "user", content: JSON.stringify(userPayload) },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error:
              "Limite de requisições da IA de revisão excedido. Tente novamente em alguns segundos.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos de IA esgotados para revisão de configuração. Adicione créditos em Configurações.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const txt = await response.text();
      return new Response(
        JSON.stringify({
          error: `AI error ${response.status}: ${txt}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const json = await response.json();
    let content = json.choices?.[0]?.message?.content || "{}";
    content = content.trim();

    return new Response(content, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

