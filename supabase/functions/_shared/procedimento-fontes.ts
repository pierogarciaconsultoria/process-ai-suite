// Fontes do procedimento (PR/IT e demais documentos de um processo mapeado): o servidor lê o
// processo do banco e monta, de uma vez, tudo o que a entrevista, o mapa e os módulos registraram.
// Assim o documento não depende do que a tela envia nem de campos do formulário antigo.

import { bpmnParaTexto } from "./bpmn-texto.ts";
import { normalizarDiagnostico, normalizarPlano } from "./roteiro-analise.ts";
import { ROTEIRO_PADRAO } from "./roteiro-entrevista.ts";
import type { EstadoRoteiro } from "./roteiro-engine.ts";
import { sanitizarEstado } from "./roteiro-peter.ts";

type Linha = Record<string, unknown>;

export const MAX_MAPA_NO_DOCUMENTO = 15_000;
const MAX_RESPOSTA = 2_000;
const MAX_TEXTO = 3_000;

const str = (valor: unknown, limite = MAX_TEXTO) => (typeof valor === "string" ? valor.trim().slice(0, limite) : "");
const lista = (valor: unknown): Linha[] => (Array.isArray(valor) ? valor.filter((item) => item && typeof item === "object") as Linha[] : []);
const chave = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export interface RespostaDaEntrevista {
  pergunta: string;
  resposta: string;
}

export interface FontesDoProcedimento {
  identificacao: Record<string, string>;
  inicioEFim: {
    gatilho: string;
    clienteDoProcesso: string;
    entradas: Array<{ fornecedor: string; entrada: string }>;
    saidas: Array<{ saida: string; cliente: string }>;
  };
  atividades: Array<{ ordem: number; atividade: string; responsavel: string; ferramentaOuDocumento: string }>;
  // Respostas registradas na entrevista com o Peter, por etapa, com o nome da pergunta.
  entrevista: Array<{ etapa: string; respostas: RespostaDaEntrevista[] }>;
  // Ajustes feitos depois, na edição do relatório ou no formulário.
  registrosDoProcesso: Record<string, string>;
  mapaAsIs: string;
  diagnostico: {
    resumo: string;
    riscosIso9001: Array<{ risco: string; evidencia: string }>;
    riscosRegistrados: Array<{ risco: string; consequencia: string; probabilidade: string; impacto: string }>;
    maturidade: string;
    lacunas: string[];
  } | null;
  indicadores: Array<{ nome: string; objetivo: string; formula: string; meta: string; periodicidade: string; responsavel: string; origem: string }>;
  melhoriasPlanejadas: {
    resumoToBe: string;
    melhorias: string[];
    acoes: Array<{ oque: string; quem: string; prazo: string; status: string }>;
  } | null;
}

function lerEstado(raw: unknown): EstadoRoteiro | null {
  if (!raw) return null;
  try {
    return sanitizarEstado(ROTEIRO_PADRAO, raw);
  } catch {
    return null;
  }
}

function respostasPorEtapa(estado: EstadoRoteiro | null): FontesDoProcedimento["entrevista"] {
  if (!estado) return [];
  return ROTEIRO_PADRAO.etapas
    .map((etapa) => ({
      etapa: `${etapa.numero}. ${etapa.titulo}`,
      respostas: etapa.perguntas.flatMap((pergunta) => {
        const registrada = estado.respostas[pergunta.id];
        if (registrada?.status !== "respondida") return [];
        const resposta = registrada.textos.map((texto) => texto.trim()).filter(Boolean).join("; ").slice(0, MAX_RESPOSTA);
        return resposta ? [{ pergunta: pergunta.rotulo, resposta }] : [];
      }),
    }))
    .filter((etapa) => etapa.respostas.length > 0);
}

function metaDoIndicador(linha: Linha): string {
  if (typeof linha.meta === "number") {
    return `${linha.sentido === "menor" ? "≤" : "≥"} ${linha.meta}${str(linha.unidade) ? ` ${str(linha.unidade)}` : ""}`;
  }
  return str(linha.meta_texto) || str(linha.meta) || "[a definir]";
}

