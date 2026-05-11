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

    const lastUser = Array.isArray(history) ? [...history].reverse().find((m: any) => m?.role === "user")?.content?.toLowerCase?.() ?? "" : "";
    const quickIntents = [
      {
        test: (t: string) => /mapa|bpmn/.test(t) && /analis|diagnost|relat/.test(t),
        answer:
          "Para analisar seu mapa com IA:\n\n1) Acesse Processos > Novo Processo.\n2) Na FASE 2, abra a aba “Mapa AS IS (BPMN)” e cole ou importe o XML do seu mapa.\n3) Opcional: na FASE 3, aba “Mapa TO BE (BPMN)”, adicione o cenário desejado.\n4) Vá para a FASE 4 > “Relatório”. A análise é gerada automaticamente e você será redirecionado para o Diagnóstico.\n\nDica: complete os campos do contexto e problemas para enriquecer o relatório.",
      },
      {
        test: (t: string) => /entrevista|ajuda inicial|como começar|onboarding/.test(t),
        answer:
          "Para começar rápido:\n\n1) Cadastre sua empresa em Configurações > Empresas (ou no primeiro acesso).\n2) Acesse Processos > Entrevista com IA para mapear rapidamente.\n3) Revise no formulário de processo e gere o Relatório em FASE 4.\n\nPosso detalhar qualquer etapa se preferir.",
      },
    ];
    const intentHit = quickIntents.find((i) => i.test(lastUser));
    const fallbackLocal = intentHit?.answer || null;

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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      const content = fallbackLocal || "Certo. Em que posso ajudar dentro da plataforma?";
      return new Response(JSON.stringify({ answer: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
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
      if (fallbackLocal) {
        return new Response(JSON.stringify({ answer: fallbackLocal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: `AI error ${response.status}: ${txt}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || "Certo. Em que mais posso ajudar?";
    return new Response(JSON.stringify({ answer: content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ answer: "Não consegui acessar o mecanismo de IA no momento. Você pode tentar:\n\n1) Verificar conexão e tentar novamente.\n2) Gerar o Relatório em Processos > Novo Processo > FASE 4.\n3) Abrir um chamado em Configurações > Chamados." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
