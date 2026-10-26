// Análises que o Peter executa dentro da entrevista: o diagnóstico AS IS (Etapa 5)
// e o plano de melhoria (Etapa 6), nos critérios da metodologia v5.

import type { AcaoIA, Roteiro } from "./roteiro-entrevista.ts";
import { perguntaAplicavel, type EstadoRoteiro } from "./roteiro-engine.ts";

export const DESPERDICIOS_LEAN = [
  "Superprodução",
  "Espera",
  "Transporte",
  "Retrabalho",
  "Excesso de processamento",
  "Inventário",
  "Movimento",
  "Defeitos",
] as const;

export const NIVEIS_MATURIDADE = ["Inicial", "Estruturado", "Padronizado", "Monitorado", "Otimizado"] as const;

export type PrioridadeAchado = "critico" | "relevante" | "oportunidade";

export interface AchadoDiagnostico {
  prioridade: PrioridadeAchado;
  descricao: string;
  impacto: string;
  causaProvavel: string;
  fundamento: string;
}

export interface DiagnosticoRoteiro {
  resumo: string;
  pontosFortes: string[];
  achados: AchadoDiagnostico[];
  desperdiciosLean: Array<{ tipo: (typeof DESPERDICIOS_LEAN)[number]; evidencia: string }>;
  riscosIso: Array<{ risco: string; evidencia: string }>;
  maturidade: { nivel: (typeof NIVEIS_MATURIDADE)[number]; justificativa: string };
  lacunas: string[];
}

export interface MelhoriaProposta {
  titulo: string;
  problema: string;
  solucao: string;
  beneficio: string;
  prioridade: "Alta" | "Média" | "Baixa";
}

export interface AcaoPlano {
  oque: string;
  porque: string;
  quem: string;
  quando: string;
  onde: string;
  como: string;
  custo: string;
}

export interface PlanoMelhoriaRoteiro {
  resumoToBe: string;
  melhorias: MelhoriaProposta[];
  planoAcao: AcaoPlano[];
}

// ─── Schemas (modo strict) ──────────────────────────────────────────────────

function objeto(properties: Record<string, unknown>) {
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}

const texto = { type: "string" };
const listaDeTextos = { type: "array", items: texto };

export const SCHEMA_DIAGNOSTICO = objeto({
  resumo: texto,
  pontosFortes: listaDeTextos,
  achados: {
    type: "array",
    items: objeto({
      prioridade: { type: "string", enum: ["critico", "relevante", "oportunidade"] },
      descricao: texto,
      impacto: texto,
      causaProvavel: texto,
      fundamento: texto,
    }),
  },
  desperdiciosLean: {
    type: "array",
    items: objeto({ tipo: { type: "string", enum: [...DESPERDICIOS_LEAN] }, evidencia: texto }),
  },
  riscosIso: { type: "array", items: objeto({ risco: texto, evidencia: texto }) },
  maturidade: objeto({ nivel: { type: "string", enum: [...NIVEIS_MATURIDADE] }, justificativa: texto }),
  lacunas: listaDeTextos,
});

export const SCHEMA_PLANO = objeto({
  resumoToBe: texto,
  melhorias: {
    type: "array",
    items: objeto({
      titulo: texto,
      problema: texto,
      solucao: texto,
      beneficio: texto,
      prioridade: { type: "string", enum: ["Alta", "Média", "Baixa"] },
    }),
  },
  planoAcao: {
    type: "array",
    items: objeto({ oque: texto, porque: texto, quem: texto, quando: texto, onde: texto, como: texto, custo: texto }),
  },
});

export const SCHEMA_POR_ACAO: Record<AcaoIA, object> = {
  diagnostico_as_is: SCHEMA_DIAGNOSTICO,
  plano_melhoria: SCHEMA_PLANO,
};

// ─── Normalização (resposta da IA ou estado vindo do cliente) ───────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function lista<T>(value: unknown, mapear: (item: Record<string, unknown>) => T | null): T[] {
  return (Array.isArray(value) ? value : []).filter(isRecord).map(mapear).filter((item): item is T => item !== null);
}

function textos(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).map(str).filter(Boolean);
}

function umDe<T extends string>(valor: unknown, opcoes: readonly T[]): T | null {
  return opcoes.includes(valor as T) ? valor as T : null;
}