// Indicadores acompanhados no módulo primeiro; depois os do formulário e os sugeridos no plano
// que ainda não estão lá (o mesmo nome aparece uma vez).
function indicadoresDoProcesso(processo: Linha, modulo: Linha[], sugeridos: Array<Record<string, string>>): FontesDoProcedimento["indicadores"] {
  const vistos = new Set<string>();
  const saida: FontesDoProcedimento["indicadores"] = [];
  const incluir = (item: FontesDoProcedimento["indicadores"][number]) => {
    const nome = chave(item.nome);
    if (!nome || vistos.has(nome)) return;
    vistos.add(nome);
    saida.push(item);
  };
  for (const linha of modulo) {
    if (linha.ativo === false) continue;
    incluir({
      nome: str(linha.nome, 200), objetivo: str(linha.objetivo, 500), formula: str(linha.formula, 500), meta: metaDoIndicador(linha),
      periodicidade: str(linha.periodicidade, 100), responsavel: str(linha.responsavel, 200), origem: "acompanhado no módulo Indicadores",
    });
  }
  for (const linha of lista(processo.indicadores)) {
    incluir({
      nome: str(linha.nome, 200), objetivo: str(linha.objetivo, 500), formula: str(linha.formulaCalculo, 500), meta: str(linha.meta, 200) || "[a definir]",
      periodicidade: str(linha.periodicidade, 100), responsavel: str(linha.responsavel, 200), origem: "registrado no mapeamento",
    });
  }
  for (const sugerido of sugeridos) {
    incluir({
      nome: str(sugerido.nome, 200), objetivo: str(sugerido.motivo, 500), formula: str(sugerido.formula, 500), meta: str(sugerido.meta, 200) || "[a definir]",
      periodicidade: str(sugerido.periodicidade, 100), responsavel: str(sugerido.responsavel, 200), origem: "sugerido no plano de melhoria",
    });
  }
  return saida;
}

function semVazios(registro: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(registro).filter(([, valor]) => valor));
}

export function montarFontesDoProcedimento(entrada: { processo: Linha; indicadores?: Linha[]; acoes?: Linha[] }): FontesDoProcedimento {
  const { processo } = entrada;
  const estado = lerEstado(processo.entrevista_roteiro);
  const diagnostico = normalizarDiagnostico(estado?.analises.diagnostico_as_is);
  const plano = normalizarPlano(estado?.analises.plano_melhoria);

  const mapa = str(processo.bpmn_as_is, 2_000_000);
  const convertido = mapa ? bpmnParaTexto(mapa) : null;
  const mapaAsIs = !mapa
    ? "Não há mapa AS IS desenhado."
    : !convertido || convertido.totalElementos === 0
      ? "O mapa AS IS existe, mas não pôde ser lido."
      : convertido.texto.length > MAX_MAPA_NO_DOCUMENTO
        ? `${convertido.texto.slice(0, MAX_MAPA_NO_DOCUMENTO)}\n[mapa resumido: o restante foi omitido]`
        : convertido.texto;

  const riscosRegistrados = lista(processo.riscos)
    .filter((risco) => str(risco.risco) && risco._hipotese !== true)
    .map((risco) => ({ risco: str(risco.risco, 500), consequencia: str(risco.consequencia, 500), probabilidade: str(risco.probabilidade, 50), impacto: str(risco.impacto, 50) }));

  const acoes = (entrada.acoes ?? [])
    .filter((acao) => str(acao.oque))
    .slice(0, 40)
    .map((acao) => ({ oque: str(acao.oque, 500), quem: str(acao.quem, 200), prazo: str(acao.prazo, 20) || str(acao.quando_texto, 100), status: str(acao.status, 50) }));

  return {
    identificacao: semVazios({
      nome: str(processo.nome, 300),
      area: str(processo.area, 200),
      responsavelPeloProcesso: str(processo.responsavel, 200),
      objetivo: str(processo.objetivo),
      classificacao: str(processo.classificacao, 200),
      areasEnvolvidas: str(processo.areas_envolvidas, 500),
      entrevistados: str(processo.entrevistados, 500),
      dataDoMapeamento: str(processo.data_mapeamento, 30),
      revisaoDoMapa: str(processo.mapa_revisao, 30),
      situacao: str(processo.status, 50),
    }),
    inicioEFim: {
      gatilho: str(processo.gatilho),
      clienteDoProcesso: str(processo.cliente_processo, 300),
      entradas: lista(processo.entradas).map((item) => ({ fornecedor: str(item.fornecedor, 200), entrada: str(item.entrada, 300) })).filter((item) => item.fornecedor || item.entrada).slice(0, 30),
      saidas: lista(processo.saidas).map((item) => ({ saida: str(item.saida, 300), cliente: str(item.cliente, 200) })).filter((item) => item.saida || item.cliente).slice(0, 30),
    },
    atividades: lista(processo.etapas)
      .filter((etapa) => str(etapa.atividade))
      .slice(0, 80)
      .map((etapa, indice) => ({
        ordem: indice + 1,
        atividade: str(etapa.atividade, 500),
        responsavel: str(etapa.responsavel, 200),
        ferramentaOuDocumento: str(etapa.ferramentaDocumento, 300),
      })),
    entrevista: respostasPorEtapa(estado),
    registrosDoProcesso: semVazios({
      decisoes: str(processo.decisoes),
      recursosESistemas: str(processo.recursos),
      problemas: str(processo.problemas_texto),
      riscos: str(processo.riscos_texto),
    }),
    mapaAsIs,
    diagnostico: diagnostico || riscosRegistrados.length
      ? {
          resumo: diagnostico?.resumo ?? "",
          riscosIso9001: diagnostico?.riscosIso ?? [],
          riscosRegistrados,
          maturidade: diagnostico ? `${diagnostico.maturidade.nivel}${diagnostico.maturidade.justificativa ? ` — ${diagnostico.maturidade.justificativa}` : ""}` : "",
          lacunas: diagnostico?.lacunas ?? [],
        }
      : null,
    indicadores: indicadoresDoProcesso(processo, entrada.indicadores ?? [], (plano?.indicadores ?? []) as unknown as Array<Record<string, string>>),
    melhoriasPlanejadas: plano || acoes.length
      ? {
          resumoToBe: plano?.resumoToBe ?? "",
          melhorias: (plano?.melhorias ?? []).map((melhoria) => `${melhoria.titulo}: ${melhoria.solucao}`.slice(0, 500)),
          acoes,
        }
      : null,
  };
}

