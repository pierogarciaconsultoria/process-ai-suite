import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { lerEstadoDoProcesso } from "@/lib/edicao-processo";
import { chaveDoNome } from "@/lib/processo-duplicado";
import { normalizarPlano } from "../../supabase/functions/_shared/roteiro-analise";

// Plano de Ação: as ações 5W2H acompanhadas até a conclusão (migration 202611040001).

export type Acao = Tables<"acoes">;
export const STATUS_ACAO = ["A fazer", "Em andamento", "Concluída", "Cancelada"] as const;
export type StatusAcao = (typeof STATUS_ACAO)[number];

export const ORIGEM_ACAO: Record<string, string> = {
  manual: "Criada no Plano de Ação",
  plano_processo: "Plano de melhoria do processo",
  risco: "Tratamento de risco",
  indicador: "Indicador fora da meta",
  nao_conformidade: "Não conformidade",
  auditoria: "Auditoria",
  analise_critica: "Análise crítica",
};

const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function data(ano: number, mes: number, dia: number): string | null {
  const valor = new Date(Date.UTC(ano, mes - 1, dia));
  if (valor.getUTCFullYear() !== ano || valor.getUTCMonth() !== mes - 1 || valor.getUTCDate() !== dia) return null;
  return valor.toISOString().slice(0, 10);
}

function ultimoDia(ano: number, mes: number): string | null {
  return mes >= 1 && mes <= 12 ? data(ano, mes, new Date(Date.UTC(ano, mes, 0)).getUTCDate()) : null;
}

// "15/12/2026", "2026-12-15", "12/2026" e "dezembro de 2026" viram data; o resto ("[a definir]",
// "1º trimestre") fica só como texto. Mês sem dia vale até o último dia do mês.
export function interpretarPrazo(texto: string): string | null {
  const limpo = texto.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let m = limpo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return data(Number(m[3]), Number(m[2]), Number(m[1]));
  m = limpo.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return data(Number(m[1]), Number(m[2]), Number(m[3]));
  m = limpo.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return ultimoDia(Number(m[2]), Number(m[1]));
  m = limpo.match(/^([a-z]+)\s*(?:de\s+|\/\s*)?(\d{4})$/);
  if (m) {
    const mes = MESES.findIndex((nome) => nome === m![1] || (m![1].length >= 3 && nome.startsWith(m![1])));
    if (mes >= 0) return ultimoDia(Number(m[2]), mes + 1);
  }
  return null;
}

// Ações do 5W2H do processo, prontas para o Plano de Ação; a chave evita importar duas vezes.
export function acoesDoPlano(processo: Tables<"processos">, userId: string): TablesInsert<"acoes">[] {
  const plano = normalizarPlano(lerEstadoDoProcesso(processo)?.analises.plano_melhoria);
  const vistas = new Set<string>();
  return (plano?.planoAcao ?? []).flatMap((acao) => {
    const chave = `plano:${chaveDoNome(acao.oque)}`;
    if (!chaveDoNome(acao.oque) || vistas.has(chave)) return [];
    vistas.add(chave);
    const prazo = interpretarPrazo(acao.quando);
    return [{
      company_id: processo.company_id,
      processo_id: processo.id,
      origem: "plano_processo",
      chave_origem: chave,
      oque: acao.oque.trim(),
      porque: acao.porque.trim(),
      onde: acao.onde.trim(),
      como: acao.como.trim(),
      quem: acao.quem.trim(),
      prazo,
      quando_texto: prazo ? "" : acao.quando.trim(),
      custo: acao.custo.trim(),
      created_by: userId,
      updated_by: userId,
    }];
  });
}

export function acoesAindaNaoEnviadas(processo: Tables<"processos">, existentes: Acao[], userId: string): TablesInsert<"acoes">[] {
  const enviadas = new Set(existentes.filter((acao) => acao.origem === "plano_processo").map((acao) => acao.chave_origem));
  return acoesDoPlano(processo, userId).filter((acao) => !enviadas.has(acao.chave_origem ?? null));
}

export function hojeISO(agora = new Date()): string {
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function estaAtrasada(acao: Pick<Acao, "prazo" | "status">, hoje = hojeISO()): boolean {
  return Boolean(acao.prazo) && acao.status !== "Concluída" && acao.status !== "Cancelada" && acao.prazo! < hoje;
}

export function formatarPrazo(acao: Pick<Acao, "prazo" | "quando_texto">): string {
  if (acao.prazo) return new Date(`${acao.prazo}T00:00:00`).toLocaleDateString("pt-BR");
  return acao.quando_texto || "[a definir]";
}

export function resumirAcoes(acoes: Acao[], hoje = hojeISO()) {
  return {
    aFazer: acoes.filter((acao) => acao.status === "A fazer").length,
    emAndamento: acoes.filter((acao) => acao.status === "Em andamento").length,
    atrasadas: acoes.filter((acao) => estaAtrasada(acao, hoje)).length,
    concluidas: acoes.filter((acao) => acao.status === "Concluída").length,
  };
}
