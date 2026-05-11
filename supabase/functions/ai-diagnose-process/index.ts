import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const toolSchema = {
  type: "function",
  function: {
    name: "generate_diagnosis",
    description: "Gera diagnóstico completo do processo em 6 fases",
    parameters: {
      type: "object",
      properties: {
        fase1: {
          type: "object",
          properties: {
            resumoExecutivo: { type: "string" },
            descricaoPontaAPonta: { type: "string" },
            principaisAtores: { type: "array", items: { type: "string" } },
            fluxoLogico: { type: "string" },
          },
          required: ["resumoExecutivo", "descricaoPontaAPonta", "principaisAtores", "fluxoLogico"],
        },
        fase2: {
          type: "object",
          properties: {
            problemas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  problema: { type: "string" },
                  tipo: { type: "string", enum: ["gargalo", "retrabalho", "risco", "ineficiencia"] },
                  severidade: { type: "string", enum: ["alto", "medio", "baixo"] },
                  impactoNegocio: { type: "string" },
                },
                required: ["problema", "tipo", "severidade", "impactoNegocio"],
              },
            },
            principaisGargalos: { type: "array", items: { type: "string" } },
            pontosRetrabalho: { type: "array", items: { type: "string" } },
            analiseRiscos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  risco: { type: "string" },
                  nivel: { type: "string", enum: ["alto", "medio", "baixo"] },
                  impacto: { type: "string" },
                },
                required: ["risco", "nivel", "impacto"],
              },
            },
          },
          required: ["problemas", "principaisGargalos", "pontosRetrabalho", "analiseRiscos"],
        },
        fase3: {
          type: "object",
          properties: {
            classificacaoAtividades: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  atividade: { type: "string" },
                  classificacao: { type: "string", enum: ["valor_agregado", "suporte", "desperdicio"] },
                },
                required: ["atividade", "classificacao"],
              },
            },
            scoreProcesso: { type: "number", description: "Score de 0 a 100" },
            nivelMaturidade: { type: "number", enum: [0, 1, 2, 3, 4] },
            descricaoMaturidade: { type: "string" },
            mediaMaturidade: { type: "number", description: "Média 0–4 calculada a partir das tarefas" },
            classificacaoMaturidade: {
              type: "string",
              enum: ["Baixa maturidade (analógico)", "Média maturidade (digital básico)", "Alta maturidade (digital estruturado)", "Avançado (inteligente)"]
            },
          },
          required: ["classificacaoAtividades", "scoreProcesso", "nivelMaturidade", "descricaoMaturidade", "mediaMaturidade", "classificacaoMaturidade"],
        },
        fase4: {
          type: "object",
          properties: {
            melhorias: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  problemaIdentificado: { type: "string" },
                  solucaoProposta: { type: "string" },
                  tipoTecnologia: { type: "string", enum: ["RPA", "Workflow", "API", "IA", "BI", "Manual"] },
                  impactoEsperado: { type: "string" },
                  complexidade: { type: "string", enum: ["Baixa", "Media", "Alta"] },
                  prioridade: { type: "string", enum: ["Alta", "Media", "Baixa"] },
                },
                required: ["problemaIdentificado", "solucaoProposta", "tipoTecnologia", "impactoEsperado", "complexidade", "prioridade"],
              },
            },
            reducaoTempoEstimada: { type: "string" },
            potencialAutomacao: { type: "string" },
          },
          required: ["melhorias", "reducaoTempoEstimada", "potencialAutomacao"],
        },
        fase5: {
          type: "object",
          properties: {
            acoes: {
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
                  prioridade: { type: "string", enum: ["Alta", "Media", "Baixa"] },
                },
                required: ["oque", "porque", "quem", "quando", "onde", "como", "custo", "prioridade"],
              },
            },
          },
          required: ["acoes"],
        },
        fase6: {
          type: "object",
          properties: {
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
                  classificacao: { type: "string", enum: ["Estrategico", "Tatico", "Operacional"] },
                  tipo: { type: "string", enum: ["Leading", "Lagging"] },
                },
                required: ["nome", "objetivo", "formulaCalculo", "meta", "periodicidade", "responsavel", "classificacao", "tipo"],
              },
            },
          },
          required: ["indicadores"],
        },
        analiseFinal: {
          type: "object",
          properties: {
            diagnosticoGeral: { type: "string" },
            top5Problemas: { type: "array", items: { type: "string" } },
            top5Oportunidades: { type: "array", items: { type: "string" } },
            recomendacaoEstrategica: { type: "string" },
          },
          required: ["diagnosticoGeral", "top5Problemas", "top5Oportunidades", "recomendacaoEstrategica"],
        },
      },
      required: ["fase1", "fase2", "fase3", "fase4", "fase5", "fase6", "analiseFinal"],
    },
  },
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const body = await req.json();
    const processoData = body?.processoData;
    const companyId = body?.company_id ?? null;
    if (!processoData) {
      return new Response(
        JSON.stringify({ error: "Dados do processo são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase não configurado para buscar configurações da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const DEFAULT_ROUTE_SCRIPT = `Você é um entrevistador de processos com tom humano e didático.
Siga estas regras principais e adapte-se caso o usuário especifique novas prioridades:
- Faça perguntas curtas e diretas
- Progrida fase a fase
- Estimule sempre o máximo de detalhes objetivos sobre cada resposta (quem faz, o que faz, quando, onde, ferramentas, documentos, exceções).

Seja sempre educado.`;

    const DEFAULT_AI_SKIN = `Você é Peter, o assistente virtual especialista em mapeamento e melhoria de processos do ProcessHub.App.
Sua persona deve transmitir segurança, clareza e proximidade humana. Fale em português do Brasil, com linguagem consultiva, acolhedora e objetiva.
Atue como um facilitador experiente em BPM, diagnóstico operacional e desenho de processos, ajudando o usuário a organizar ideias, estruturar informações e transformar descrições soltas em entendimento prático do processo.
Seu comportamento deve equilibrar empatia com foco: seja cordial, leve e didático, mas sempre conduza a conversa com direção, evitando dispersão e respostas genéricas.
Quando necessário, incentive exemplos concretos, detalhe operacional e contexto de negócio, sem parecer robótico nem burocrático.`;

    const DEFAULT_VALIDATION_RULES = `Regras de validação do assistente:
- Não inventar dados críticos
- Pedir esclarecimento quando a resposta estiver vaga
- Manter tom profissional e acolhedor
- Não avançar para o próximo tema sem informação suficiente
- Sinalizar quando houver lacunas para validação humana`;

    let customScript = DEFAULT_ROUTE_SCRIPT;
    let identityPrompt = DEFAULT_AI_SKIN;
    let validationRules = DEFAULT_VALIDATION_RULES;

    if (companyId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: configs } = await supabase
        .from("ai_configurations")
        .select("config_type, content")
        .eq("company_id", companyId)
        .in("config_type", ["route_script", "skin_identity", "skin_validation"]);

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
            identityPrompt = `Você é ${nome}, o assistente virtual especialista em mapeamento e melhoria de processos do ProcessHub.App.
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

Você atua como o motor inteligente de um sistema de diagnóstico e transformação de processos. Receba os dados preenchidos pelo usuário e gere um diagnóstico completo organizado em 6 FASES:

🟢 FASE 1 – MAPEAMENTO DO PROCESSO (AS IS)
- Resumo executivo do processo
- Descrição ponta a ponta
- Principais atores envolvidos
- Fluxo lógico simplificado

🟡 FASE 2 – DIAGNÓSTICO DO PROCESSO
- Lista estruturada de problemas (com tipo e severidade)
- Principais gargalos
- Pontos de retrabalho
- Análise de riscos (alto, médio, baixo) com impactos

🔴 FASE 3 – ANÁLISE E MATURIDADE
- Classificar cada atividade como: valor_agregado, suporte ou desperdicio
- Calcular SCORE DO PROCESSO (0 a 100) baseado em: % atividades manuais, gargalos, retrabalho, riscos, tempo
- Nível de maturidade digital por tarefa e do processo utilizando a escala 0–4:
  0 = Manual (papel, verbal, informal)
  1 = Planilha, e-mail ou controle básico
  2 = Sistema isolado (sem integração)
  3 = Sistema integrado / workflow estruturado
  4 = Automação avançada / IA aplicada
- Classificar a média do processo nas faixas:
  0–1,5 → Baixa maturidade (analógico)
  1,6–2,5 → Média maturidade (digital básico)
  2,6–3,5 → Alta maturidade (digital estruturado)
  3,6–4 → Avançado (inteligente)

🔵 FASE 4 – OPORTUNIDADES DE MELHORIA E AUTOMAÇÃO (TO BE)
- Para cada melhoria: problema, solução, tipo de tecnologia (RPA/Workflow/API/IA/BI/Manual), impacto, complexidade, prioridade
- Estimativa de redução de tempo
- Potencial de automação

🟣 FASE 5 – PLANO DE AÇÃO (5W2H)
- Tabela 5W2H completada e priorizada (mesmo que incompleta no input, completar automaticamente)

🟠 FASE 6 – INDICADORES DE DESEMPENHO (KPI)
- Para cada indicador: nome, objetivo, fórmula, meta, periodicidade, responsável
- Classificar: Estratégico/Tático/Operacional e Leading/Lagging

ANÁLISE FINAL:
- Diagnóstico geral (resumo executivo)
- Top 5 problemas críticos
- Top 5 oportunidades prioritárias
- Recomendação estratégica

REGRAS DE INTELIGÊNCIA: Infira automaticamente mesmo que o usuário não informe:
- Retrabalho → sugerir automação
- Atividades manuais → sugerir RPA
- Múltiplos sistemas → sugerir integração
- Decisões manuais → sugerir workflow
- Dados disponíveis → sugerir dashboard

Seja direto, executivo e orientado à melhoria. Sem enrolação. Sempre gere insights.`;

    const userContent = `Dados completos do processo para diagnóstico:\n\n${JSON.stringify(processoData, null, 2)}`;

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
          { role: "user", content: userContent },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "generate_diagnosis" } },
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
        JSON.stringify({ error: "Erro ao processar diagnóstico. Tente novamente." }),
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

    const diagData = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    return new Response(JSON.stringify(diagData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-diagnose-process error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
