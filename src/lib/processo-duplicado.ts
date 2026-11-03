import { supabase } from "@/integrations/supabase/client";
import { normalizarStatus, type ProcessoStatus } from "@/lib/ciclo-processo";
import type { EstadoRoteiro } from "../../supabase/functions/_shared/roteiro-engine";
import { mensagemDoErro } from "../../supabase/functions/_shared/authorization-core";

// Mesma tabela de public.chave_nome_processo (migration 202611030001): app e banco precisam
// chegar à mesma chave para "Pós vendas", "POS-VENDAS" e "pos  vendas" serem o mesmo processo.
const COM_ACENTO = "ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ";
const SEM_ACENTO = "AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn";

export function chaveDoNome(nome: string | null | undefined): string {
  return Array.from(nome ?? "", (letra) => {
    const indice = COM_ACENTO.indexOf(letra);
    return indice >= 0 ? SEM_ACENTO[indice] : letra;
  })
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export interface ProcessoExistente {
  id: string;
  nome: string;
  status: ProcessoStatus;
  criadoEm: string;
}

export class ProcessoDuplicado extends Error {
  constructor(readonly existente: ProcessoExistente) {
    super(`Já existe um processo chamado "${existente.nome}".`);
    this.name = "ProcessoDuplicado";
  }
}

// Processo da empresa com o mesmo nome (fora o próprio e os obsoletos), ou null.
export async function buscarProcessoComMesmoNome(
  companyId: string,
  nome: string,
  ignorarId: string | null,
): Promise<ProcessoExistente | null> {
  const chave = chaveDoNome(nome);
  if (!chave) return null;
  const { data, error } = await supabase
    .from("processos")
    .select("id, nome, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const igual = (data ?? []).find((row) =>
    row.id !== ignorarId && normalizarStatus(row.status) !== "Obsoleto" && chaveDoNome(row.nome) === chave);
  return igual ? { id: igual.id, nome: igual.nome, status: normalizarStatus(igual.status), criadoEm: igual.created_at } : null;
}

export function violouNomeUnico(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505"
    && String((error as { message?: unknown }).message ?? "").includes("processos_nome_unico"));
}

export function mensagemDoErroDoProcesso(error: unknown, padrao: string): string {
  if (violouNomeUnico(error)) return "Já existe um processo com esse nome nesta empresa. Use outro nome ou abra o processo existente.";
  const causa = mensagemDoErro(error);
  return causa === "Erro desconhecido" ? padrao : causa;
}

// Troca o nome também na resposta da entrevista, que alimenta o relatório.
export function renomearNaEntrevista(estado: EstadoRoteiro, nome: string): EstadoRoteiro {
  const anterior = estado.respostas["e1.nome"];
  return {
    ...estado,
    respostas: {
      ...estado.respostas,
      "e1.nome": { perguntaId: "e1.nome", textos: [nome], status: "respondida", origem: anterior?.origem ?? "entrevista" },
    },
  };
}
