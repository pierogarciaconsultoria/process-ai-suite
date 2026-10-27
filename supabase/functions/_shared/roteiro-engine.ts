import type { AcaoIA, EtapaRoteiro, PerguntaRoteiro, Roteiro } from "./roteiro-entrevista.ts";

// Máximo de pedidos de complemento por pergunta antes de registrá-la como lacuna.
export const MAX_APROFUNDAMENTOS = 2;

export type OrigemResposta = "entrevista" | "texto_livre" | "anexo";

export interface RespostaRegistrada {
  perguntaId: string;
  textos: string[];
  valor?: string;
  status: "respondida" | "lacuna";
  origem: OrigemResposta;
  repeticaoEncerrada?: boolean;
}

export interface EstadoRoteiro {
  versaoRoteiro: string;
  etapaAtual: number;
  respostas: Record<string, RespostaRegistrada>;
  aprofundamentos: Record<string, number>;
  acoesConcluidas: AcaoIA[];
  etapasConfirmadas: number[];
  // Ajustes pedidos pelo entrevistado ao revisar uma análise da IA, por etapa.
  observacoes: Record<number, string[]>;
  // Resultado de cada análise da IA; o formato é definido em roteiro-analise.ts.
  analises: Partial<Record<AcaoIA, unknown>>;
}

export type PassoRoteiro =
  | { tipo: "pergunta"; etapa: EtapaRoteiro; pergunta: PerguntaRoteiro; texto: string; iteracao: number; aprofundamentos: number }
  | { tipo: "acao_ia"; etapa: EtapaRoteiro; acao: AcaoIA }
  | { tipo: "confirmar_etapa"; etapa: EtapaRoteiro; texto: string }
  | { tipo: "concluido" };

export interface EntradaResposta {
  perguntaId: string;
  texto: string;
  suficiente: boolean;
  valor?: string;
  encerraRepeticao?: boolean;
}

export interface ProgressoRoteiro {
  etapa: number;
  totalEtapas: number;
  titulo: string;
  rotulo: string;
  perguntasRespondidas: number;
  perguntasAplicaveis: number;
}

export function iniciarRoteiro(roteiro: Roteiro): EstadoRoteiro {
  return {
    versaoRoteiro: roteiro.versao,
    etapaAtual: 1,
    respostas: {},
    aprofundamentos: {},
    acoesConcluidas: [],
    etapasConfirmadas: [],
    observacoes: {},
    analises: {},
  };
}

function normalizarValor(valor: string | undefined): string | undefined {
  const limpo = valor?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return limpo || undefined;
}

export function perguntaAplicavel(pergunta: PerguntaRoteiro, estado: EstadoRoteiro): boolean {
  if (!pergunta.condicao) return true;
  const base = estado.respostas[pergunta.condicao.perguntaId];
  if (!base || base.status !== "respondida") return false;
  return base.valor === normalizarValor(pergunta.condicao.valor);
}

function buscarEtapa(roteiro: Roteiro, numero: number): EtapaRoteiro | undefined {
  return roteiro.etapas.find((etapa) => etapa.numero === numero);
}

function buscarPergunta(roteiro: Roteiro, perguntaId: string): PerguntaRoteiro | undefined {
  for (const etapa of roteiro.etapas) {
    const pergunta = etapa.perguntas.find((item) => item.id === perguntaId);
    if (pergunta) return pergunta;
  }
  return undefined;
}

function repeticaoPendente(pergunta: PerguntaRoteiro, resposta: RespostaRegistrada): boolean {
  return Boolean(pergunta.repetir) && resposta.status === "respondida" && !resposta.repeticaoEncerrada;
}

export function proximoPasso(roteiro: Roteiro, estado: EstadoRoteiro): PassoRoteiro {
  const etapa = buscarEtapa(roteiro, estado.etapaAtual);
  if (!etapa) return { tipo: "concluido" };

  for (const pergunta of etapa.perguntas) {
    if (!perguntaAplicavel(pergunta, estado)) continue;
    const resposta = estado.respostas[pergunta.id];
    const aprofundamentos = estado.aprofundamentos[pergunta.id] ?? 0;
    if (!resposta) {
      return { tipo: "pergunta", etapa, pergunta, texto: pergunta.texto, iteracao: 0, aprofundamentos };
    }
    if (repeticaoPendente(pergunta, resposta)) {
      return {
        tipo: "pergunta",
        etapa,
        pergunta,
        texto: pergunta.repetir!.textoProxima,
        iteracao: resposta.textos.length,
        aprofundamentos,
      };
    }
  }

  if (etapa.acaoIA && !estado.acoesConcluidas.includes(etapa.acaoIA)) {
    return { tipo: "acao_ia", etapa, acao: etapa.acaoIA };
  }

  return { tipo: "confirmar_etapa", etapa, texto: etapa.textoConfirmacao };
}

