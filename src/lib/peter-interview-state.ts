import type { ProcessoFormData } from "@/data/processo-form-types";
import type { InterviewResponse, ModoEntrada } from "../../supabase/functions/_shared/peter-interview-contract";

export const CAMPOS_POR_ETAPA: Record<number, (keyof ProcessoFormData)[]> = {
  1: ["nomeProcesso", "area", "donoProcesso", "classificacao", "entrevistados", "objetivo", "clienteProcesso", "areasEnvolvidas"],
  2: ["gatilho", "entradas", "saidas"],
  3: ["etapas", "decisoes", "recursos"],
  4: ["indicadores"],
  5: ["problemas", "problemasTexto", "riscos", "riscosTexto"],
  6: ["oportunidadesMelhoria", "planoAcao"],
};

export function combinarModo(atual: ModoEntrada, novaFonte: "texto_livre" | "anexo"): ModoEntrada {
  if (atual === "nenhum") return novaFonte;
  if (atual === novaFonte) return novaFonte;
  return "misto";
}

export function interpretarSelecaoModo(input: string): { modo: ModoEntrada; conteudo: string } | null {
  const normalized = input.trim().toLowerCase();
  if (["1", "entrevista", "guiada", "perguntas"].includes(normalized)) return { modo: "entrevista", conteudo: "" };
  if (["2", "texto", "colar", "descrição", "descricao"].includes(normalized)) return { modo: "texto_livre", conteudo: "" };
  if (["3", "arquivo", "anexo", "pdf", "word", "excel", "imagem"].includes(normalized)) return { modo: "anexo", conteudo: "" };
  if (input.trim().length > 80) return { modo: "texto_livre", conteudo: input.trim() };
  return null;
}

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const SEM_ATUALIZACAO = Object.freeze({}) as Partial<ProcessoFormData>;
const hasArrayData = (value: unknown) => Array.isArray(value) && value.some((item) =>
  item && typeof item === "object" && Object.values(item as Record<string, unknown>).some(hasText));
const parseList = (text: string) => text.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
const parsePairs = (text: string) => parseList(text).map((line) => {
  const [first, second] = line.split(/[-–—;:]/).map((item) => item.trim());
  return [first || line, second || ""] as const;
});

export function extrairCamposPorEtapa(
  answer: string,
  etapa: number,
  dadosAtuais: Partial<ProcessoFormData>,
): Partial<ProcessoFormData> {
  const text = answer.trim();
  if (!text) return SEM_ATUALIZACAO;

  if (etapa === 1) {
    if (!hasText(dadosAtuais.objetivo)) return { objetivo: text };
    if (!hasText(dadosAtuais.area)) return { area: text };
    if (!hasText(dadosAtuais.donoProcesso)) return { donoProcesso: text };
    if (!hasText(dadosAtuais.clienteProcesso)) return { clienteProcesso: text };
    if (!hasText(dadosAtuais.areasEnvolvidas)) return { areasEnvolvidas: text };
    return SEM_ATUALIZACAO;
  }
  if (etapa === 2) {
    if (!hasText(dadosAtuais.gatilho)) return { gatilho: text };
    if (!hasArrayData(dadosAtuais.entradas)) {
      return { entradas: parsePairs(text).map(([fornecedor, entrada]) => ({ fornecedor, entrada })) };
    }
    if (!hasArrayData(dadosAtuais.saidas)) {
      return { saidas: parsePairs(text).map(([saida, cliente]) => ({ saida, cliente })) };
    }
    return SEM_ATUALIZACAO;
  }
  if (etapa === 3) {
    if (!hasArrayData(dadosAtuais.etapas)) {
      return { etapas: parsePairs(text).map(([atividade, responsavel], index) => ({ ordem: index + 1, atividade, responsavel, ferramentaDocumento: "" })) };
    }
    if (!hasText(dadosAtuais.decisoes)) return { decisoes: text };
    if (!hasText(dadosAtuais.recursos)) return { recursos: parseList(text).join("\n") };
    return SEM_ATUALIZACAO;
  }
  if (etapa === 4 && !hasArrayData(dadosAtuais.indicadores)) {
    return { indicadores: parsePairs(text).map(([nome, meta]) => ({ nome, objetivo: "Acompanhar o desempenho do processo", formulaCalculo: "", meta, periodicidade: "", responsavel: dadosAtuais.donoProcesso || "" })) };
  }
  if (etapa === 5) {
    if (!hasText(dadosAtuais.problemasTexto)) return { problemasTexto: text };
    if (!hasText(dadosAtuais.riscosTexto)) return { riscosTexto: text };
    return SEM_ATUALIZACAO;
  }
  if (etapa === 6) {
    if (!hasText(dadosAtuais.oportunidadesMelhoria)) return { oportunidadesMelhoria: text };
    if (!hasArrayData(dadosAtuais.planoAcao)) {
      return { planoAcao: parseList(text).map((oque) => ({ oque, porque: "", quem: "", quando: "", onde: "", como: "", custo: "" })) };
    }
  }
  return SEM_ATUALIZACAO;
}

export function calcularTransicao(resposta: InterviewResponse, etapaAtual: number, aguardandoConfirmacao: boolean) {
  const confirmouAgora = resposta.etapa_confirmada === true && aguardandoConfirmacao;
  return {
    confirmouAgora,
    podeConcluir: resposta.done === true && etapaAtual === 6 && confirmouAgora,
    deveAguardar: resposta.avancar_etapa === true && !aguardandoConfirmacao,
  };
}
