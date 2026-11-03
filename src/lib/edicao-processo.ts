import type { Json, Tables, TablesUpdate } from "@/integrations/supabase/types";
import type { EntradaForm, EtapaForm, IndicadorForm, SaidaForm } from "@/data/processo-form-types";
import { mapProcessRowToForm } from "@/lib/processos";
import { normalizarPlano, type AcaoPlano } from "../../supabase/functions/_shared/roteiro-analise";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import type { EstadoRoteiro } from "../../supabase/functions/_shared/roteiro-engine";
import { sanitizarEstado } from "../../supabase/functions/_shared/roteiro-peter";

// Edição do processo direto no relatório, uma seção por vez. Cada campo grava na coluna do
// processo e, quando o processo passou pela entrevista, também na resposta registrada,
// que é de onde o relatório lê vários itens.

export type SecaoEditavel = "dados" | "identificacao" | "sipoc" | "atividades" | "medicao" | "plano";

export const TITULO_SECAO: Record<SecaoEditavel, string> = {
  dados: "Dados do processo",
  identificacao: "Identificação do processo",
  sipoc: "SIPOC",
  atividades: "Processo atual (AS IS)",
  medicao: "Medição e indicadores",
  plano: "Plano de ação (5W2H)",
};

type ColunaTexto =
  | "nome"
  | "area"
  | "responsavel"
  | "entrevistados"
  | "data_mapeamento"
  | "objetivo"
  | "classificacao"
  | "gatilho"
  | "cliente_processo"
  | "recursos"
  | "decisoes"
  | "problemas_texto";

export interface CampoTexto {
  chave: string;
  rotulo: string;
  coluna?: ColunaTexto;
  perguntaId?: string;
  tipo?: "linha" | "texto" | "data" | "opcao";
  opcoes?: string[];
  ajuda?: string;
}

const GATILHO: CampoTexto = { chave: "gatilho", rotulo: "Início (o que dispara o processo)", coluna: "gatilho", perguntaId: "e2.gatilho", tipo: "texto" };

export const CAMPOS_TEXTO: Record<SecaoEditavel, CampoTexto[]> = {
  dados: [
    { chave: "nome", rotulo: "Nome do processo", coluna: "nome", perguntaId: "e1.nome" },
    { chave: "area", rotulo: "Área", coluna: "area" },
    { chave: "dono", rotulo: "Dono do processo", coluna: "responsavel" },
    { chave: "entrevistados", rotulo: "Entrevistado", coluna: "entrevistados" },
    { chave: "data", rotulo: "Data do mapeamento", coluna: "data_mapeamento", tipo: "data" },
    { chave: "objetivo", rotulo: "Objetivo do processo", coluna: "objetivo", perguntaId: "e1.objetivo", tipo: "texto" },
  ],
  identificacao: [
    { chave: "classificacao", rotulo: "Classificação", coluna: "classificacao", perguntaId: "e1.classificacao", tipo: "opcao", opcoes: ["Negócio", "Apoio", "Gestão"] },
    { chave: "frequencia", rotulo: "Frequência", perguntaId: "e1.frequencia" },
    { chave: "requisitos", rotulo: "Requisitos normativos", perguntaId: "e1.requisitos", tipo: "texto" },
    GATILHO,
    { chave: "cliente", rotulo: "Cliente do processo", coluna: "cliente_processo", perguntaId: "e2.cliente" },
    { chave: "sistemas", rotulo: "Sistemas e ferramentas", coluna: "recursos", perguntaId: "e3.sistemas", tipo: "texto" },
  ],
  sipoc: [GATILHO],
  atividades: [
    { chave: "decisoes", rotulo: "Decisões", coluna: "decisoes", perguntaId: "e3.decisoes", tipo: "texto" },
    { chave: "aprovacoes", rotulo: "Aprovações", perguntaId: "e3.aprovacoes", tipo: "texto" },
    { chave: "aprovador", rotulo: "Aprovador e substituto", perguntaId: "e3.aprovador" },
    { chave: "aprovacao_negada", rotulo: "Quando a aprovação é negada", perguntaId: "e3.aprovacao_negada", tipo: "texto" },
    { chave: "paralelo", rotulo: "Atividades em paralelo", perguntaId: "e3.paralelo", tipo: "texto" },
    { chave: "terceiros", rotulo: "Atividades terceirizadas", perguntaId: "e3.terceiros", tipo: "texto" },
    { chave: "prazos", rotulo: "Regras de prazo", perguntaId: "e3.prazos", tipo: "texto" },
    { chave: "excecoes", rotulo: "Erros e exceções", perguntaId: "e3.excecoes", tipo: "texto" },
  ],
  medicao: [
    { chave: "medicao_hoje", rotulo: "Como é medido hoje", perguntaId: "e4.medicao_hoje", tipo: "texto" },
    { chave: "sla", rotulo: "Prazo / SLA", perguntaId: "e4.sla" },
    { chave: "volume", rotulo: "Volume", perguntaId: "e4.volume" },
    { chave: "erros", rotulo: "Erros e retrabalho", coluna: "problemas_texto", perguntaId: "e4.erros", tipo: "texto" },
    { chave: "indicadores_ideais", rotulo: "Indicadores desejados", perguntaId: "e4.indicadores_ideais", tipo: "texto" },
  ],
  plano: [],
};