export function registrarResposta(roteiro: Roteiro, estado: EstadoRoteiro, entrada: EntradaResposta): EstadoRoteiro {
  const passo = proximoPasso(roteiro, estado);
  if (passo.tipo !== "pergunta" || passo.pergunta.id !== entrada.perguntaId) {
    throw new Error(`A pergunta ${entrada.perguntaId} não é a pergunta atual do roteiro.`);
  }

  const pergunta = passo.pergunta;
  const anterior = estado.respostas[pergunta.id];
  const texto = entrada.texto.trim();

  if (!entrada.suficiente) {
    const aprofundamentos = (estado.aprofundamentos[pergunta.id] ?? 0) + 1;
    if (aprofundamentos < MAX_APROFUNDAMENTOS) {
      return { ...estado, aprofundamentos: { ...estado.aprofundamentos, [pergunta.id]: aprofundamentos } };
    }
    const registrada: RespostaRegistrada = anterior
      ? { ...anterior, repeticaoEncerrada: true }
      : { perguntaId: pergunta.id, textos: texto ? [texto] : [], status: "lacuna", origem: "entrevista" };
    return {
      ...estado,
      respostas: { ...estado.respostas, [pergunta.id]: registrada },
      aprofundamentos: { ...estado.aprofundamentos, [pergunta.id]: 0 },
    };
  }

  const textos = [...(anterior?.textos ?? []), ...(texto ? [texto] : [])];
  const limite = pergunta.repetir?.maxIteracoes ?? 1;
  const registrada: RespostaRegistrada = {
    perguntaId: pergunta.id,
    textos,
    valor: normalizarValor(entrada.valor) ?? anterior?.valor,
    status: textos.length > 0 ? "respondida" : "lacuna",
    origem: anterior?.origem ?? "entrevista",
    ...(pergunta.repetir ? { repeticaoEncerrada: entrada.encerraRepeticao === true || textos.length >= limite } : {}),
  };

  return {
    ...estado,
    respostas: { ...estado.respostas, [pergunta.id]: registrada },
    aprofundamentos: { ...estado.aprofundamentos, [pergunta.id]: 0 },
  };
}

// Perguntas repetidas (atividades) chegam de texto livre ou correção como uma linha por item.
function textosDaResposta(pergunta: PerguntaRoteiro, texto: string): string[] {
  if (!pergunta.repetir) return [texto];
  return texto.split("\n").map((linha) => linha.trim()).filter(Boolean).slice(0, pergunta.repetir.maxIteracoes);
}

// Correção pedida pelo entrevistado ao revisar o resumo da etapa em andamento.
export function corrigirResposta(
  roteiro: Roteiro,
  estado: EstadoRoteiro,
  correcao: { perguntaId: string; texto: string; valor?: string },
): EstadoRoteiro {
  const etapa = buscarEtapa(roteiro, estado.etapaAtual);
  const pergunta = etapa?.perguntas.find((item) => item.id === correcao.perguntaId);
  const texto = correcao.texto.trim();
  if (!pergunta || !texto) return estado;
  const anterior = estado.respostas[pergunta.id];
  return {
    ...estado,
    respostas: {
      ...estado.respostas,
      [pergunta.id]: {
        perguntaId: pergunta.id,
        textos: textosDaResposta(pergunta, texto),
        valor: normalizarValor(correcao.valor) ?? anterior?.valor,
        status: "respondida",
        origem: anterior?.origem ?? "entrevista",
        ...(pergunta.repetir ? { repeticaoEncerrada: true } : {}),
      },
    },
  };
}

