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
  // Cadeia dos "5 porquês" até a causa raiz; vazia em diagnósticos antigos.
  porques: string[];
  fundamento: string;
}

export interface RiscoDiagnostico {
  risco: string;
  evidencia: string;
  consequencia: string;
  // Escala 1 a 5; null em diagnósticos gerados antes da avaliação de riscos.
  probabilidade: number | null;
  impacto: number | null;
}

export interface DiagnosticoRoteiro {
  resumo: string;
  pontosFortes: string[];
  achados: AchadoDiagnostico[];
  desperdiciosLean: Array<{ tipo: (typeof DESPERDICIOS_LEAN)[number]; evidencia: string }>;
  riscosIso: RiscoDiagnostico[];
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

// Indicador sugerido pelo Peter para acompanhar o processo otimizado; vira indicador no
// módulo Indicadores quando o entrevistado aprova o plano.
export interface IndicadorSugerido {
  nome: string;
  formula: string;
  sentido: "maior" | "menor";
  meta: string;
  periodicidade: string;
  responsavel: string;
  motivo: string;
}

export interface PlanoMelhoriaRoteiro {
  resumoToBe: string;
  melhorias: MelhoriaProposta[];
  planoAcao: AcaoPlano[];
  indicadores: IndicadorSugerido[];
}

// ─── Schemas (modo strict) ──────────────────────────────────────────────────

function objeto(properties: Record<string, unknown>) {
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}

const texto = { type: "string" };
const listaDeTextos = { type: "array", items: texto };
const nivel15 = { type: "integer", enum: [1, 2, 3, 4, 5] };

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
      porques: listaDeTextos,
      fundamento: texto,
    }),
  },
  desperdiciosLean: {
    type: "array",
    items: objeto({ tipo: { type: "string", enum: [...DESPERDICIOS_LEAN] }, evidencia: texto }),
  },
  riscosIso: {
    type: "array",
    items: objeto({ risco: texto, evidencia: texto, consequencia: texto, probabilidade: nivel15, impacto: nivel15 }),
  },
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
  indicadores: {
    type: "array",
    items: objeto({
      nome: texto,
      formula: texto,
      sentido: { type: "string", enum: ["maior", "menor"] },
      meta: texto,
      periodicidade: { type: "string", enum: ["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual"] },
      responsavel: texto,
      motivo: texto,
    }),
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

function notaDe1a5(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
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
        ? {
          prioridade,
          descricao: str(item.descricao),
          impacto: str(item.impacto),
          causaProvavel: str(item.causaProvavel),
          porques: textos(item.porques),
          fundamento: str(item.fundamento),
        }
        : null;
    }),
    desperdiciosLean: lista(raw.desperdiciosLean, (item) => {
      const tipo = umDe(item.tipo, DESPERDICIOS_LEAN);
      return tipo && str(item.evidencia) ? { tipo, evidencia: str(item.evidencia) } : null;
    }),
    riscosIso: lista(raw.riscosIso, (item) => (str(item.risco)
      ? {
        risco: str(item.risco),
        evidencia: str(item.evidencia),
        consequencia: str(item.consequencia),
        probabilidade: notaDe1a5(item.probabilidade),
        impacto: notaDe1a5(item.impacto),
      }
      : null)),
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
    // Planos gerados antes dos indicadores sugeridos chegam sem a lista.
    indicadores: lista(raw.indicadores, (item) => (str(item.nome)
      ? {
        nome: str(item.nome),
        formula: str(item.formula),
        sentido: umDe(item.sentido, ["maior", "menor"] as const) ?? "maior",
        meta: str(item.meta) || "[a definir]",
        periodicidade: str(item.periodicidade) || "Mensal",
        responsavel: str(item.responsavel) || "[a definir]",
        motivo: str(item.motivo),
      }
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
    ...(plano.indicadores.length > 0
      ? {
        indicadores: plano.indicadores.map((indicador) => ({
          nome: indicador.nome,
          objetivo: indicador.motivo,
          formulaCalculo: indicador.formula,
          meta: indicador.meta,
          periodicidade: indicador.periodicidade,
          responsavel: indicador.responsavel,
        })),
      }
      : {}),
  };
}