// Para cada seção habitual de PR/IT, de onde vem a informação. Vale também para modelos com
// outros nomes de seção: a IA usa a fonte mais próxima pelo sentido.
export const GUIA_DE_FONTES = `## DE ONDE VEM CADA SEÇÃO (dados em "dadosDoProcesso")
- Objetivo: identificacao.objetivo e a resposta "Objetivo" da entrevista.
- Campo de aplicação: identificacao.area e areasEnvolvidas; começa em inicioEFim.gatilho e termina na entrega a inicioEFim.clienteDoProcesso.
- Referências normativas: as normas e exigências citadas na entrevista ("Normas e exigências"); cláusulas da ISO 9001 aplicáveis só como sugestão marcada "(sugerido pelo Peter — validar)".
- Definições e siglas: os termos e siglas que aparecem nos dados (a definição pode vir do conhecimento geral).
- Responsabilidades: responsáveis das atividades, raias do mapa (mapaAsIs), responsável pelo processo e aprovador citado na entrevista. Use cargos ou áreas.
- Descrição do processo / das atividades: a sequência de atividades, completada pelo fluxo do mapaAsIs (ordem, quem faz, sistema, documentos usados e gerados) e pelas respostas de sistemas, prazos e atividades terceirizadas.
- Pontos de decisão e fluxos alternativos: as decisões do mapaAsIs com cada caminho, e as respostas de decisões, aprovações, aprovação negada, atividades em paralelo e o que dá errado; também registrosDoProcesso.decisoes.
- Prazos: respostas "Regras de prazo" e "Prazo para concluir" e os temporizadores do mapa.
- Registros: documentos e dados do mapa, ferramentas e documentos das atividades e as saídas do processo.
- Indicadores: a lista "indicadores", com fórmula, meta, periodicidade e responsável; meta ausente fica "[a definir]".
- Riscos e controles: diagnostico.riscosIso9001 e riscosRegistrados, e as respostas "O que dá errado" e "Erros e retrabalho".
- Documentos relacionados: documentos citados nos dados.
- Controle de informação documentada: identificacao.revisaoDoMapa e dataDoMapeamento.
O procedimento descreve o processo como ele é feito hoje (atividades e mapa AS IS). "melhoriasPlanejadas" ainda não estão implantadas: não as descreva como prática atual; cite-as no máximo em attention_points.`;

// Esquema da resposta (modo strict): o documento em markdown e os itens de revisão.
export const SCHEMA_DOCUMENTO = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    content_markdown: { type: "string" },
    executive_summary: { type: "string" },
    attention_points: { type: "array", items: { type: "string" } },
    suggested_risks: { type: "array", items: { type: "string" } },
    suggested_indicators: { type: "array", items: { type: "string" } },
  },
  required: ["title", "content_markdown", "executive_summary", "attention_points", "suggested_risks", "suggested_indicators"],
};

export interface DocumentoGerado {
  title: string;
  content_markdown: string;
  content_text: string;
  executive_summary: string;
  attention_points: string[];
  suggested_risks: string[];
  suggested_indicators: string[];
}

// Versão em texto do markdown (busca e indexação).
export function textoSimples(markdown: string): string {
  return markdown.replace(/[#*`>|]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

const textos = (valor: unknown) => (Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim()) : []);

// null quando a resposta não traz um documento.
export function lerDocumentoGerado(raw: unknown, tituloPadrao: string): DocumentoGerado | null {
  const dados = raw && typeof raw === "object" ? (raw as Linha) : {};
  const markdown = typeof dados.content_markdown === "string" ? dados.content_markdown.replace(/^```(?:markdown|md)?\s*\n/i, "").replace(/\n```\s*$/, "").trim() : "";
  if (!markdown) return null;
  return {
    title: str(dados.title, 300) || tituloPadrao,
    content_markdown: markdown,
    content_text: textoSimples(markdown),
    executive_summary: str(dados.executive_summary),
    attention_points: textos(dados.attention_points),
    suggested_risks: textos(dados.suggested_risks),
    suggested_indicators: textos(dados.suggested_indicators),
  };
}
