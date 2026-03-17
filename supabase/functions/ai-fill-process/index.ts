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
    const { descricao } = await req.json();
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Descrição deve ter pelo menos 10 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um analista sênior de processos de negócio. 
Com base na descrição fornecida pelo usuário, preencha TODOS os campos do mapeamento de processo.
Seja objetivo, prático e específico. Use linguagem profissional em português brasileiro.
Limite etapas a 4-8 itens. Gere 2-4 riscos. Gere 2-4 indicadores. Gere 1-3 ações no plano de ação.
Para probabilidade e impacto de riscos, use valores entre 1 e 5.
Para criticidade (impactoNegocio, impactoCliente, riscoOperacional), use apenas os valores 1, 3 ou 5.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Descrição do processo:\n${descricao}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "fill_process_mapping",
              description: "Preenche todos os campos do formulário de mapeamento de processo",
              parameters: {
                type: "object",
                properties: {
                  objetivo: { type: "string", description: "Objetivo do processo" },
                  porqueExiste: { type: "string", description: "Justificativa da existência do processo" },
                  clienteProcesso: { type: "string", description: "Cliente que recebe o resultado" },
                  areasEnvolvidas: { type: "string", description: "Áreas envolvidas, separadas por vírgula" },
                  gatilho: { type: "string", description: "O que dispara o processo" },
                  entradas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        fornecedor: { type: "string" },
                        entrada: { type: "string" },
                      },
                      required: ["fornecedor", "entrada"],
                    },
                  },
                  etapas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ordem: { type: "number" },
                        atividade: { type: "string" },
                        responsavel: { type: "string" },
                        ferramentaDocumento: { type: "string" },
                      },
                      required: ["ordem", "atividade", "responsavel", "ferramentaDocumento"],
                    },
                  },
                  decisoes: { type: "string", description: "Decisões e aprovações do processo" },
                  saidas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        saida: { type: "string" },
                        cliente: { type: "string" },
                      },
                      required: ["saida", "cliente"],
                    },
                  },
                  recursos: { type: "string", description: "Recursos utilizados" },
                  frequencia: {
                    type: "string",
                    enum: ["Diária", "Semanal", "Quinzenal", "Mensal", "Trimestral", "Semestral", "Anual", "Sob demanda"],
                  },
                  tempoExecucao: { type: "string", description: "Tempo médio de execução" },
                  problemas: {
                    type: "object",
                    properties: {
                      retrabalho: { type: "boolean" },
                      atrasos: { type: "boolean" },
                      erros: { type: "boolean" },
                      dependencia: { type: "boolean" },
                      faltaPadrao: { type: "boolean" },
                    },
                    required: ["retrabalho", "atrasos", "erros", "dependencia", "faltaPadrao"],
                  },
                  problemasTexto: { type: "string", description: "Descrição detalhada dos problemas" },
                  gargalos: { type: "string", description: "Gargalos identificados" },
                  riscos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        risco: { type: "string" },
                        consequencia: { type: "string" },
                        probabilidade: { type: "number", enum: [1, 2, 3, 4, 5] },
                        impacto: { type: "number", enum: [1, 2, 3, 4, 5] },
                      },
                      required: ["risco", "consequencia", "probabilidade", "impacto"],
                    },
                  },
                  controles: { type: "string", description: "Controles existentes" },
                  indicadores: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        indicador: { type: "string" },
                        meta: { type: "string" },
                      },
                      required: ["indicador", "meta"],
                    },
                  },
                  sugestoes: { type: "string", description: "Sugestões de melhoria" },
                  automacao: { type: "string", description: "Oportunidades de automação" },
                  documentacao: { type: "string", description: "Documentação existente ou necessária" },
                  criticidadeDetalhada: {
                    type: "object",
                    properties: {
                      impactoNegocio: { type: "number", enum: [1, 3, 5] },
                      impactoCliente: { type: "number", enum: [1, 3, 5] },
                      riscoOperacional: { type: "number", enum: [1, 3, 5] },
                    },
                    required: ["impactoNegocio", "impactoCliente", "riscoOperacional"],
                  },
                  planoAcao: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        oque: { type: "string" },
                        porque: { type: "string" },
                        quem: { type: "string" },
                        quando: { type: "string" },
                        onde: { type: "string" },
                        como: { type: "string" },
                        custo: { type: "string" },
                      },
                      required: ["oque", "porque", "quem", "quando", "onde", "como", "custo"],
                    },
                  },
                  conclusao: { type: "string", description: "Conclusão do mapeamento" },
                },
                required: [
                  "objetivo", "porqueExiste", "clienteProcesso", "areasEnvolvidas",
                  "entradas", "etapas", "decisoes", "saidas", "recursos",
                  "frequencia", "tempoExecucao", "problemas", "problemasTexto",
                  "gargalos", "riscos", "controles", "indicadores", "sugestoes",
                  "automacao", "documentacao", "criticidadeDetalhada", "planoAcao", "conclusao",
                ],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "fill_process_mapping" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = await response.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(json));
      return new Response(
        JSON.stringify({ error: "A IA não retornou dados estruturados. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processData = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    return new Response(JSON.stringify(processData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-fill-process error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