export function normalizarDiagnostico(raw: unknown): DiagnosticoRoteiro | null {
  if (!isRecord(raw)) return null;
  const maturidade = isRecord(raw.maturidade) ? raw.maturidade : {};
  const nivel = umDe(maturidade.nivel, NIVEIS_MATURIDADE);
  if (!str(raw.resumo) || !nivel) return null;
  return {
    resumo: str(raw.resumo),
    pontosFortes: textos(raw.pontosFortes),
    achados: lista(raw.achados, (item) => {
      const prioridade = umDe(item.prioridade, ["critico", "relevante", "oportunidade"] as const);
      return prioridade && str(item.descricao)
        ? { prioridade, descricao: str(item.descricao), impacto: str(item.impacto), causaProvavel: str(item.causaProvavel), fundamento: str(item.fundamento) }
        : null;
    }),
    desperdiciosLean: lista(raw.desperdiciosLean, (item) => {
      const tipo = umDe(item.tipo, DESPERDICIOS_LEAN);
      return tipo && str(item.evidencia) ? { tipo, evidencia: str(item.evidencia) } : null;
    }),
    riscosIso: lista(raw.riscosIso, (item) => (str(item.risco) ? { risco: str(item.risco), evidencia: str(item.evidencia) } : null)),
    maturidade: { nivel, justificativa: str(maturidade.justificativa) },
    lacunas: textos(raw.lacunas),
  };
}

export function normalizarPlano(raw: unknown): PlanoMelhoriaRoteiro | null {
  if (!isRecord(raw)) return null;
  const plano: PlanoMelhoriaRoteiro = {
    resumoToBe: str(raw.resumoToBe),
    melhorias: lista(raw.melhorias, (item) => {
      const prioridade = umDe(item.prioridade, ["Alta", "Média", "Baixa"] as const);
      return prioridade && str(item.titulo)
        ? { titulo: str(item.titulo), problema: str(item.problema), solucao: str(item.solucao), beneficio: str(item.beneficio), prioridade }
        : null;
    }),
    planoAcao: lista(raw.planoAcao, (item) => (str(item.oque)
      ? { oque: str(item.oque), porque: str(item.porque), quem: str(item.quem), quando: str(item.quando), onde: str(item.onde), como: str(item.como), custo: str(item.custo) }
      : null)),
  };
  return plano.resumoToBe || plano.melhorias.length > 0 ? plano : null;
}

export function normalizarAnalises(raw: unknown): Partial<Record<AcaoIA, unknown>> {
  if (!isRecord(raw)) return {};
  const analises: Partial<Record<AcaoIA, unknown>> = {};
  const diagnostico = normalizarDiagnostico(raw.diagnostico_as_is);
  const plano = normalizarPlano(raw.plano_melhoria);
  if (diagnostico) analises.diagnostico_as_is = diagnostico;
  if (plano) analises.plano_melhoria = plano;
  return analises;
}

// Campos do formulário do processo alimentados pelo plano aprovado.
export function camposDoPlano(plano: PlanoMelhoriaRoteiro) {
  return {
    oportunidadesMelhoria: plano.melhorias.map((melhoria) => `• ${melhoria.titulo} (${melhoria.prioridade}): ${melhoria.solucao}`).join("\n"),
    planoAcao: plano.planoAcao,
  };
}

// ─── Instruções das análises ────────────────────────────────────────────────

