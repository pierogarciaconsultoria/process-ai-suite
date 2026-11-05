import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeCompany, authorizeProcess, errorResponse, HttpError, requireString } from "../_shared/auth.ts";
import { acquireAiQuota } from "../_shared/quota.ts";
import { callResponsesAPI } from "../_shared/openai-assistant.ts";
import { instrucoesDoModelo, modeloSemInstrucoes } from "../_shared/instrucoes-documento.ts";
import {
  GUIA_DE_FONTES,
  lerDocumentoGerado,
  montarFontesDoProcedimento,
  SCHEMA_DOCUMENTO,
  type FontesDoProcedimento,
} from "../_shared/procedimento-fontes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IDENTIDADE_PETER_DOC = `Você é o Peter, assistente de documentação de processos da plataforma Peter, desenvolvido com base na metodologia Piero Garcia Consultoria.
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
Sua tarefa é gerar documentos de processos na plataforma Peter. Use somente os dados fornecidos; não invente dados críticos; use [não informado] quando necessário; respeite o modelo; escreva em português do Brasil; gere markdown estruturado.
Responda em JSON com: title; content_markdown (o documento completo, em markdown, seção por seção do modelo); executive_summary; attention_points (o que o revisor deve conferir, inclusive cada [não informado]); suggested_risks; suggested_indicators.`;

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

type Linha = Record<string, unknown>;

const COLUNAS_DO_PROCESSO = [
  "id", "nome", "area", "responsavel", "objetivo", "classificacao", "areas_envolvidas", "entrevistados", "data_mapeamento",
  "mapa_revisao", "status", "gatilho", "cliente_processo", "entradas", "saidas", "etapas", "indicadores", "riscos",
  "decisoes", "recursos", "problemas_texto", "riscos_texto", "bpmn_as_is", "entrevista_roteiro",
].join(", ");

// Uma tabela ainda não criada (migration não aplicada) entra vazia, sem impedir o documento.
async function ler(consulta: PromiseLike<{ data: unknown; error: unknown }>, tabela: string): Promise<Linha[]> {
  const { data, error } = await consulta;
  if (error) {
    console.warn(`ai-generate-document: ${tabela} indisponível`, error);
    return [];
  }
  return Array.isArray(data) ? (data as Linha[]) : [];
}

// O processo é lido do banco com as permissões de quem pediu, nunca do que a tela enviou.
async function carregarFontes(client: SupabaseClient, processId: string, companyId: string): Promise<FontesDoProcedimento> {
  const { data: processo, error } = await client.from("processos").select(COLUNAS_DO_PROCESSO).eq("id", processId).eq("company_id", companyId).maybeSingle();
  if (error) throw error;
  if (!processo) throw new HttpError(404, "Processo não encontrado.");
  const [indicadores, acoes] = await Promise.all([
    ler(client.from("indicadores").select("nome, objetivo, formula, unidade, sentido, meta, meta_texto, periodicidade, responsavel, ativo").eq("company_id", companyId).eq("processo_id", processId).order("nome").limit(50), "indicadores"),
    ler(client.from("acoes").select("oque, quem, prazo, quando_texto, status").eq("company_id", companyId).eq("processo_id", processId).order("prazo", { ascending: true, nullsFirst: false }).limit(40), "acoes"),
  ]);
  return montarFontesDoProcedimento({ processo: processo as unknown as Linha, indicadores, acoes });
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
    } = body ?? {};
    const companyId = requireString(companyContext?.companyId, "company_id");
    await authorizeCompany(client, user.id, companyId);
    if (!template) throw new HttpError(400, "Template é obrigatório para gerar o documento.");

    const processId = typeof process_id === "string" && process_id.trim() ? process_id.trim() : null;
    if (mappedProcessData && !processId) requireString(process_id, "process_id");
    let dadosDoProcesso: FontesDoProcedimento | null = null;
    if (processId) {
      await authorizeProcess(client, processId, companyId);
      dadosDoProcesso = await carregarFontes(client, processId, companyId);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new HttpError(503, "A IA de documentos não está configurada. Avise o suporte.");

    const tipoDocumento = String(template?.documentType || template?.type || generationConfig?.documentType || "");
    // As instruções do modelo vêm antes das regras fixas e do formato JSON, que prevalecem.
    const promptDoTipo = getSystemPromptPorTipo(tipoDocumento);
    const instrucoes = instrucoesDoModelo(template, generationConfig);
    const systemPrompt = [
      instrucoes ? promptDoTipo.replace(SYSTEM_PROMPT_ATUAL, `${instrucoes}\n\n${SYSTEM_PROMPT_ATUAL}`) : promptDoTipo,
      dadosDoProcesso ? GUIA_DE_FONTES : "",
    ].filter(Boolean).join("\n\n");

    // As seções já vão à parte; o modelo segue sem elas e sem as instruções, que estão no prompt.
    const { sections: _secoesDoModelo, ...modelo } = modeloSemInstrucoes(template);
    const contextPayload = {
      template: modelo,
      sections: (Array.isArray(sections) ? sections : []).map((secao: Linha) => ({
        titulo: secao?.sectionTitle, descricao: secao?.sectionDescription, obrigatoria: secao?.isRequired === true,
      })),
      empresa: companyContext?.companyName ?? null,
      dadosDoProcesso,
      manualDescription,
    };
    const userContent = JSON.stringify(contextPayload);
    const tituloPadrao = String(manualDescription?.title || (dadosDoProcesso?.identificacao.nome ? `${template.name ?? "Documento"} - ${dadosDoProcesso.identificacao.nome}` : template.name) || "Documento gerado");

    const lease = await acquireAiQuota(client, "ai-generate-document", companyId);
    const consumo = userContent.length + systemPrompt.length;
    let raw: unknown;
    try {
      raw = await callResponsesAPI({
        systemPrompt,
        messages: [{ role: "user", content: userContent }],
        responseSchema: SCHEMA_DOCUMENTO,
        openaiApiKey: OPENAI_API_KEY,
      });
    } catch (erro) {
      console.error("ai-generate-document: falha na IA", erro);
      throw new HttpError(502, "O Peter não conseguiu gerar o documento agora. Tente de novo em instantes.");
    } finally {
      await lease.complete(consumo, Math.max(1, Math.ceil(consumo / 200)));
    }

    const documento = lerDocumentoGerado(raw, tituloPadrao);
    if (!documento) throw new HttpError(502, "O Peter não devolveu o documento. Tente gerar de novo.");

    return new Response(JSON.stringify({
      ...documento,
      generation_metadata: {
        mode: "ia",
        ai_model: "gpt-4o",
        template_id: template.id ?? null,
        sections_count: contextPayload.sections.length,
        process_id: processId,
        map_revision: dadosDoProcesso?.identificacao.revisaoDoMapa ?? null,
        fontes: dadosDoProcesso
          ? {
              respostas_da_entrevista: dadosDoProcesso.entrevista.reduce((total, etapa) => total + etapa.respostas.length, 0),
              atividades: dadosDoProcesso.atividades.length,
              mapa_as_is: !dadosDoProcesso.mapaAsIs.startsWith("Não há mapa"),
              indicadores: dadosDoProcesso.indicadores.length,
              diagnostico: Boolean(dadosDoProcesso.diagnostico),
            }
          : null,
      },
      ai_prompt_used: "ai-generate-document",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return errorResponse(e, corsHeaders);
  }
});
