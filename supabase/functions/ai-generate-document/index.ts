import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, authorizeCompany, authorizeProcess, errorResponse, requireString } from "../_shared/auth.ts";
import { acquireAiQuota, fetchWithAiQuota } from "../_shared/quota.ts";
import { runConfiguredAssistant, stripCodeFence } from "../_shared/openai-assistant.ts";
import { instrucoesDoModelo, modeloSemInstrucoes } from "../_shared/instrucoes-documento.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IDENTIDADE_PETER_DOC = `Você é o Peter, assistente de documentação de processos da ProcessHub, desenvolvido com base na metodologia Piero Garcia Consultoria.
Fundamentos: BPM/BPMN (ABPMP), ISO 9001/SGQ, Lean, Cadeia de Valor de Porter, Gestão por Objetivos (Drucker) e metodologia própria Piero Garcia.
Regras absolutas: use apenas os dados fornecidos; nunca invente informações; quando ausente, escreva [não informado]; escreva em português do Brasil; siga rigorosamente o template solicitado; retorne o JSON definido.`;

const PROMPT_RACI = `Gere a Matriz RACI completa. Inclua cabeçalho com processo, data e versão 1.0; legenda R, A, C e I; e tabela com uma linha por atividade e uma coluna por cargo/área.
Toda atividade deve ter EXATAMENTE 1 R e EXATAMENTE 1 A. Sem R: ⚠️ DEFINIR R. Sem A ou com múltiplos A: ⚠️ DEFINIR A. Termine com Pendências ou "Nenhuma pendência identificada".`;

const PROMPT_FICHA = `Gere a Ficha do Processo com EXATAMENTE: Identificação; Entradas e Saídas/SIPOC; Recursos Necessários; Indicadores; Riscos Identificados; Documentos Relacionados; Nível de Maturidade.
Identificação: nome, código PROC-[área 3 letras]-[número], macroprocesso/cadeia de valor, classificação Primário/Suporte/Gestão, área, gestor por cargo, frequência e gatilho.
Indicadores: KPI | Fórmula | Meta | Frequência | Responsável. Riscos: Risco | Probabilidade | Impacto | Controle. Maturidade: escolha um entre Inicial, Estruturado, Padronizado, Monitorado e Otimizado.`;

const PROMPT_POP_V5 = `Gere o POP — Metodologia v5 com EXATAMENTE estas 11 seções numeradas:
1. OBJETIVO; 2. CAMPO DE APLICAÇÃO; 3. REFERÊNCIAS NORMATIVAS; 4. DEFINIÇÕES E SIGLAS; 5. RESPONSABILIDADES; 6. DESCRIÇÃO DAS ATIVIDADES; 7. PONTOS DE DECISÃO E FLUXOS ALTERNATIVOS; 8. FLUXOGRAMA; 9. INDICADORES DE DESEMPENHO; 10. REGISTROS E EVIDÊNCIAS; 11. HISTÓRICO DE REVISÕES.
No cabeçalho use POP-[área 3 letras]-001, versão 1.0 e data. Na seção 6, use tabela Seq. | Atividade [Verbo+Objeto] | Responsável | Sistema | Prazo | Registro. O fluxograma referencia BPMN_[nome]_v1.`;

const PROMPT_DIAGNOSTICO_V5 = `Gere o Relatório de Diagnóstico v5 com EXATAMENTE: 1 Sumário Executivo; 2 Caracterização; 3 SIPOC; 4 Desempenho Atual; 5 Oito Desperdícios Lean; 6 Riscos ISO 9001; 7 Achados Classificados; 8 Maturidade; 9 Recomendações Estratégicas; 10 Conclusão.
Avalie todos os 8 desperdícios: Superprodução, Espera, Transporte, Retrabalho, Excesso de processamento, Inventário, Movimento e Defeitos.
ISO 9001: responsáveis, evidências/registros, critério de aceitação, controle de versão, contingência e indicadores com meta/responsável.
Classifique achados em críticos, relevantes e oportunidades. Escolha uma maturidade: Inicial, Estruturado, Padronizado, Monitorado ou Otimizado.`;

const PROMPT_5W2H = `Gere Plano de Ação em tabela 5W2H: # | O quê | Por quê | Quem | Quando | Onde | Como | Quanto.
Uma linha por melhoria/ação. Priorize Crítico, Relevante e Oportunidade. Quem deve ser cargo; Quando deve ser prazo concreto; Quanto deve ser esforço estimado ou [a estimar]. Se não houver melhorias, derive apenas dos problemas e riscos fornecidos.`;

const SYSTEM_PROMPT_ATUAL = `Você é um consultor sênior especialista em gestão documental, BPM, padronização operacional, melhoria contínua e documentação corporativa.
Sua tarefa é gerar documentos de processos para o ProcessHub. Use somente os dados fornecidos; não invente dados críticos; use [não informado] quando necessário; respeite o modelo; escreva em português do Brasil; gere markdown estruturado.
Responda sempre em JSON com: title, content_markdown, content_text, executive_summary, attention_points, suggested_risks, suggested_indicators, generation_metadata e ai_prompt_used.`;

function getSystemPromptPorTipo(tipo: string): string {
  const prompts: Record<string, string> = {
    raci: PROMPT_RACI,
    ficha_processo: PROMPT_FICHA,
    pop_v5: PROMPT_POP_V5,
    diagnostico: PROMPT_DIAGNOSTICO_V5,
    "Relatório de Análise do Processo": PROMPT_DIAGNOSTICO_V5,
    "Plano de Ação": PROMPT_5W2H,
  };
  return prompts[tipo] ? `${IDENTIDADE_PETER_DOC}\n\n${prompts[tipo]}\n\n${SYSTEM_PROMPT_ATUAL}` : SYSTEM_PROMPT_ATUAL;
}

function buildFallbackMarkdown(templateName: string, sections: { sectionTitle: string; sectionDescription?: string }[], context: Record<string, unknown>) {
  const body = sections
    .map((section) => {
      const contextKey = section.sectionTitle.toLowerCase();
      const contextValue = Object.entries(context).find(([key]) => key.toLowerCase().includes(contextKey))?.[1];
      const content =
        typeof contextValue === "string" && contextValue.trim()
          ? contextValue
          : section.sectionDescription || "Não informado.";
      return `## ${section.sectionTitle}\n\n${content}`;
    })
    .join("\n\n");

  return `# ${templateName}\n\n${body}`.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { client, user } = await authenticateRequest(req);
    const body = await req.json();
    const {
      template,
      sections = [],
      mappedProcessData = null,
      manualDescription = null,
      generationConfig = null,
      companyContext = null,
      process_id = null,
      use_peter_assistant = false,
    } = body ?? {};
    const companyId = requireString(companyContext?.companyId, "company_id");
    await authorizeCompany(client, user.id, companyId);
    if (mappedProcessData) {
      const processId = requireString(process_id, "process_id");
      await authorizeProcess(client, processId, companyId);
    }

    if (!template) {
      return new Response(
        JSON.stringify({ error: "Template é obrigatório para gerar o documento." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    const contextPayload = {
      template: modeloSemInstrucoes(template),
      sections,
      companyContext,
      mappedProcessData,
      manualDescription,
    };

    if (!OPENAI_API_KEY) {
      const contentMarkdown = buildFallbackMarkdown(
        template.name ?? "Documento gerado",
        sections,
        manualDescription || mappedProcessData?.normalized || {},
      );

      return new Response(
        JSON.stringify({
          title: manualDescription?.title || template.name || "Documento gerado",
          content_markdown: contentMarkdown,
          content_text: contentMarkdown.replace(/[#*`>-]/g, "").trim(),
          executive_summary: "Documento gerado em modo fallback, sem chamada externa de IA.",
          attention_points: ["Configurar OPENAI_API_KEY para geração avançada."],
          suggested_risks: [],
          suggested_indicators: [],
          generation_metadata: {
            mode: "fallback",
            template_id: template.id ?? null,
            sections_count: Array.isArray(sections) ? sections.length : 0,
          },
          ai_model: "fallback-local",
          ai_prompt_used: "fallback-local",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tipoDocumento = String(template?.documentType || template?.type || generationConfig?.documentType || "");
    // As instruções do modelo vêm antes das regras fixas e do formato JSON, que prevalecem.
    const promptDoTipo = getSystemPromptPorTipo(tipoDocumento);
    const instrucoes = instrucoesDoModelo(template, generationConfig);
    const systemPrompt = instrucoes
      ? promptDoTipo.replace(SYSTEM_PROMPT_ATUAL, `${instrucoes}\n\n${SYSTEM_PROMPT_ATUAL}`)
      : promptDoTipo;

    if (use_peter_assistant === true) {
      const userContent = JSON.stringify(contextPayload);
      const lease = await acquireAiQuota(client, "ai-generate-document", companyId);
      const consumo = userContent.length + instrucoes.length;
      try {
        const content = stripCodeFence(await runConfiguredAssistant(
          OPENAI_API_KEY,
          `${systemPrompt}\nRetorne somente o objeto JSON solicitado, sem markdown ao redor do JSON.`,
          userContent,
        ));
        JSON.parse(content);
        return new Response(content, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } finally {
        await lease.complete(consumo, Math.max(1, Math.ceil(consumo / 200)));
      }
    }

    const openAiBaseUrl = Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1";
    const response = await fetchWithAiQuota(client, "ai-generate-document", companyId, JSON.stringify(contextPayload).length + instrucoes.length,
      `${openAiBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: JSON.stringify(contextPayload),
            },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ error: `AI error ${response.status}: ${text}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || "{}";

    return new Response(content, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return errorResponse(e, corsHeaders);
  }
});
