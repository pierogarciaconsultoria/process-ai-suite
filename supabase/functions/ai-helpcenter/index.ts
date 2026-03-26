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
    const page = body?.page ?? "/";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é o assistente de autoatendimento da plataforma Process Suite IA.
Responda sempre em Português do Brasil, de forma objetiva e prática.
Contexto: o usuário está na página "${page}".
Ajude com dúvidas de uso dos módulos: Login, Empresas, Usuários, Processos (Entrevista com IA, Formulário, Diagnóstico, AS IS/TO BE, BPMN), Arquitetura, Dashboard, Relatórios e Configurações.
Políticas:
- Não exponha segredos, chaves ou dados sensíveis.
- Se for um passo de configuração, descreva em passos curtos.
- Se a dúvida não for sobre a plataforma, peça para reformular.
- Ofereça próximos passos e ações relacionadas quando fizer sentido.
Formato: responda em texto simples, com listas curtas quando necessário.`;

    const messages = [{ role: "system", content: systemPrompt }, ...history];

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
    const content = json.choices?.[0]?.message?.content || "Certo. Em que mais posso ajudar?";
    return new Response(JSON.stringify({ answer: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

