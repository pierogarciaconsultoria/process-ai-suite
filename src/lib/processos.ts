import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type {
  DiagnosticoResult,
  EntradaForm,
  EtapaForm,
  IndicadorForm,
  PlanoAcao5W2H,
  ProcessoFormData,
  RiscoForm,
  SaidaForm,
} from "@/data/processo-form-types";
import { emptyProcessoForm } from "@/data/processo-form-types";

export const PROCESSO_STATUS = [
  "Rascunho",
  "Em revisão",
  "Aprovado",
  "Publicado",
  "Obsoleto",
] as const;

export type ProcessoStatus = (typeof PROCESSO_STATUS)[number];
export type ProcessoCriticidade = "Baixa" | "Média" | "Alta" | "Crítica";
export type ProcessoRow = Tables<"processos">;

export interface ProcessoListItem {
  id: string;
  nome: string;
  area: string;
  responsavel: string;
  status: ProcessoStatus;
  criticidade: ProcessoCriticidade;
  data_criacao: string;
  mapa_revisao: string;
  mapa_aprovado_em: string | null;
}

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function parseJsonArray<T>(value: Json | null | undefined, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function parseJsonObject<T extends object>(value: Json | null | undefined, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : fallback;
}

export function deriveCriticidade(riscos: RiscoForm[]): ProcessoCriticidade {
  const maxScore = riscos.reduce((highest, risco) => Math.max(highest, risco.impacto * risco.probabilidade), 0);
  if (maxScore >= 16) return "Crítica";
  if (maxScore >= 10) return "Alta";
  if (maxScore >= 5) return "Média";
  return "Baixa";
}

export function mapProcessRowToForm(row: ProcessoRow): ProcessoFormData {
  return {
    ...emptyProcessoForm,
    data: row.data_mapeamento,
    analista: row.analista,
    nomeProcesso: row.nome,
    classificacao: row.classificacao as ProcessoFormData["classificacao"],
    area: row.area,
    donoProcesso: row.responsavel,
    entrevistados: row.entrevistados,
    objetivo: row.objetivo,
    clienteProcesso: row.cliente_processo,
    areasEnvolvidas: row.areas_envolvidas,
    gatilho: row.gatilho,
    entradas: parseJsonArray<EntradaForm>(row.entradas, emptyProcessoForm.entradas),
    etapas: parseJsonArray<EtapaForm>(row.etapas, emptyProcessoForm.etapas),
    decisoes: row.decisoes,
    saidas: parseJsonArray<SaidaForm>(row.saidas, emptyProcessoForm.saidas),
    recursos: row.recursos,
    problemas: parseJsonObject(row.problemas, emptyProcessoForm.problemas),
    problemasTexto: row.problemas_texto,
    riscosTexto: row.riscos_texto,
    riscos: parseJsonArray<RiscoForm>(row.riscos, emptyProcessoForm.riscos),
    indicadores: parseJsonArray<IndicadorForm>(row.indicadores, emptyProcessoForm.indicadores),
    oportunidadesMelhoria: row.oportunidades_melhoria,
    planoAcao: parseJsonArray<PlanoAcao5W2H>(row.plano_acao, emptyProcessoForm.planoAcao),
    bpmnAsIs: row.bpmn_as_is,
    bpmnToBe: row.bpmn_to_be,
  };
}

export function mapProcessRowToListItem(row: ProcessoRow): ProcessoListItem {
  return {
    id: row.id,
    nome: row.nome,
    area: row.area,
    responsavel: row.responsavel,
    status: row.status as ProcessoStatus,
    criticidade: (row.criticidade as ProcessoCriticidade) || "Baixa",
    data_criacao: row.created_at,
    mapa_revisao: row.mapa_revisao,
    mapa_aprovado_em: row.mapa_aprovado_em,
  };
}

export function buildProcessInsertPayload(args: {
  form: ProcessoFormData;
  companyId: string;
  userId: string;
  status?: ProcessoStatus;
  interviewMessages?: ChatMessage[];
  interviewSessionId?: string | null;
  diagnostico?: DiagnosticoResult | null;
  currentRevision?: string;
  currentApprovedAt?: string | null;
}): TablesInsert<"processos"> {
  const {
    form,
    companyId,
    userId,
    status = "Rascunho",
    interviewMessages = [],
    interviewSessionId = null,
    diagnostico = null,
    currentRevision = "Rev.00",
    currentApprovedAt = null,
  } = args;

  return {
    company_id: companyId,
    data_mapeamento: form.data,
    analista: form.analista,
    nome: form.nomeProcesso,
    classificacao: form.classificacao,
    area: form.area,
    responsavel: form.donoProcesso,
    entrevistados: form.entrevistados,
    objetivo: form.objetivo,
    cliente_processo: form.clienteProcesso,
    areas_envolvidas: form.areasEnvolvidas,
    gatilho: form.gatilho,
    entradas: form.entradas as unknown as Json,
    etapas: form.etapas as unknown as Json,
    decisoes: form.decisoes,
    saidas: form.saidas as unknown as Json,
    recursos: form.recursos,
    problemas: form.problemas as unknown as Json,
    problemas_texto: form.problemasTexto,
    riscos_texto: form.riscosTexto,
    riscos: form.riscos as unknown as Json,
    indicadores: form.indicadores as unknown as Json,
    oportunidades_melhoria: form.oportunidadesMelhoria,
    plano_acao: form.planoAcao as unknown as Json,
    bpmn_as_is: form.bpmnAsIs,
    bpmn_to_be: form.bpmnToBe,
    diagnostico: diagnostico as unknown as Json,
    interview_messages: interviewMessages as unknown as Json,
    interview_session_id: interviewSessionId,
    status,
    criticidade: deriveCriticidade(form.riscos),
    mapa_revisao: currentRevision,
    mapa_aprovado_em: currentApprovedAt,
    created_by: userId,
    updated_by: userId,
  };
}

export function buildProcessUpdatePayload(args: {
  form: ProcessoFormData;
  userId: string;
  status?: ProcessoStatus;
  interviewMessages?: ChatMessage[];
  interviewSessionId?: string | null;
  diagnostico?: DiagnosticoResult | null;
  currentRevision?: string;
  currentApprovedAt?: string | null;
}): TablesUpdate<"processos"> {
  const insertPayload = buildProcessInsertPayload({
    ...args,
    companyId: "00000000-0000-0000-0000-000000000000",
  });
  const { company_id: _companyId, created_by: _createdBy, ...updatePayload } = insertPayload;
  return updatePayload;
}

export function normalizeSavedStatus(currentStatus: string | null | undefined, fallback: ProcessoStatus = "Rascunho"): ProcessoStatus {
  if (currentStatus && PROCESSO_STATUS.includes(currentStatus as ProcessoStatus)) {
    return currentStatus as ProcessoStatus;
  }
  return fallback;
}