export function respostasColetadas(roteiro: Roteiro, estado: EstadoRoteiro): string {
  return roteiro.etapas
    .map((etapa) => {
      const linhas = etapa.perguntas
        .filter((pergunta) => perguntaAplicavel(pergunta, estado))
        .map((pergunta) => {
          const resposta = estado.respostas[pergunta.id];
          if (!resposta || resposta.status === "lacuna" || resposta.textos.length === 0) return `- ${pergunta.rotulo}: [NÃO INFORMADO]`;
          return `- ${pergunta.rotulo}: ${resposta.textos.join("; ")}`;
        });
      return linhas.length > 0 ? `Etapa ${etapa.numero} — ${etapa.titulo}\n${linhas.join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function blocoObservacoes(estado: EstadoRoteiro, numeroEtapa: number, versaoAnterior: unknown): string {
  const observacoes = estado.observacoes[numeroEtapa] ?? [];
  if (observacoes.length === 0) return "";
  return `

## AJUSTES PEDIDOS PELO ENTREVISTADO
Ele revisou a versão anterior e pediu os ajustes abaixo. Incorpore-os: o entrevistado conhece o processo.
${observacoes.map((item) => `- ${item}`).join("\n")}

Versão anterior: ${JSON.stringify(versaoAnterior ?? null)}`;
}

export function instrucoesDiagnostico(roteiro: Roteiro, estado: EstadoRoteiro): string {
  return `## SUA TAREFA AGORA — ETAPA 5: DIAGNÓSTICO AS IS
Diagnostique o processo atual com base em Lean, BPM e ISO 9001, usando SOMENTE as informações coletadas abaixo. O resultado será apresentado ao entrevistado para validação.

## INFORMAÇÕES COLETADAS
${respostasColetadas(roteiro, estado)}

## CRITÉRIOS
Desperdícios Lean (registre só os que têm evidência nas respostas):
- Superprodução: documentos ou atividades além do necessário
- Espera: atividades bloqueadas por aprovação ou informação sem prazo
- Transporte: movimentação desnecessária de documentos ou dados entre áreas
- Retrabalho: atividades que corrigem erros de etapas anteriores
- Excesso de processamento: aprovações, controles ou verificações além do necessário
- Inventário: acúmulo de tarefas ou documentos pendentes
- Movimento: troca excessiva de sistemas, ferramentas ou canais
- Defeitos: saídas fora do padrão esperado pelo cliente do processo

Riscos ISO 9001: atividades sem responsável ou evidência de execução; ausência de critério de aceitação da saída; documentos sem controle de versão; ausência de contingência para processo crítico; indicadores sem meta ou sem responsável pela medição.

Oportunidades: atividades automatizáveis com ferramentas já disponíveis; etapas elimináveis sem impacto na saída; aprovações delegáveis ou substituíveis por critérios objetivos; integrações que reduziriam retrabalho.

Maturidade: Inicial (informal, dependente de pessoas-chave); Estruturado (documentado, com inconsistências); Padronizado (estável e seguido); Monitorado (medido por indicadores); Otimizado (melhoria contínua).

## COMO RESPONDER (JSON)
- "resumo": 2 a 4 frases sobre o estado atual do processo.
- "pontosFortes": o que está bem estruturado e deve ser mantido.
- "achados": cada problema ou oportunidade, com "prioridade" (critico, relevante ou oportunidade), "descricao", "impacto", "causaProvavel" e "fundamento" (o critério Lean, ISO 9001 ou BPM que sustenta o achado). Ordene do mais crítico ao menos crítico.
- "desperdiciosLean" e "riscosIso": cada item com a evidência tirada das respostas.
- "maturidade": o nível e a justificativa com base nas respostas.
- "lacunas": informações [NÃO INFORMADO] que limitam o diagnóstico.
Nunca apresente como fato algo que não foi informado. Se uma conclusão depende de suposição, deixe isso explícito no texto do achado.${blocoObservacoes(estado, 5, estado.analises.diagnostico_as_is)}`;
}

export function instrucoesPlano(roteiro: Roteiro, estado: EstadoRoteiro): string {
  return `## SUA TAREFA AGORA — ETAPA 6: REDESENHO E PLANO DE MELHORIA
Proponha o processo otimizado (TO BE) e o plano de ação 5W2H. O entrevistado vai aprovar ou ajustar a proposta.

## INFORMAÇÕES COLETADAS
${respostasColetadas(roteiro, estado)}

## DIAGNÓSTICO VALIDADO PELO ENTREVISTADO
${JSON.stringify(estado.analises.diagnostico_as_is ?? null)}

## COMO RESPONDER (JSON)
- "resumoToBe": como o processo deve funcionar depois das melhorias, em poucas frases.
- "melhorias": priorize as oportunidades que o entrevistado indicou como prioritárias; cada melhoria resolve achados do diagnóstico. "prioridade": Alta, Média ou Baixa.
- "planoAcao": uma ou mais ações 5W2H por melhoria. "quem" é um cargo ou área, nunca um nome inventado (use o responsável pelas mudanças informado quando couber). "quando" respeita o prazo de implantação informado. "custo" é uma estimativa qualitativa (Baixo, Médio ou Alto) se o entrevistado não informou valores.
- Respeite as restrições informadas (orçamento, prazo, pessoas, tecnologia).
- Use "processo otimizado", nunca "processo perfeito".${blocoObservacoes(estado, 6, estado.analises.plano_melhoria)}`;
}

export const INSTRUCOES_POR_ACAO: Record<AcaoIA, (roteiro: Roteiro, estado: EstadoRoteiro) => string> = {
  diagnostico_as_is: instrucoesDiagnostico,
  plano_melhoria: instrucoesPlano,
};