// Respostas extraídas de texto livre ou anexo: preenchem perguntas ainda não respondidas,
// para que a entrevista pergunte só o que faltou.
export function aplicarRespostasExtraidas(
  roteiro: Roteiro,
  estado: EstadoRoteiro,
  extraidas: Array<{ perguntaId: string; texto: string; valor?: string }>,
  origem: Exclude<OrigemResposta, "entrevista">,
): EstadoRoteiro {
  const respostas = { ...estado.respostas };
  for (const item of extraidas) {
    const texto = item.texto.trim();
    const pergunta = buscarPergunta(roteiro, item.perguntaId);
    if (!texto || respostas[item.perguntaId] || !pergunta) continue;
    respostas[item.perguntaId] = {
      perguntaId: item.perguntaId,
      textos: textosDaResposta(pergunta, texto),
      valor: normalizarValor(item.valor),
      status: "respondida",
      origem,
      repeticaoEncerrada: true,
    };
  }
  return { ...estado, respostas };
}

export function concluirAcao(roteiro: Roteiro, estado: EstadoRoteiro, acao: AcaoIA, resultado?: unknown): EstadoRoteiro {
  const passo = proximoPasso(roteiro, estado);
  if (passo.tipo !== "acao_ia" || passo.acao !== acao) {
    throw new Error(`A ação ${acao} não é o passo atual do roteiro.`);
  }
  return {
    ...estado,
    acoesConcluidas: [...estado.acoesConcluidas, acao],
    ...(resultado !== undefined ? { analises: { ...estado.analises, [acao]: resultado } } : {}),
  };
}

// O entrevistado pediu ajustes no diagnóstico ou no plano: a análise volta a ser o
// passo atual e será refeita considerando a observação.
export function reabrirAnalise(roteiro: Roteiro, estado: EstadoRoteiro, observacao: string): EstadoRoteiro {
  const passo = proximoPasso(roteiro, estado);
  const acao = passo.tipo === "confirmar_etapa" ? passo.etapa.acaoIA : undefined;
  if (!acao) throw new Error(`A etapa ${estado.etapaAtual} não tem análise para refazer.`);
  const numero = estado.etapaAtual;
  const texto = observacao.trim();
  return {
    ...estado,
    acoesConcluidas: estado.acoesConcluidas.filter((item) => item !== acao),
    observacoes: texto ? { ...estado.observacoes, [numero]: [...(estado.observacoes[numero] ?? []), texto] } : estado.observacoes,
  };
}

export function confirmarEtapa(roteiro: Roteiro, estado: EstadoRoteiro): EstadoRoteiro {
  const passo = proximoPasso(roteiro, estado);
  if (passo.tipo !== "confirmar_etapa") {
    throw new Error(`A etapa ${estado.etapaAtual} ainda não está pronta para confirmação.`);
  }
  return {
    ...estado,
    etapaAtual: estado.etapaAtual + 1,
    etapasConfirmadas: [...estado.etapasConfirmadas, passo.etapa.numero],
  };
}

export function etapasConfirmadasAte(estado: EstadoRoteiro, numero: number): boolean {
  for (let etapa = 1; etapa <= numero; etapa++) {
    if (!estado.etapasConfirmadas.includes(etapa)) return false;
  }
  return true;
}

export function progresso(roteiro: Roteiro, estado: EstadoRoteiro): ProgressoRoteiro {
  const totalEtapas = roteiro.etapas.length;
  const etapa = buscarEtapa(roteiro, estado.etapaAtual);
  if (!etapa) {
    return { etapa: totalEtapas, totalEtapas, titulo: "Concluída", rotulo: "Entrevista concluída", perguntasRespondidas: 0, perguntasAplicaveis: 0 };
  }
  const aplicaveis = etapa.perguntas.filter((pergunta) => perguntaAplicavel(pergunta, estado));
  const respondidas = aplicaveis.filter((pergunta) => {
    const resposta = estado.respostas[pergunta.id];
    return resposta && !repeticaoPendente(pergunta, resposta);
  });
  return {
    etapa: etapa.numero,
    totalEtapas,
    titulo: etapa.titulo,
    rotulo: `Etapa ${etapa.numero} de ${totalEtapas} — ${etapa.titulo}`,
    perguntasRespondidas: respondidas.length,
    perguntasAplicaveis: aplicaveis.length,
  };
}

export function listarLacunas(roteiro: Roteiro, estado: EstadoRoteiro): PerguntaRoteiro[] {
  return roteiro.etapas
    .filter((etapa) => estado.etapasConfirmadas.includes(etapa.numero))
    .flatMap((etapa) => etapa.perguntas)
    .filter((pergunta) => pergunta.obrigatoria && estado.respostas[pergunta.id]?.status === "lacuna");
}
