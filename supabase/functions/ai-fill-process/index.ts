import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, authorizeCompany, errorResponse, requireString } from "../_shared/auth.ts";
import { fetchWithAiQuota } from "../_shared/quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, user } = await authenticateRequest(req);
    const body = await req.json();
    const descricao = body?.descricao;
    const companyId = requireString(body?.company_id, "company_id");
    await authorizeCompany(client, user.id, companyId);
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Descrição deve ter pelo menos 10 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const DEFAULT_ROUTE_SCRIPT = `Você é um entrevistador de processos com tom humano e didático.
Siga estas regras principais e adapte-se caso o usuário especifique novas prioridades:
- Faça perguntas curtas e diretas
- Progrida fase a fase
- Estimule sempre o máximo de detalhes objetivos sobre cada resposta (quem faz, o que faz, quando, onde, ferramentas, documentos, exceções).

Seja sempre educado.`;

    const FALLBACK_IDENTITY = `Você é o Peter, assistente virtual especialista em gestão e mapeamento de processos de negócios, desenvolvido com base na metodologia exclusiva da Piero Garcia Consultoria. Seu papel é conduzir entrevistas de levantamento de processos e guiar gestores e equipes na análise e documentação de processos organizacionais de forma estruturada, didática e eficiente.

Você integra as seguintes referências teóricas em cada análise:
- BPM / BPMN (ABPMP) — estrutura e notação de processos
- ISO 9001 / SGQ — conformidade, rastreabilidade e melhoria contínua
- Lean — eliminação de desperdícios e fluxo eficiente
- Cadeia de Valor de Porter — posicionamento do processo na estratégia
- Drucker — Gestão por objetivos — foco em resultado e responsabilidade
- Metodologia própria Piero Garcia — sequência, critérios e documentação exclusivos

Tom: profissional, acessível e didático. Orientado a perguntas — você guia, nunca pressupõe. Analítico e consultivo — você identifica problemas e sugere melhorias ao longo de toda a conversa.`;

    const DEFAULT_VALIDATION_RULES = `Regras de validação do assistente:
- Não inventar dados críticos
- Pedir esclarecimento quando a resposta estiver vaga
- Manter tom profissional e acolhedor
- Não avançar para o próximo tema sem informação suficiente
- Sinalizar quando houver lacunas para validação humana`;

    let customScript = DEFAULT_ROUTE_SCRIPT;
    let identityPrompt = FALLBACK_IDENTITY;
    let validationRules = DEFAULT_VALIDATION_RULES;

    if (companyId) {
      const { data: configs, error: configsError } = await client
        .from("ai_configurations")
        .select("config_type, content")
        .eq("company_id", companyId)
        .in("config_type", ["route_script", "skin_identity", "skin_validation"]);

      if (configsError) throw configsError;

      const typedConfigs = (configs || []) as Array<{ config_type: string; content: string }>;
      const routeScriptConfig = typedConfigs.find((item) => item.config_type === "route_script")?.content;
      const skinIdentityRaw = typedConfigs.find((item) => item.config_type === "skin_identity")?.content;
      const skinValidation = typedConfigs.find((item) => item.config_type === "skin_validation")?.content;

      customScript = routeScriptConfig || DEFAULT_ROUTE_SCRIPT;
      validationRules = skinValidation || DEFAULT_VALIDATION_RULES;

      if (skinIdentityRaw) {
        try {
          const parsedSkin = JSON.parse(skinIdentityRaw);
          if (parsedSkin && typeof parsedSkin === "object" && ("nome" in parsedSkin || "tom" in parsedSkin || "estilo" in parsedSkin)) {
            const nome = typeof parsedSkin.nome === "string" ? parsedSkin.nome : "Peter";
            const tom = typeof parsedSkin.tom === "string" ? parsedSkin.tom : "consultivo, humano e didático";
            const estilo = typeof parsedSkin.estilo === "string" ? parsedSkin.estilo : "profissional e acolhedor";
            identityPrompt = `Você é ${nome}, o assistente virtual especialista em mapeamento e melhoria de processos do ProcessHub.
Sua comunicação deve seguir um tom ${tom}, com estilo ${estilo}.
Atue como um facilitador experiente em BPM, diagnóstico operacional e desenho de processos, ajudando o usuário a organizar ideias e estruturar o entendimento do processo com clareza.
Conduza a conversa com empatia, objetividade e segurança, incentivando exemplos concretos e descrições úteis para tomada de decisão.`;
          } else {
            identityPrompt = skinIdentityRaw;
          }
        } catch {
          identityPrompt = skinIdentityRaw;
        }
      }
    }

    const systemPrompt = `${identityPrompt}
${customScript ? `\n### DIRETRIZES DA EMPRESA:\n${customScript}\n` : ""}
${validationRules ? `\n### REGRAS DE VALIDAÇÃO:\n${validationRules}\n` : ""}
Com base na descrição fornecida pelo usuário, preencha TODOS os campos relevantes do mapeamento de processo.
Seja objetivo, prático e específico. Use linguagem profissional em português brasileiro.
Limite etapas a 4-8 itens. Gere 2-4 riscos. Gere 2-4 indicadores. Gere 1-3 ações no plano de ação.
Para probabilidade e impacto de riscos, use valores entre 1 e 5.
`;

    const lovableBaseUrl = Deno.env.get("LOVABLE_BASE_URL") ?? "https://ai.gateway.lovable.dev/v1";
    const response = await fetchWithAiQuota(client, "ai-fill-process", companyId, descricao.length, `${lovableBaseUrl}/chat/completions`, {
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
                  riscos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        risco: { type: "string" },
                        consequencia: { type: "string" },
                        probabilidade: { type: "number", description: "Valor de 1 a 5" },
                        impacto: { type: "number", description: "Valor de 1 a 5" },
                      },
                      required: ["risco", "consequencia", "probabilidade", "impacto"],
                    },
                  },
                  indicadores: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        nome: { type: "string" },
                        objetivo: { type: "string" },
                        formulaCalculo: { type: "string" },
                        meta: { type: "string" },
                        periodicidade: { type: "string" },
                        responsavel: { type: "string" },
                      },
                      required: ["nome", "objetivo", "formulaCalculo", "meta", "periodicidade", "responsavel"],
                    },
                  },
                  oportunidadesMelhoria: { type: "string", description: "Melhorias e automações priorizadas para o processo" },
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
                },
                required: [
                  "objetivo", "clienteProcesso", "areasEnvolvidas",
                  "entradas", "etapas", "decisoes", "saidas", "recursos",
                  "problemas", "problemasTexto", "riscos", "indicadores",
                  "oportunidadesMelhoria", "planoAcao",
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
    return errorResponse(e, corsHeaders);
  }
});
