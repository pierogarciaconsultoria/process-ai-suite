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
  textoSimples,
  type DocumentoGerado,
  type FontesDoProcedimento,
} from "../_shared/procedimento-fontes.ts";
import {
  atividadesFaltando,
  ehProcedimento,
  inserirDescricao,
  lerDocumentoDeApoio,
  lerSubsecoes,
  lotesDeAtividades,
  MARCADOR_DESCRICAO,
  promptDasAtividades,
  promptDoCorpo,
  SCHEMA_ATIVIDADES,
  semLinksInventados,
  subsecaoDosDados,
  type PadraoProcedimento,
  type SubsecaoAtividade,
} from "../_shared/procedimento-padrao.ts";
import { carregarPadrao } from "../_shared/padrao-banco.ts";

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

async function chamarIA(systemPrompt: string, conteudo: string, schema: object, chave: string): Promise<unknown> {
  try {
    return await callResponsesAPI({ systemPrompt, messages: [{ role: "user", content: conteudo }], responseSchema: schema, openaiApiKey: chave });
  } catch (erro) {
    console.error("ai-generate-document: falha na IA", erro);
    throw new HttpError(502, "O Peter não conseguiu gerar o documento agora. Tente de novo em instantes.");
  }
}

function hojeEmSaoPaulo(): string {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const IDENTIDADE_PROCEDIMENTO = `Você é o Peter, consultor de processos e de ISO 9001 da plataforma Peter (metodologia Piero Garcia Consultoria). Escreve procedimentos em português do Brasil, prontos para auditoria e para treinar um colaborador novo.`;

// PR/PA e IT: o corpo do documento e a descrição das atividades, em lotes paralelos. Atividade que a
// IA deixar de fora é pedida de novo; se ainda faltar, entra com os dados do mapeamento e um aviso.
async function gerarProcedimento(entrada: {
  dados: FontesDoProcedimento;
  padrao: PadraoProcedimento;
  instrucoes: string;
  empresa: string | null;
  // Procedimento ou instrução que a empresa já usa: fonte do "como fazer".
  documentoDeApoio: { nome: string; texto: string; cortado: boolean } | null;
  titulo: string;
  chave: string;
  // Tamanho de cada pedido à IA, para a cota (contado mesmo se uma chamada falhar).
  registrarConsumo: (caracteres: number) => void;
}): Promise<DocumentoGerado> {
  const { dados, padrao, chave } = entrada;
  const total = dados.atividades.length;
  const conteudo = JSON.stringify({
    empresa: entrada.empresa,
    dadosDoProcesso: dados,
    ...(entrada.documentoDeApoio ? { documentoDeApoio: entrada.documentoDeApoio } : {}),
  });
  const sistemaCorpo = [
    IDENTIDADE_PROCEDIMENTO,
    promptDoCorpo(padrao, total > 0, hojeEmSaoPaulo()),
    entrada.instrucoes ? `## INSTRUÇÕES ADICIONAIS DO MODELO (valem quando não conflitam com o padrão acima)\n${entrada.instrucoes}` : "",
    GUIA_DE_FONTES,
    SYSTEM_PROMPT_ATUAL,
  ].filter(Boolean).join("\n\n");

  const lotes = lotesDeAtividades(total);
  const escrever = async (lote: { de: number; ate: number }, aviso = "") => {
    const sistema = `${promptDasAtividades(padrao, lote, total)}${aviso}`;
    entrada.registrarConsumo(sistema.length + conteudo.length);
    return lerSubsecoes(await chamarIA(sistema, conteudo, SCHEMA_ATIVIDADES, chave));
  };
  entrada.registrarConsumo(sistemaCorpo.length + conteudo.length);
  const [corpoRaw, ...porLote] = await Promise.all([
    chamarIA(sistemaCorpo, conteudo, SCHEMA_DOCUMENTO, chave),
    ...lotes.map((lote) => escrever(lote)),
  ]);

  const corpo = lerDocumentoGerado(corpoRaw, entrada.titulo);
  if (!corpo) throw new HttpError(502, "O Peter não devolveu o documento. Tente gerar de novo.");

  // Segunda tentativa, em paralelo, só para os lotes com atividade faltando.
  const refeitos = await Promise.all(lotes.map((lote, indice) => {
    const faltando = atividadesFaltando(porLote[indice], lote);
    return faltando.length
      ? escrever(lote, `\n\nATENÇÃO: na tentativa anterior faltaram as atividades ${faltando.join(", ")}. Cubra TODAS as ordens de ${lote.de} a ${lote.ate}.`)
      : Promise.resolve(null);
  }));

  const avisos: string[] = [];
  const subsecoes: SubsecaoAtividade[] = [];
  lotes.forEach((lote, indice) => {
    const primeira = porLote[indice];
    const segunda = refeitos[indice];
    const melhor = segunda && atividadesFaltando(segunda, lote).length < atividadesFaltando(primeira, lote).length ? segunda : primeira;
    subsecoes.push(...melhor);
    for (const ordem of atividadesFaltando(melhor, lote)) {
      const atividade = dados.atividades.find((item) => item.ordem === ordem);
      if (!atividade) continue;
      subsecoes.push(subsecaoDosDados(atividade));
      avisos.push(`A atividade "${atividade.atividade}" foi descrita só com os dados do mapeamento: complete o texto.`);
    }
  });
  subsecoes.sort((a, b) => Math.min(...a.atividades) - Math.min(...b.atividades));

  const markdown = semLinksInventados(total > 0 ? inserirDescricao(corpo.content_markdown, subsecoes) : corpo.content_markdown.replace(MARCADOR_DESCRICAO, ""));
  return {
    ...corpo,
    content_markdown: markdown,
    content_text: textoSimples(markdown),
    attention_points: [...avisos, ...corpo.attention_points],
  };
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
      documento_apoio = null,
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

    const tituloPadrao = String(manualDescription?.title || (dadosDoProcesso?.identificacao.nome ? `${template.name ?? "Documento"} - ${dadosDoProcesso.identificacao.nome}` : template.name) || "Documento gerado");
    // As seções já vão à parte; o modelo segue sem elas e sem as instruções, que estão no prompt.
    const { sections: _secoesDoModelo, ...modelo } = modeloSemInstrucoes(template);
    const secoes = (Array.isArray(sections) ? sections : []).map((secao: Linha) => ({
      titulo: secao?.sectionTitle, descricao: secao?.sectionDescription, obrigatoria: secao?.isRequired === true,
    }));

    const documentoDeApoio = lerDocumentoDeApoio(documento_apoio);
    const lease = await acquireAiQuota(client, "ai-generate-document", companyId);
    let consumo = 0;
    let documento: DocumentoGerado | null;
    let padraoUsado: PadraoProcedimento["origem"] | null = null;
    try {
      if (dadosDoProcesso && ehProcedimento(tipoDocumento)) {
        // PR/PA e IT seguem o padrão do Peter (estrutura e manual de escrita); as seções do modelo da tela não valem aqui.
        const padrao = await carregarPadrao(client, companyId, tipoDocumento);
        padraoUsado = padrao.origem;
        documento = await gerarProcedimento({
          dados: dadosDoProcesso, padrao, instrucoes, empresa: companyContext?.companyName ?? null,
          documentoDeApoio,
          titulo: dadosDoProcesso.identificacao.nome || tituloPadrao, chave: OPENAI_API_KEY,
          registrarConsumo: (caracteres) => { consumo += caracteres; },
        });
      } else {
        const userContent = JSON.stringify({ template: modelo, sections: secoes, empresa: companyContext?.companyName ?? null, dadosDoProcesso, manualDescription });
        consumo = userContent.length + systemPrompt.length;
        documento = lerDocumentoGerado(await chamarIA(systemPrompt, userContent, SCHEMA_DOCUMENTO, OPENAI_API_KEY), tituloPadrao);
      }
    } finally {
      await lease.complete(consumo, Math.max(1, Math.ceil(consumo / 200)));
    }
    if (!documento) throw new HttpError(502, "O Peter não devolveu o documento. Tente gerar de novo.");

    return new Response(JSON.stringify({
      ...documento,
      generation_metadata: {
        mode: "ia",
        ai_model: "gpt-4o",
        template_id: template.id ?? null,
        sections_count: secoes.length,
        padrao: padraoUsado,
        documento_de_apoio: documentoDeApoio?.nome ?? null,
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
