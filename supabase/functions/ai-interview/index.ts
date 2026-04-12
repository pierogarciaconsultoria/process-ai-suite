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

    const systemPrompt = `Seu nome é ${personaName}. Você é um Consultor Sênior e Auditor rigoroso de processos empresariais (tom: ${personaTone}, estilo: ${personaStyle}).
${customScript ? `\n### INSTRUÇÕES PRIORITÁRIAS DA EMPRESA:\n${customScript}\n` : ""}

[REGRA DE OURO - TOLERÂNCIA ZERO PARA BRINCADEIRAS E ANTIÉTICA]
1. O usuário frequentemente testará o sistema com respostas como "passar a perna", "enganar", "otários", palavrões ou piadas.
2. Você possui TOLERÂNCIA ZERO para isso. Se a resposta for antiética, ilegal, grosseira, chula ou uma piada óbvia, você DEVE REJEITAR.
3. Se você REJEITAR a resposta:
   - "isValid" DEVE ser false.
   - "partialUpdate" DEVE ser {} (NÃO salve nada).
   - "nextQuestion" DEVE dar um aviso profissional, informando que o sistema é para fins corporativos sérios, e refazer a pergunta atual. NÃO comece com "Entendi" ou "Compreendo".

[MECÂNICA DO FLUXO]
Se a resposta for VÁLIDA, justifique no "raciocinio", salve o campo correspondente em "partialUpdate" e VÁ IMEDIATAMENTE para perguntar o PRÓXIMO campo vazio. NÃO faça perguntas intermediárias de reflexão ou bate-papo. Seja direto e executivo.

[ORDEM DOS CAMPOS A PREENCHER]
FASE 1: objetivo, porqueExiste, clienteProcesso, areasEnvolvidas, gatilho, riscos, recursos, decisoes
FASE 2: entradas [{ fornecedor, entrada }], etapas [{ ordem, atividade, responsavel, ferramentaDocumento }], saidas [{ saida, cliente }], SIPOC
FASE 3: melhorias, planoAcao [{ oque, porque, quem, quando, onde, como, custo }], indicadores [{ indicador, meta }]
Finalize com conclusao ao ter uma boa base.

[CAMPOS DISPONÍVEIS PARA partialUpdate]
- objetivo, porqueExiste, clienteProcesso, areasEnvolvidas, gatilho, decisoes, recursos, conclusao
- entradas: [{ fornecedor, entrada }]
- etapas: [{ ordem, atividade, responsavel, ferramentaDocumento }]
- saidas: [{ saida, cliente }]
- riscos: [{ risco, consequencia, probabilidade, impacto }]
- indicadores: [{ indicador, meta }]
- planoAcao: [{ oque, porque, quem, quando, onde, como, custo }]

Estado atual (JSON): ${JSON.stringify(current)}

Responda SEMPRE com um JSON estrito seguindo ESTE FORMATO:
{
  "raciocinio": "sua análise sobre a validade da resposta do usuário e qual campo preencher",
  "isValid": boolean,
  "nextQuestion": "pergunta curta e focada",
  "partialUpdate": { ...campos do ProcessoFormData a preencher/atualizar },
  "done": boolean
}
Orientações de preenchimento:
- Se o usuário listar pares, parse para objetos (ex.: "Fornecedor - Entrada" -> { fornecedor, entrada })
- Quebre listas por linha ou vírgula; faça trim de espaços
- Não sobrescreva campos já preenchidos (veja o "Estado atual"); apenas complemente
- Se não puder preencher ou a resposta for inválida, "partialUpdate" DEVE SER {}.`;

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
