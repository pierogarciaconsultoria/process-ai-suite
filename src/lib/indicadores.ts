import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { mapProcessRowToForm } from "@/lib/processos";
import { lerEstadoDoProcesso } from "@/lib/edicao-processo";
import { chaveDoNome } from "@/lib/processo-duplicado";
import { normalizarPlano } from "../../supabase/functions/_shared/roteiro-analise";

// Indicadores dos processos e seus resultados por período (migration 202611040002).

export type Indicador = Tables<"indicadores">;
export type Medicao = Tables<"indicador_medicoes">;
export const PERIODICIDADES = ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"] as const;
export type Situacao = "dentro" | "fora" | "sem_meta" | "sem_resultado";

export const COR_SITUACAO: Record<Situacao, string> = {
  dentro: "bg-success/15 text-success",
  fora: "bg-destructive/15 text-destructive",
  sem_meta: "bg-muted text-foreground",
  sem_resultado: "text-muted-foreground",
};

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  dentro: "Dentro da meta",
  fora: "Fora da meta",
  sem_meta: "Sem meta",
  sem_resultado: "Sem resultado",
};

export function lerNumero(entrada: string): number | null {
  const texto = entrada.trim();
  if (!texto) return null;
  // "1.234,5" e "10.000" (pt-BR) viram 1234.5 e 10000; "2.5" continua 2.5.
  const limpo = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : /^-?\d{1,3}(\.\d{3})+$/.test(texto) ? texto.replace(/\./g, "") : texto;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

// Lê a meta escrita no mapeamento: "≥ 95%", "até 2 dias", "menos de 3 reclamações", "R$ 10.000".
export function lerMeta(texto: string): { meta: number | null; sentido: "maior" | "menor"; unidade: string } {
  const limpo = texto.trim().toLowerCase();
  const achado = limpo.match(/-?\d[\d.]*(?:,\d+)?/);
  const meta = achado ? lerNumero(achado[0]) : null;
  const sentido = /≤|<=|<|até|ate |máximo|maximo|no máximo|menos|abaixo|reduzir|menor/.test(limpo) ? "menor" : "maior";
  const unidade = limpo.includes("%")
    ? "%"
    : /r\$/.test(limpo)
      ? "R$"
      : /\bdias?\b/.test(limpo)
        ? "dias"
        : /\bhoras?\b/.test(limpo)
          ? "horas"
          : "";
  return { meta, sentido, unidade };
}

function periodicidade(texto: string): string {
  const limpo = texto.trim().toLowerCase();
  return PERIODICIDADES.find((opcao) => limpo.startsWith(opcao.toLowerCase().slice(0, 4))) ?? "Mensal";
}

type DefinicaoIndicador = { nome: string; objetivo: string; formula: string; meta: string; periodicidade: string; responsavel: string; sentido?: "maior" | "menor" };

// Indicadores do processo, prontos para acompanhar: os citados na entrevista e os sugeridos pelo
// Peter no plano de melhoria. A chave pelo nome evita importar duas vezes.
export function indicadoresDoProcesso(processo: Tables<"processos">, userId: string): TablesInsert<"indicadores">[] {
  const citados: DefinicaoIndicador[] = mapProcessRowToForm(processo).indicadores.map((indicador) => ({
    nome: indicador.nome ?? "",
    objetivo: indicador.objetivo ?? "",
    formula: indicador.formulaCalculo ?? "",
    meta: indicador.meta ?? "",
    periodicidade: indicador.periodicidade ?? "",
    responsavel: indicador.responsavel ?? "",
  }));
  const sugeridos: DefinicaoIndicador[] = (normalizarPlano(lerEstadoDoProcesso(processo)?.analises.plano_melhoria)?.indicadores ?? []).map((indicador) => ({
    nome: indicador.nome,
    objetivo: indicador.motivo,
    formula: indicador.formula,
    meta: indicador.meta,
    periodicidade: indicador.periodicidade,
    responsavel: indicador.responsavel,
    sentido: indicador.sentido,
  }));
  const vistas = new Set<string>();
  return [...citados, ...sugeridos].flatMap((indicador) => {
    const chaveNome = chaveDoNome(indicador.nome);
    const chave = `processo:${processo.id}:${chaveNome}`;
    if (!chaveNome || vistas.has(chave)) return [];
    vistas.add(chave);
    const lida = lerMeta(indicador.meta);
    return [{
      company_id: processo.company_id,
      processo_id: processo.id,
      chave_origem: chave,
      nome: indicador.nome.trim(),
      objetivo: indicador.objetivo.trim(),
      formula: indicador.formula.trim(),
      unidade: lida.unidade,
      sentido: indicador.sentido ?? lida.sentido,
      meta: lida.meta,
      meta_texto: lida.meta === null ? indicador.meta.trim() : "",
      periodicidade: periodicidade(indicador.periodicidade),
      responsavel: indicador.responsavel.trim(),
      created_by: userId,
      updated_by: userId,
    }];
  });
}

export function indicadoresAindaNaoEnviados(processo: Tables<"processos">, existentes: Indicador[], userId: string): TablesInsert<"indicadores">[] {
  const enviados = new Set(existentes.map((indicador) => indicador.chave_origem));
  return indicadoresDoProcesso(processo, userId).filter((indicador) => !enviados.has(indicador.chave_origem ?? null));
}

export function situacao(indicador: Pick<Indicador, "meta" | "sentido">, valor: number | null | undefined): Situacao {
  if (valor === null || valor === undefined) return "sem_resultado";
  if (indicador.meta === null) return "sem_meta";
  return (indicador.sentido === "menor" ? valor <= indicador.meta : valor >= indicador.meta) ? "dentro" : "fora";
}

export function formatarValor(valor: number, unidade: string): string {
  const texto = valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (!unidade) return texto;
  if (unidade === "R$") return `R$ ${texto}`;
  return unidade === "%" ? `${texto}%` : `${texto} ${unidade}`;
}

export function formatarMeta(indicador: Pick<Indicador, "meta" | "sentido" | "unidade" | "meta_texto">): string {
  if (indicador.meta === null) return indicador.meta_texto || "Sem meta";
  return `${indicador.sentido === "menor" ? "≤" : "≥"} ${formatarValor(indicador.meta, indicador.unidade)}`;
}

export function periodoDe(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;
}

// Os `quantidade` meses até o atual, do mais antigo para o mais recente.
export function ultimosPeriodos(quantidade: number, hoje = new Date()): string[] {
  return Array.from({ length: quantidade }, (_, indice) => periodoDe(new Date(hoje.getFullYear(), hoje.getMonth() - (quantidade - 1 - indice), 1)));
}

export function rotuloPeriodo(periodo: string): string {
  const [ano, mes] = periodo.split("-").map(Number);
  const nome = new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${nome}/${String(ano).slice(2)}`;
}

export function ultimaMedicao(medicoes: Medicao[], indicadorId: string): Medicao | undefined {
  return medicoes
    .filter((medicao) => medicao.indicador_id === indicadorId)
    .sort((a, b) => b.periodo.localeCompare(a.periodo))[0];
}

// Resultado fora da meta vira ação no Plano de Ação (ISO 9001, 9.1.3 e 10.2).
export function acaoParaResultadoFora(indicador: Indicador, medicao: Medicao, userId: string): TablesInsert<"acoes"> {
  return {
    company_id: indicador.company_id,
    processo_id: indicador.processo_id,
    origem: "indicador",
    chave_origem: `indicador:${indicador.id}:${medicao.periodo}`,
    oque: `Tratar o resultado fora da meta de "${indicador.nome}" (${rotuloPeriodo(medicao.periodo)})`,
    porque: `Resultado ${formatarValor(medicao.valor, indicador.unidade)}; meta ${formatarMeta(indicador)}.`,
    quem: indicador.responsavel,
    created_by: userId,
    updated_by: userId,
  };
}
