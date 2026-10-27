import type { EstadoRoteiro } from "../../supabase/functions/_shared/roteiro-engine";

// Ciclo de vida do processo, na ordem em que avança. "Obsoleto" fica fora da sequência.
export const PROCESSO_STATUS = [
  "Em entrevista",
  "Diagnosticado",
  "Melhorias aprovadas",
  "Implementado",
  "Obsoleto",
] as const;

export type ProcessoStatus = (typeof PROCESSO_STATUS)[number];

export const ETAPAS_CICLO: Array<{ status: Exclude<ProcessoStatus, "Obsoleto">; descricao: string }> = [
  { status: "Em entrevista", descricao: "Levantamento do processo com o Peter" },
  { status: "Diagnosticado", descricao: "Diagnóstico AS IS validado" },
  { status: "Melhorias aprovadas", descricao: "Plano de melhoria aprovado" },
  { status: "Implementado", descricao: "Melhorias implantadas; documentação liberada" },
];

// Status usados antes deste ciclo; a migration 202610270001 converte os registros salvos.
const STATUS_ANTIGOS: Record<string, ProcessoStatus> = {
  Rascunho: "Em entrevista",
  "Em revisão": "Diagnosticado",
  Aprovado: "Implementado",
  Publicado: "Implementado",
};

export function normalizarStatus(status: string | null | undefined, fallback: ProcessoStatus = "Em entrevista"): ProcessoStatus {
  if (status && PROCESSO_STATUS.includes(status as ProcessoStatus)) return status as ProcessoStatus;
  return (status && STATUS_ANTIGOS[status]) || fallback;
}

function ordem(status: ProcessoStatus): number {
  return ETAPAS_CICLO.findIndex((etapa) => etapa.status === status);
}

// Avança para `alvo` sem nunca regredir; um processo obsoleto não muda.
export function promoverStatus(atual: ProcessoStatus, alvo: ProcessoStatus): ProcessoStatus {
  if (atual === "Obsoleto") return atual;
  return ordem(alvo) > ordem(atual) ? alvo : atual;
}

// A entrevista leva o processo até "Melhorias aprovadas": confirmar a Etapa 5
// (diagnóstico) e a Etapa 6 (plano) são os marcos.
export function statusPelaEntrevista(estado: EstadoRoteiro, atual: ProcessoStatus): ProcessoStatus {
  const alvo = estado.etapasConfirmadas.includes(6)
    ? "Melhorias aprovadas"
    : estado.etapasConfirmadas.includes(5)
      ? "Diagnosticado"
      : "Em entrevista";
  return promoverStatus(atual, alvo);
}

export function podeGerarDocumentacao(status: string | null | undefined): boolean {
  return normalizarStatus(status) === "Implementado";
}

export type AcaoCiclo = "implementar" | "reabrir_implantacao" | "tornar_obsoleto";

export const ACOES_CICLO: Record<AcaoCiclo, { rotulo: string; de: ProcessoStatus; para: ProcessoStatus; confirmacao: string }> = {
  implementar: {
    rotulo: "Marcar como implementado",
    de: "Melhorias aprovadas",
    para: "Implementado",
    confirmacao: "Confirma que as melhorias do plano foram implantadas? A partir daí o processo pode ter sua documentação gerada.",
  },
  reabrir_implantacao: {
    rotulo: "Voltar para melhorias aprovadas",
    de: "Implementado",
    para: "Melhorias aprovadas",
    confirmacao: "O processo volta para \"Melhorias aprovadas\" e deixa de aceitar nova documentação até ser marcado como implementado de novo. Continuar?",
  },
  tornar_obsoleto: {
    rotulo: "Tornar obsoleto",
    de: "Implementado",
    para: "Obsoleto",
    confirmacao: "O processo deixa de valer e não aceita nova documentação. Continuar?",
  },
};

export function acoesDisponiveis(status: string | null | undefined): AcaoCiclo[] {
  const atual = normalizarStatus(status);
  return (Object.keys(ACOES_CICLO) as AcaoCiclo[]).filter((acao) => ACOES_CICLO[acao].de === atual);
}

// Campos gravados junto com a mudança de status.
export function atualizacaoDaAcao(acao: AcaoCiclo, agora: string, mapaAprovadoEm: string | null) {
  const { para } = ACOES_CICLO[acao];
  if (para === "Implementado") return { status: para, implementado_em: agora, mapa_aprovado_em: mapaAprovadoEm ?? agora };
  if (para === "Obsoleto") return { status: para, obsolete_at: agora };
  return { status: para, implementado_em: null };
}

export const STATUS_CORES: Record<ProcessoStatus, string> = {
  "Em entrevista": "bg-muted text-muted-foreground",
  Diagnosticado: "bg-warning text-warning-foreground",
  "Melhorias aprovadas": "bg-primary text-primary-foreground",
  Implementado: "bg-success text-success-foreground",
  Obsoleto: "bg-secondary text-secondary-foreground",
};

// Entrevista ainda aberta: o plano de melhoria (Etapa 6) não foi aprovado.
export function entrevistaEmAberto(status: string | null | undefined): boolean {
  const atual = normalizarStatus(status);
  return atual === "Em entrevista" || atual === "Diagnosticado";
}