// Riscos avaliados no diagnóstico viram a matriz de riscos do formulário (que define a criticidade).
export function camposDoDiagnostico(diagnostico: DiagnosticoRoteiro) {
  const avaliados = diagnostico.riscosIso.filter((item) => item.probabilidade && item.impacto);
  if (avaliados.length === 0) return {};
  return {
    riscos: avaliados.map((item) => ({
      risco: item.risco,
      consequencia: item.consequencia || item.evidencia,
      probabilidade: item.probabilidade,
      impacto: item.impacto,
    })),
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

Riscos (ISO 9001, 6.1): considere também o que o entrevistado disse sobre falhas, erros e atrasos. Atividades sem responsável ou evidência de execução; ausência de critério de aceitação da saída; documentos sem controle de versão; ausência de contingência para processo crítico; indicadores sem meta ou sem responsável pela medição.

Oportunidades: atividades automatizáveis com ferramentas já disponíveis; etapas elimináveis sem impacto na saída; aprovações delegáveis ou substituíveis por critérios objetivos; integrações que reduziriam retrabalho.

Maturidade: Inicial (informal, dependente de pessoas-chave); Estruturado (documentado, com inconsistências); Padronizado (estável e seguido); Monitorado (medido por indicadores); Otimizado (melhoria contínua).

## COMO RESPONDER (JSON)
- "resumo": 2 a 4 frases sobre o estado atual do processo.
- "pontosFortes": o que está bem estruturado e deve ser mantido.
- "achados": cada problema ou oportunidade, com "prioridade" (critico, relevante ou oportunidade), "descricao", "impacto", "porques", "causaProvavel" e "fundamento" (o critério Lean, ISO 9001 ou BPM que sustenta o achado). Ordene do mais crítico ao menos crítico.
  - "porques": para problemas (critico e relevante), a cadeia dos 5 porquês, de 3 a 5 passos, cada um respondendo o anterior ("Por que X? Porque Y."). Use as respostas; quando um passo for suposição, termine-o com "(hipótese)". Para oportunidades, pode ficar vazio.
  - "causaProvavel": a causa raiz, o último passo dos porquês. Nunca repita a solução como causa (ex.: "falta de dupla conferência" não é causa raiz).
- "desperdiciosLean": cada item com a evidência tirada das respostas.
- "riscosIso": de 2 a 5 riscos do processo, cada um com "risco", "evidencia", "consequencia" (o que acontece com o cliente, o prazo ou o custo) e notas de 1 a 5:
  - "probabilidade": 1 rara, 2 improvável, 3 possível (acontece às vezes), 4 provável (acontece com frequência), 5 quase certa (acontece sempre). Erro relatado como frequente é no mínimo 4.
  - "impacto": 1 desprezível, 2 baixo (corrigido internamente), 3 moderado (atrasa ou gera retrabalho), 4 alto (chega ao cliente ou gera custo), 5 crítico (perda de cliente, multa ou parada).
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
- "planoAcao": uma ou mais ações 5W2H por melhoria.
  - "quem": um cargo, não uma equipe. Use o responsável pelas mudanças informado na entrevista ou o cargo que executa aquela parte do processo no passo a passo (ex.: "Auxiliar de Almoxarifado", não "Equipe de Almoxarifado"). Se nenhum cargo couber, escreva "[a definir]". Nunca crie um cargo que não apareceu na entrevista (por exemplo, "Gestor de TI").
  - "quando": derivado do prazo de implantação informado. Sem prazo informado, sugira pelo nível de prioridade da melhoria: Alta → "Sugestão: em até 30 dias", Média → "Sugestão: em até 60 dias", Baixa → "Sugestão: em até 90 dias".
  - "custo": o valor informado; sem valor informado, uma estimativa qualitativa precedida de "Estimativa:" (Baixo, Médio ou Alto).
- "indicadores": sempre de 2 a 4 indicadores para acompanhar se o processo otimizado funciona (ISO 9001, 9.1). Se o entrevistado citou indicadores, comece por eles, com os dados que ele deu. Complete com indicadores tirados das informações coletadas: a saída principal entregue no prazo, o prazo ou SLA, os erros e o retrabalho, as reclamações, o volume, e o que as melhorias pretendem mudar.
  - "nome": curto e mensurável (ex.: "Pedidos entregues no prazo").
  - "formula": como calcular com os dados que o processo já gera (ex.: "pedidos entregues no prazo ÷ pedidos entregues × 100").
  - "sentido": "maior" quando quanto maior, melhor; "menor" quando quanto menor, melhor.
  - "meta": só com número informado na entrevista (ex.: SLA de 2 dias informado → "≤ 2 dias"). Sem número informado, escreva "[a definir]". Nunca invente uma meta.
  - "periodicidade": Mensal, salvo se a frequência do processo indicar outra.
  - "responsavel": mesma regra de "quem" do plano de ação.
  - "motivo": o achado ou a melhoria que o indicador acompanha.
- Respeite as restrições informadas (orçamento, prazo, pessoas, tecnologia).
- Use "processo otimizado", nunca "processo perfeito".${blocoObservacoes(estado, 6, estado.analises.plano_melhoria)}`;
}

export const INSTRUCOES_POR_ACAO: Record<AcaoIA, (roteiro: Roteiro, estado: EstadoRoteiro) => string> = {
  diagnostico_as_is: instrucoesDiagnostico,
  plano_melhoria: instrucoesPlano,
};