export interface RascunhoSecao {
  textos: Record<string, string>;
  entradas: EntradaForm[];
  saidas: SaidaForm[];
  etapas: EtapaForm[];
  indicadores: IndicadorForm[];
  planoAcao: AcaoPlano[];
}

export function lerEstadoDoProcesso(row: Tables<"processos">): EstadoRoteiro | null {
  if (!row.entrevista_roteiro) return null;
  try {
    return sanitizarEstado(ROTEIRO_PADRAO, row.entrevista_roteiro);
  } catch {
    return null;
  }
}

function respostaTexto(estado: EstadoRoteiro | null, perguntaId: string): string {
  const registrada = estado?.respostas[perguntaId];
  return registrada?.status === "respondida" ? registrada.textos.join("; ") : "";
}

// Campos com onde gravar: sem entrevista, os que só existem como resposta ficam de fora.
export function camposDaSecao(secao: SecaoEditavel, estado: EstadoRoteiro | null): CampoTexto[] {
  return CAMPOS_TEXTO[secao].filter((campo) => campo.coluna || (campo.perguntaId && estado));
}

export function rascunhoDaSecao(row: Tables<"processos">, secao: SecaoEditavel): RascunhoSecao {
  const estado = lerEstadoDoProcesso(row);
  const form = mapProcessRowToForm(row);
  const textos = Object.fromEntries(
    camposDaSecao(secao, estado).map((campo) => {
      // Mesma fonte do relatório: o cabeçalho lê as colunas; as demais seções, a resposta da entrevista e, sem ela, a coluna.
      const daEntrevista = campo.perguntaId && secao !== "dados" ? respostaTexto(estado, campo.perguntaId) : "";
      const daColuna = campo.coluna ? String(row[campo.coluna] ?? "") : "";
      return [campo.chave, daEntrevista || daColuna];
    }),
  );
  return {
    textos,
    entradas: form.entradas.filter((item) => item.entrada.trim() || item.fornecedor.trim()),
    saidas: form.saidas.filter((item) => item.saida.trim() || item.cliente.trim()),
    etapas: form.etapas.filter((etapa) => etapa.atividade.trim()),
    indicadores: form.indicadores.filter((indicador) => indicador.nome.trim()),
    planoAcao: normalizarPlano(estado?.analises.plano_melhoria)?.planoAcao ?? [],
  };
}

function gravarResposta(estado: EstadoRoteiro, perguntaId: string, texto: string, valor?: string): EstadoRoteiro {
  const anterior = estado.respostas[perguntaId];
  const limpo = texto.trim();
  // Apagar não remove a resposta: a pergunta vira lacuna, e a entrevista continua concluída.
  return {
    ...estado,
    respostas: {
      ...estado.respostas,
      [perguntaId]: {
        perguntaId,
        textos: limpo ? [limpo] : [],
        ...(valor !== undefined ? { valor } : anterior?.valor !== undefined ? { valor: anterior.valor } : {}),
        status: limpo ? "respondida" : "lacuna",
        origem: anterior?.origem ?? "entrevista",
        ...(anterior?.repeticaoEncerrada !== undefined ? { repeticaoEncerrada: anterior.repeticaoEncerrada } : {}),
      },
    },
  };
}

// Só o que a seção edita: nada de reescrever o processo inteiro (status, revisão, conversa…).
export function atualizacaoDaSecao(
  row: Tables<"processos">,
  secao: SecaoEditavel,
  rascunho: RascunhoSecao,
  userId: string,
): TablesUpdate<"processos"> {
  let estado = lerEstadoDoProcesso(row);
  let mudouEstado = false;
  const original = rascunhoDaSecao(row, secao);
  const atualizacao: TablesUpdate<"processos"> = { updated_by: userId };

  for (const campo of camposDaSecao(secao, estado)) {
    const valor = (rascunho.textos[campo.chave] ?? "").trim();
    if (valor === (original.textos[campo.chave] ?? "").trim()) continue;
    if (campo.coluna) atualizacao[campo.coluna] = valor;
    if (campo.perguntaId && estado) {
      estado = gravarResposta(estado, campo.perguntaId, valor, campo.tipo === "opcao" ? valor : undefined);
      mudouEstado = true;
    }
  }

  if (secao === "sipoc") {
    atualizacao.entradas = rascunho.entradas.filter((item) => item.entrada.trim() || item.fornecedor.trim()) as unknown as Json;
    atualizacao.saidas = rascunho.saidas.filter((item) => item.saida.trim() || item.cliente.trim()) as unknown as Json;
  }
  if (secao === "atividades") {
    atualizacao.etapas = rascunho.etapas
      .filter((etapa) => etapa.atividade.trim())
      .map((etapa, indice) => ({ ...etapa, ordem: indice + 1 })) as unknown as Json;
  }
  if (secao === "medicao") {
    atualizacao.indicadores = rascunho.indicadores.filter((indicador) => indicador.nome.trim()) as unknown as Json;
  }
  if (secao === "plano" && estado) {
    const plano = normalizarPlano(estado.analises.plano_melhoria);
    if (plano) {
      const planoAcao = rascunho.planoAcao.filter((acao) => acao.oque.trim());
      estado = { ...estado, analises: { ...estado.analises, plano_melhoria: { ...plano, planoAcao } } };
      mudouEstado = true;
    }
  }

  if (estado && mudouEstado) atualizacao.entrevista_roteiro = estado as unknown as Json;
  return atualizacao;
}
