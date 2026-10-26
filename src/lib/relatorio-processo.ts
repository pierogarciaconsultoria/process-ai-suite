import type { Tables } from "@/integrations/supabase/types";
import type { IndicadorForm } from "@/data/processo-form-types";
import { mapProcessRowToForm } from "@/lib/processos";
import {
  normalizarDiagnostico,
  normalizarPlano,
  type DiagnosticoRoteiro,
  type PlanoMelhoriaRoteiro,
} from "../../supabase/functions/_shared/roteiro-analise";
import { ROTEIRO_PADRAO } from "../../supabase/functions/_shared/roteiro-entrevista";
import { listarLacunas, progresso, proximoPasso, type EstadoRoteiro } from "../../supabase/functions/_shared/roteiro-engine";
import { sanitizarEstado } from "../../supabase/functions/_shared/roteiro-peter";

export interface ItemRelatorio {
  rotulo: string;
  valor: string;
}

export interface AtividadeRelatorio {
  ordem: number;
  atividade: string;
  responsavel: string;
  ferramenta: string;
}

export interface SipocRelatorio {
  fornecedores: string[];
  entradas: string[];
  processo: string[];
  saidas: string[];
  clientes: string[];
}

export interface RelatorioProcesso {
  nome: string;
  area: string;
  dono: string;
  entrevistados: string;
  dataMapeamento: string;
  status: string;
  revisao: string;
  objetivo: string;
  ficha: ItemRelatorio[];
  sipoc: SipocRelatorio;
  atividades: AtividadeRelatorio[];
  fluxo: ItemRelatorio[];
  medicao: ItemRelatorio[];
  indicadores: IndicadorForm[];
  diagnostico: DiagnosticoRoteiro | null;
  plano: PlanoMelhoriaRoteiro | null;
  lacunas: string[];
  proximosPassos: string[];
  bpmnAsIs: string;
  // null quando o processo não passou pela entrevista guiada.
  entrevista: { concluida: boolean; etapa: string } | null;
}

// Máximo de atividades na coluna "Processo" do SIPOC, que é uma visão de alto nível.
const MAX_ATIVIDADES_SIPOC = 7;

function unicos(valores: string[]): string[] {
  const vistos = new Set<string>();
  return valores
    .map((valor) => valor.trim())
    .filter((valor) => {
      const chave = valor.toLowerCase();
      if (!valor || vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
}

function lerEstado(row: Tables<"processos">): EstadoRoteiro | null {
  if (!row.entrevista_roteiro) return null;
  try {
    return sanitizarEstado(ROTEIRO_PADRAO, row.entrevista_roteiro);
  } catch {
    return null;
  }
}

function resposta(estado: EstadoRoteiro | null, perguntaId: string): string {
  const registrada = estado?.respostas[perguntaId];
  return registrada?.status === "respondida" ? registrada.textos.join("; ") : "";
}

// Itens com valor: da resposta registrada na entrevista ou, sem ela, do campo do formulário.
function itens(estado: EstadoRoteiro | null, definicoes: Array<[rotulo: string, perguntaId: string | null, fallback?: string]>): ItemRelatorio[] {
  return definicoes
    .map(([rotulo, perguntaId, fallback]) => ({ rotulo, valor: (perguntaId ? resposta(estado, perguntaId) : "") || fallback?.trim() || "" }))
    .filter((item) => item.valor);
}

export function montarRelatorio(row: Tables<"processos">): RelatorioProcesso {
  const form = mapProcessRowToForm(row);
  const estado = lerEstado(row);
  const diagnostico = normalizarDiagnostico(estado?.analises.diagnostico_as_is);
  const plano = normalizarPlano(estado?.analises.plano_melhoria);

  const entradas = form.entradas.filter((item) => item.entrada.trim() || item.fornecedor.trim());
  const saidas = form.saidas.filter((item) => item.saida.trim() || item.cliente.trim());
  const atividades = form.etapas
    .filter((etapa) => etapa.atividade.trim())
    .map((etapa, indice) => ({
      ordem: indice + 1,
      atividade: etapa.atividade.trim(),
      responsavel: etapa.responsavel.trim(),
      ferramenta: (etapa.ferramentaDocumento ?? "").trim(),
    }));
  const nomesAtividades = atividades.map((atividade) => atividade.atividade);
  const excedentes = nomesAtividades.length - MAX_ATIVIDADES_SIPOC;

  const lacunas = unicos([
    ...(estado ? listarLacunas(ROTEIRO_PADRAO, estado).map((pergunta) => pergunta.rotulo) : []),
    ...(diagnostico?.lacunas ?? []),
  ]);

  const concluida = estado ? proximoPasso(ROTEIRO_PADRAO, estado).tipo === "concluido" : false;
  const proximosPassos = plano
    ? plano.planoAcao.map((acao) => [acao.oque, [acao.quem, acao.quando].filter(Boolean).join(", ")].filter(Boolean).join(" — "))
    : estado && !concluida
      ? [`Concluir a entrevista (${progresso(ROTEIRO_PADRAO, estado).rotulo}) para gerar o diagnóstico e o plano de melhoria.`]
      : [];

  return {
    nome: form.nomeProcesso || "Processo sem nome",
    area: form.area,
    dono: form.donoProcesso,
    entrevistados: form.entrevistados,
    dataMapeamento: form.data,
    status: row.status,
    revisao: row.mapa_revisao,
    objetivo: form.objetivo,
    ficha: itens(estado, [
      ["Classificação", "e1.classificacao", form.classificacao],
      ["Frequência", "e1.frequencia"],
      ["Requisitos normativos", "e1.requisitos"],
      ["Gatilho", "e2.gatilho", form.gatilho],
      ["Cliente do processo", "e2.cliente", form.clienteProcesso],
      ["Sistemas e ferramentas", "e3.sistemas", form.recursos],
    ]),
    sipoc: {
      fornecedores: unicos(entradas.map((item) => item.fornecedor)),
      entradas: unicos(entradas.map((item) => item.entrada)),
      processo: excedentes > 0
        ? [...nomesAtividades.slice(0, MAX_ATIVIDADES_SIPOC), `+ ${excedentes} atividade${excedentes > 1 ? "s" : ""}`]
        : nomesAtividades,
      saidas: unicos(saidas.map((item) => item.saida)),
      clientes: unicos(saidas.map((item) => item.cliente)),
    },
    atividades,
    fluxo: itens(estado, [
      ["Decisões", "e3.decisoes", estado ? "" : form.decisoes],
      ["Aprovações", "e3.aprovacoes"],
      ["Aprovador e substituto", "e3.aprovador"],
      ["Quando a aprovação é negada", "e3.aprovacao_negada"],
      ["Atividades em paralelo", "e3.paralelo"],
      ["Atividades terceirizadas", "e3.terceiros"],
      ["Regras de prazo", "e3.prazos"],
      ["Erros e exceções", "e3.excecoes"],
    ]),
    medicao: itens(estado, [
      ["Como é medido hoje", "e4.medicao_hoje"],
      ["Prazo / SLA", "e4.sla"],
      ["Volume", "e4.volume"],
      ["Erros e retrabalho", "e4.erros", estado ? "" : form.problemasTexto],
      ["Indicadores desejados", "e4.indicadores_ideais"],
    ]),
    indicadores: form.indicadores.filter((indicador) => indicador.nome.trim()),
    diagnostico,
    plano,
    lacunas,
    proximosPassos,
    bpmnAsIs: form.bpmnAsIs,
    entrevista: estado ? { concluida, etapa: progresso(ROTEIRO_PADRAO, estado).rotulo } : null,
  };
}
