// Contrato entre a entrevista guiada e o Peter: o motor do roteiro decide qual é
// a pergunta; o Peter avalia a resposta, extrai os campos e, se faltar algo,
// formula o aprofundamento. Sem Deno APIs, para ser testável no vitest.

import { HttpError } from "./authorization-core.ts";
import type { AcaoIA, CampoFormulario, EtapaRoteiro, PerguntaRoteiro, Roteiro } from "./roteiro-entrevista.ts";
import {
  INSTRUCOES_POR_ACAO,
  SCHEMA_POR_ACAO,
  camposDoPlano,
  normalizarAnalises,
  normalizarDiagnostico,
  normalizarPlano,
} from "./roteiro-analise.ts";
import {
  MAX_APROFUNDAMENTOS,
  aplicarRespostasExtraidas,
  concluirAcao,
  confirmarEtapa,
  corrigirResposta,
  perguntaAplicavel,
  reabrirAnalise,
  progresso,
  proximoPasso,
  registrarResposta,
  repeticaoPendente,
  type EstadoRoteiro,
  type OrigemResposta,
  type ProgressoRoteiro,
  type RespostaRegistrada,
} from "./roteiro-engine.ts";

export const MAX_HISTORICO = 12;
const MAX_TEXTO_RESPOSTA = 4_000;

export type CamposExtraidos = Partial<Record<CampoFormulario, unknown>>;

export interface PassoCliente {
  tipo: "pergunta" | "acao_ia" | "confirmar_etapa" | "concluido";
  etapa: { numero: number; titulo: string } | null;
  pergunta?: { id: string; rotulo: string; texto: string; ajuda?: string; tipo: PerguntaRoteiro["tipo"]; opcoes?: string[] };
  acao?: AcaoIA;
  progresso: ProgressoRoteiro;
}

export interface ResultadoTurno {
  estado: EstadoRoteiro;
  passo: PassoCliente;
  mensagem: string;
  campos: CamposExtraidos;
  alerta: string | null;
  oportunidade: string | null;
  // Análise produzida neste turno; o conteúdo fica em estado.analises.
  analise?: AcaoIA;
}

// ─── Estado vindo do cliente ─────────────────────────────────────────────────

function todasPerguntas(roteiro: Roteiro): PerguntaRoteiro[] {
  return roteiro.etapas.flatMap((etapa) => etapa.perguntas);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function etapasEmAberto(roteiro: Roteiro, estado: EstadoRoteiro): EtapaRoteiro[] {
  return roteiro.etapas.filter((etapa) => etapa.numero >= estado.etapaAtual);
}

// Perguntas da etapa em andamento e das seguintes que ainda podem receber resposta:
// o que um texto, um anexo ou uma resposta mais completa pode adiantar.
export function perguntasEmAberto(roteiro: Roteiro, estado: EstadoRoteiro, exceto?: string): PerguntaRoteiro[] {
  return etapasEmAberto(roteiro, estado)
    .flatMap((etapa) => etapa.perguntas)
    .filter((pergunta) => {
      if (pergunta.id === exceto) return false;
      const resposta = estado.respostas[pergunta.id];
      return !resposta || repeticaoPendente(pergunta, resposta);
    });
}

export function sanitizarEstado(roteiro: Roteiro, raw: unknown): EstadoRoteiro {
  if (!isRecord(raw)) throw new HttpError(400, "Estado da entrevista ausente ou inválido.");
  if (raw.versaoRoteiro !== roteiro.versao) throw new HttpError(409, "A entrevista foi iniciada com outra versão do roteiro.");

  const totalEtapas = roteiro.etapas.length;
  const etapaAtual = typeof raw.etapaAtual === "number" && Number.isInteger(raw.etapaAtual) ? raw.etapaAtual : NaN;
  if (!(etapaAtual >= 1 && etapaAtual <= totalEtapas + 1)) throw new HttpError(400, "Etapa da entrevista inválida.");

  const ids = new Set(todasPerguntas(roteiro).map((pergunta) => pergunta.id));
  const respostas: Record<string, RespostaRegistrada> = {};
  for (const [id, valor] of Object.entries(isRecord(raw.respostas) ? raw.respostas : {})) {
    if (!ids.has(id) || !isRecord(valor) || !Array.isArray(valor.textos)) continue;
    const textos = valor.textos.filter((texto): texto is string => typeof texto === "string").slice(0, 30).map((texto) => texto.slice(0, MAX_TEXTO_RESPOSTA));
    const status = valor.status === "lacuna" ? "lacuna" : "respondida";
    const origem: OrigemResposta = valor.origem === "texto_livre" || valor.origem === "anexo" ? valor.origem : "entrevista";
    respostas[id] = {
      perguntaId: id,
      textos,
      ...(typeof valor.valor === "string" ? { valor: valor.valor } : {}),
      status,
      origem,
      ...(typeof valor.repeticaoEncerrada === "boolean" ? { repeticaoEncerrada: valor.repeticaoEncerrada } : {}),
    };
  }

  const aprofundamentos: Record<string, number> = {};
  for (const [id, valor] of Object.entries(isRecord(raw.aprofundamentos) ? raw.aprofundamentos : {})) {
    if (ids.has(id) && typeof valor === "number" && Number.isInteger(valor)) {
      aprofundamentos[id] = Math.min(Math.max(valor, 0), MAX_APROFUNDAMENTOS);
    }
  }

  const acoesValidas = new Set(roteiro.etapas.map((etapa) => etapa.acaoIA).filter(Boolean));
  const acoesConcluidas = (Array.isArray(raw.acoesConcluidas) ? raw.acoesConcluidas : [])
    .filter((acao, indice, lista): acao is AcaoIA => acoesValidas.has(acao as AcaoIA) && lista.indexOf(acao) === indice);

  const observacoes: Record<number, string[]> = {};
  for (const [numero, valor] of Object.entries(isRecord(raw.observacoes) ? raw.observacoes : {})) {
    const etapa = Number(numero);
    if (!roteiro.etapas.some((item) => item.numero === etapa && item.acaoIA) || !Array.isArray(valor)) continue;
    observacoes[etapa] = valor.filter((item): item is string => typeof item === "string").slice(-10).map((item) => item.slice(0, MAX_TEXTO_RESPOSTA));
  }

  return {
    versaoRoteiro: roteiro.versao,
    etapaAtual,
    respostas,
    aprofundamentos,
    acoesConcluidas,
    etapasConfirmadas: Array.from({ length: etapaAtual - 1 }, (_, indice) => indice + 1),
    observacoes,
    analises: normalizarAnalises(raw.analises),
  };
}

// ─── Passo para o cliente ────────────────────────────────────────────────────

export function descreverPasso(roteiro: Roteiro, estado: EstadoRoteiro): PassoCliente {
  const passo = proximoPasso(roteiro, estado);
  const base = { progresso: progresso(roteiro, estado) };
  if (passo.tipo === "concluido") return { tipo: "concluido", etapa: null, ...base };

  const etapa = { numero: passo.etapa.numero, titulo: passo.etapa.titulo };
  if (passo.tipo === "acao_ia") return { tipo: "acao_ia", etapa, acao: passo.acao, ...base };
  if (passo.tipo === "confirmar_etapa") return { tipo: "confirmar_etapa", etapa, ...base };

  const { pergunta } = passo;
  return {
    tipo: "pergunta",
    etapa,
    pergunta: {
      id: pergunta.id,
      rotulo: pergunta.rotulo,
      texto: passo.texto,
      ...(pergunta.ajuda && passo.iteracao === 0 ? { ajuda: pergunta.ajuda } : {}),
      tipo: pergunta.tipo,
      ...(pergunta.opcoes ? { opcoes: pergunta.opcoes } : {}),
    },
    ...base,
  };
}

export function resumoEtapa(roteiro: Roteiro, estado: EstadoRoteiro, numero: number): string {
  const etapa = roteiro.etapas.find((item) => item.numero === numero);
  if (!etapa) return "";
  return etapa.perguntas
    .filter((pergunta) => perguntaAplicavel(pergunta, estado))
    .map((pergunta) => {
      const resposta = estado.respostas[pergunta.id];
      if (!resposta || resposta.status === "lacuna" || resposta.textos.length === 0) return `❓ **${pergunta.rotulo}:** não informado`;
      return `✅ **${pergunta.rotulo}:** ${resposta.textos.join("; ")}`;
    })
    .join("\n");
}

const TEXTO_ACAO: Record<AcaoIA, string> = {
  diagnostico_as_is: "Com o que você me contou, vou montar o diagnóstico do processo. Isso leva alguns segundos.",
  plano_melhoria: "Vou montar o plano de melhoria com base nas suas prioridades. Isso leva alguns segundos.",
};

export function textoDoPasso(roteiro: Roteiro, estado: EstadoRoteiro, passo: PassoCliente, etapaAnterior: number): string {
  switch (passo.tipo) {
    case "pergunta": {
      const novaEtapa = Boolean(passo.etapa) && passo.etapa!.numero !== etapaAnterior;
      const abertura = novaEtapa ? `**${passo.progresso.rotulo}**\n\n` : "";
      // Atividades adiantadas em etapas anteriores: mostra o que já foi anotado antes de pedir a próxima.
      const anotadas = novaEtapa ? estado.respostas[passo.pergunta!.id]?.textos ?? [] : [];
      const jaAnotado = anotadas.length > 0 ? `Até aqui anotei:\n${anotadas.map((texto, indice) => `${indice + 1}. ${texto}`).join("\n")}\n\n` : "";
      return `${abertura}${jaAnotado}${passo.pergunta!.texto}`;
    }
    case "acao_ia":
      return TEXTO_ACAO[passo.acao!];
    case "confirmar_etapa": {
      const etapa = roteiro.etapas.find((item) => item.numero === passo.etapa!.numero)!;
      // Nas etapas com análise, o que se confirma é a análise, exibida à parte.
      return etapa.acaoIA ? etapa.textoConfirmacao : `${resumoEtapa(roteiro, estado, etapa.numero)}\n\n${etapa.textoConfirmacao}`;
    }
    case "concluido":
      return "Entrevista concluída! Obrigado pelo seu tempo. Já tenho tudo para gerar o relatório e o mapa do processo.";
  }
}

// ─── Schemas (modo strict: todo objeto fecha additionalProperties) ──────────

const textoOuNulo = { type: ["string", "null"] };

function listaOuNula(propriedades: Record<string, unknown>) {
  return {
    type: ["array", "null"],
    items: { type: "object", additionalProperties: false, properties: propriedades, required: Object.keys(propriedades) },
  };
}

const textoObrigatorio = { type: "string" };

const SCHEMA_POR_CAMPO: Record<CampoFormulario, unknown> = {
  entrevistados: textoOuNulo,
  nomeProcesso: textoOuNulo,
  area: textoOuNulo,
  donoProcesso: textoOuNulo,
  objetivo: textoOuNulo,
  classificacao: { anyOf: [{ type: "string", enum: ["Negócio", "Apoio", "Gestão"] }, { type: "null" }] },
  clienteProcesso: textoOuNulo,
  areasEnvolvidas: textoOuNulo,
  gatilho: textoOuNulo,
  entradas: listaOuNula({ fornecedor: textoObrigatorio, entrada: textoObrigatorio }),
  etapas: listaOuNula({ atividade: textoObrigatorio, responsavel: textoObrigatorio, ferramentaDocumento: textoObrigatorio }),
  decisoes: textoOuNulo,
  saidas: listaOuNula({ saida: textoObrigatorio, cliente: textoObrigatorio }),
  recursos: textoOuNulo,
  problemas: {
    anyOf: [
      {
        type: "object",
        additionalProperties: false,
        properties: {
          retrabalho: { type: "boolean" },
          atrasos: { type: "boolean" },
          erros: { type: "boolean" },
          dependencia: { type: "boolean" },
          faltaPadrao: { type: "boolean" },
        },
        required: ["retrabalho", "atrasos", "erros", "dependencia", "faltaPadrao"],
      },
      { type: "null" },
    ],
  },
  problemasTexto: textoOuNulo,
  riscosTexto: textoOuNulo,
  indicadores: listaOuNula({
    nome: textoObrigatorio,
    objetivo: textoObrigatorio,
    formulaCalculo: textoObrigatorio,
    meta: textoObrigatorio,
    periodicidade: textoObrigatorio,
    responsavel: textoObrigatorio,
  }),
  oportunidadesMelhoria: textoOuNulo,
  planoAcao: listaOuNula({
    oque: textoObrigatorio,
    porque: textoObrigatorio,
    quem: textoObrigatorio,
    quando: textoObrigatorio,
    onde: textoObrigatorio,
    como: textoObrigatorio,
    custo: textoObrigatorio,
  }),
};

function camposUnicos(campos: CampoFormulario[]): CampoFormulario[] {
  return Array.from(new Set(campos));
}

export function camposDaEtapa(etapa: EtapaRoteiro): CampoFormulario[] {
  return camposUnicos(etapa.perguntas.flatMap((pergunta) => pergunta.campos));
}

function camposDoRoteiro(roteiro: Roteiro): CampoFormulario[] {
  return camposUnicos(todasPerguntas(roteiro).flatMap((pergunta) => pergunta.campos));
}

// Campos que ainda podem mudar: os de etapas já confirmadas não são reabertos.
function camposEmAberto(roteiro: Roteiro, estado: EstadoRoteiro): CampoFormulario[] {
  return camposUnicos(etapasEmAberto(roteiro, estado).flatMap(camposDaEtapa));
}

function camposDaAvaliacao(pergunta: PerguntaRoteiro, adiantaveis: PerguntaRoteiro[]): CampoFormulario[] {
  return camposUnicos([...pergunta.campos, ...adiantaveis.flatMap((item) => item.campos)]);
}

export function schemaCampos(campos: CampoFormulario[]) {
  const unicos = camposUnicos(campos);
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(unicos.map((campo) => [campo, SCHEMA_POR_CAMPO[campo]])),
    required: unicos,
  };
}

const alertaOportunidade = { alerta: textoOuNulo, oportunidade: textoOuNulo };

function schemaValor(pergunta: PerguntaRoteiro) {
  const opcoes = pergunta.tipo === "sim_nao" ? ["sim", "nao"] : pergunta.tipo === "opcao" ? pergunta.opcoes ?? [] : [];
  return opcoes.length > 0 ? { anyOf: [{ type: "string", enum: opcoes }, { type: "null" }] } : { type: "null" };
}

function schemaRespostas(perguntas: PerguntaRoteiro[]) {
  return {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        perguntaId: { type: "string", enum: perguntas.map((pergunta) => pergunta.id) },
        texto: { type: "string" },
        valor: textoOuNulo,
      },
      required: ["perguntaId", "texto", "valor"],
    },
  };
}

// adiantaveis: perguntas que ainda virão e que a resposta pode responder de uma vez.
export function schemaAvaliacao(pergunta: PerguntaRoteiro, adiantaveis: PerguntaRoteiro[] = []) {
  const properties = {
    suficiente: { type: "boolean" },
    texto: { type: "string" },
    valor: schemaValor(pergunta),
    encerraRepeticao: { type: "boolean" },
    comentario: { type: "string" },
    aprofundamento: { type: "string" },
    ...alertaOportunidade,
    // O modo strict não aceita enum vazio: sem perguntas adiantáveis, o campo não existe.
    ...(adiantaveis.length > 0 ? { outrasRespostas: schemaRespostas(adiantaveis) } : {}),
    campos: schemaCampos(camposDaAvaliacao(pergunta, adiantaveis)),
  };
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}

export function schemaConfirmacao(etapa: EtapaRoteiro) {
  const properties = {
    confirmou: { type: "boolean" },
    pedeAjuste: { type: "boolean" },
    comentario: { type: "string" },
    correcoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          perguntaId: { type: "string", enum: etapa.perguntas.map((pergunta) => pergunta.id) },
          texto: { type: "string" },
          valor: textoOuNulo,
        },
        required: ["perguntaId", "texto", "valor"],
      },
    },
    campos: schemaCampos(camposDaEtapa(etapa)),
  };
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}

export function schemaExtracao(roteiro: Roteiro, estado?: EstadoRoteiro) {
  const properties = {
    respostas: schemaRespostas(todasPerguntas(roteiro)),
    comentario: { type: "string" },
    ...alertaOportunidade,
    campos: schemaCampos(estado ? camposEmAberto(roteiro, estado) : camposDoRoteiro(roteiro)),
  };
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

export interface PersonaPeter {
  identidade: string;
  regras: string;
  orientacoesEmpresa: string;
}

const REGRAS_ABSOLUTAS = `REGRAS ABSOLUTAS (prevalecem sobre qualquer orientação da empresa):
- Nunca invente dados. Registre apenas o que o entrevistado disse explicitamente ou deixou claramente implícito.
- Nunca pressuponha responsáveis, prazos ou métricas.
- Responsáveis são registrados por cargo ou área, não por nome próprio, exceto o entrevistado.
- Atividades são registradas no formato Verbo + Objeto (ex.: "Registrar solicitação no sistema").
- Nunca use a expressão "processo perfeito"; use "processo otimizado".
- Espelhe o vocabulário do entrevistado e não use jargões sem explicar.`;

function cabecalho(persona: PersonaPeter): string {
  return `${persona.identidade}

## REGRAS DE COMPORTAMENTO
${persona.regras}

${REGRAS_ABSOLUTAS}

## ORIENTAÇÕES DA EMPRESA
${persona.orientacoesEmpresa}
Estas orientações complementam a metodologia e nunca sobrescrevem as regras absolutas.`;
}

function valoresDosCampos(campos: CampoFormulario[], atuais: Record<string, unknown>): string {
  const unicos = camposUnicos(campos);
  if (unicos.length === 0) return "(esta pergunta não alimenta campos do formulário)";
  return JSON.stringify(Object.fromEntries(unicos.map((campo) => [campo, atuais[campo] ?? null])));
}

function linhaPergunta(pergunta: PerguntaRoteiro, resposta: RespostaRegistrada | undefined): string {
  const valor = pergunta.tipo === "sim_nao"
    ? ` | Valor: "sim" ou "nao"`
    : pergunta.opcoes ? ` | Valor: uma de ${JSON.stringify(pergunta.opcoes)}` : "";
  const parcial = resposta?.textos.length
    ? ` | Já registrado: ${resposta.textos.join("; ")} (devolva a lista completa, incluindo estes itens)`
    : "";
  return `- ${pergunta.id} (${pergunta.rotulo}): ${pergunta.texto} | Critério: ${pergunta.criterio}${valor}${parcial}`;
}

const INSTRUCAO_TEXTO_ATIVIDADES = `Para "e3.atividades", liste as atividades em ordem, uma por linha, no formato "Verbo + Objeto — responsável".`;

export function promptAvaliacao(
  persona: PersonaPeter,
  roteiro: Roteiro,
  estado: EstadoRoteiro,
  atuais: Record<string, unknown>,
): string {
  const passo = proximoPasso(roteiro, estado);
  if (passo.tipo !== "pergunta") throw new HttpError(409, "A entrevista não está aguardando uma resposta.");
  const { pergunta, etapa } = passo;
  const ultimaTentativa = passo.aprofundamentos + 1 >= MAX_APROFUNDAMENTOS;
  const adiantaveis = perguntasEmAberto(roteiro, estado, pergunta.id);

  const secaoAdiantadas = adiantaveis.length > 0
    ? `

## INFORMAÇÕES ADIANTADAS
O entrevistado pode contar mais do que a pergunta pediu, por exemplo descrevendo a rotina inteira. Se a resposta também responder, de forma suficiente segundo o critério, alguma destas perguntas que ainda virão no roteiro, registre-a em "outrasRespostas" para que ela não seja repetida. Registre só o que ele disse explicitamente; na dúvida, deixe para a pergunta própria.
${adiantaveis.map((item) => linhaPergunta(item, estado.respostas[item.id])).join("\n")}`
    : "";
  const instrucaoAdiantadas = adiantaveis.length > 0
    ? `\n- "outrasRespostas": uma entrada por pergunta de INFORMAÇÕES ADIANTADAS que a resposta já responde, com "perguntaId", "texto" (registro fiel e conciso) e "valor" (conforme indicado na pergunta; null nas demais). ${INSTRUCAO_TEXTO_ATIVIDADES} Lista vazia se a resposta não adianta nada.`
    : "";

  const instrucaoValor = pergunta.tipo === "sim_nao"
    ? `"valor": "sim" ou "nao", conforme a resposta.`
    : pergunta.tipo === "opcao"
      ? `"valor": exatamente uma das opções ${JSON.stringify(pergunta.opcoes)}; null se a resposta não permitir escolher.`
      : `"valor": sempre null.`;

  const instrucaoRepeticao = pergunta.repetir
    ? `Esta pergunta se repete para cada atividade do fluxo (atividade nº ${passo.iteracao + 1}). "encerraRepeticao" = true quando o entrevistado indicar que o processo terminou; se ele também descrever uma última atividade, registre-a em "texto".`
    : `"encerraRepeticao": sempre false.`;

  return `${cabecalho(persona)}

## SUA TAREFA AGORA
Você está na ${progresso(roteiro, estado).rotulo}. Objetivo da etapa: ${etapa.objetivo}
O sistema conduz o roteiro; você avalia UMA resposta para UMA pergunta. Não faça perguntas de outros temas do roteiro: elas virão depois.

Pergunta feita: "${passo.texto}"
Critério de resposta suficiente: ${pergunta.criterio}
Pergunta ${pergunta.obrigatoria ? "obrigatória" : "opcional"}.${pergunta.obrigatoria ? "" : ` Se o entrevistado disser que não há ou não se aplica, a resposta é suficiente.`}${secaoAdiantadas}

## COMO RESPONDER (JSON)
- "suficiente": true se a resposta atende ao critério. Respostas curtas mas honestas e aproveitáveis são suficientes.
- "texto": registro fiel e conciso do que o entrevistado respondeu a esta pergunta, sem acrescentar nada.
- ${instrucaoValor}
- ${instrucaoRepeticao}
- "comentario": uma frase curta reconhecendo a resposta, sem pergunta. Se registrou outras respostas, diga em poucas palavras o que já ficou anotado. Pode ser vazio.
- "aprofundamento": se "suficiente" = false, UMA pergunta curta e específica pedindo exatamente o que falta, com um exemplo quando ajudar.${ultimaTentativa ? " Esta é a última tentativa: depois dela o sistema registra a lacuna e segue." : ""} Se "suficiente" = true, vazio.
- "alerta": um risco ou inconsistência claramente sustentado pela resposta (ex.: atividade sem responsável, aprovação sem substituto), fundamentado em BPM, Lean ou ISO 9001; senão null.
- "oportunidade": uma oportunidade de melhoria claramente sustentada pela resposta; senão null.${instrucaoAdiantadas}
- "campos": o valor COMPLETO e atualizado de cada campo listado, partindo do valor atual e incorporando a resposta. Use null para não alterar um campo.

Valores atuais dos campos: ${valoresDosCampos(camposDaAvaliacao(pergunta, adiantaveis), atuais)}`;
}

export function promptConfirmacao(
  persona: PersonaPeter,
  roteiro: Roteiro,
  estado: EstadoRoteiro,
  atuais: Record<string, unknown>,
): string {
  const passo = proximoPasso(roteiro, estado);
  if (passo.tipo !== "confirmar_etapa") throw new HttpError(409, "A entrevista não está aguardando confirmação.");
  const { etapa } = passo;
  const apresentado = etapa.acaoIA
    ? `Análise apresentada (gerada por você a partir das respostas):\n${JSON.stringify(estado.analises[etapa.acaoIA] ?? null)}`
    : `Resumo apresentado:\n${resumoEtapa(roteiro, estado, etapa.numero)}`;

  return `${cabecalho(persona)}

## SUA TAREFA AGORA
O entrevistado acabou de ver o fechamento da ${progresso(roteiro, estado).rotulo} e respondeu à pergunta: "${etapa.textoConfirmacao}"

${apresentado}

Perguntas desta etapa (para as correções):
${etapa.perguntas.map((pergunta) => `- ${pergunta.id} (${pergunta.rotulo})`).join("\n")}

## COMO RESPONDER (JSON)
- "confirmou": true somente se o entrevistado aprovou sem pedir mudanças.
- "pedeAjuste": true se o entrevistado pediu para corrigir, retirar ou acrescentar algo${etapa.acaoIA ? " na análise" : ""}. False se apenas aprovou ou fez uma pergunta.
- "comentario": se confirmou, uma frase curta de transição; se pediu ajustes, diga em uma frase o que será ajustado; se fez uma pergunta, responda-a brevemente.
- "correcoes": para cada item que o entrevistado corrigiu ou completou, o id da pergunta e o novo "texto" completo daquela resposta (para e3.atividades, a lista inteira, uma atividade por linha). "valor": "sim"/"nao" se a correção muda uma resposta de sim/não; senão null. Lista vazia se não houve correção.
- "campos": se houve correção, o valor COMPLETO e atualizado dos campos afetados; null nos demais.

Valores atuais dos campos: ${valoresDosCampos(camposDaEtapa(etapa), atuais)}`;
}

export function promptExtracao(
  persona: PersonaPeter,
  roteiro: Roteiro,
  estado: EstadoRoteiro,
  atuais: Record<string, unknown> = {},
): string {
  const pendentes = perguntasEmAberto(roteiro, estado)
    .map((pergunta) => linhaPergunta(pergunta, estado.respostas[pergunta.id]))
    .join("\n");

  return `${cabecalho(persona)}

## SUA TAREFA AGORA
O entrevistado enviou um texto ou arquivo descrevendo o processo. Extraia dele as respostas para as perguntas do roteiro que ainda não foram respondidas. A entrevista vai perguntar só o que ficar faltando.
Imagens (fluxogramas, fotos de quadros, prints de sistemas ou de formulários) também são material: leia o conteúdo visual, inclusive setas, caixas e textos escritos nelas.

Perguntas ainda não respondidas:
${pendentes}

## COMO RESPONDER (JSON)
- "respostas": uma entrada por pergunta que o material responde de forma suficiente, segundo o critério. Não inclua perguntas que o material não responde.
  - "texto": registro fiel e conciso da resposta encontrada. ${INSTRUCAO_TEXTO_ATIVIDADES}
  - "valor": conforme indicado na pergunta; nas demais, null.
- "comentario": uma ou duas frases dizendo o que foi identificado no material.
- "alerta" e "oportunidade": apenas se claramente sustentados pelo material; senão null.
- "campos": o valor COMPLETO e atualizado de cada campo listado, partindo do valor atual e incorporando o que o material informa. Listas são substituídas, então mantenha os itens atuais que continuam válidos. Use null para não alterar um campo.

Valores atuais dos campos: ${valoresDosCampos(camposEmAberto(roteiro, estado), atuais)}`;
}

// ─── Aplicação dos resultados do Peter ──────────────────────────────────────

const CAMPOS_LISTA = new Set<CampoFormulario>(["entradas", "saidas", "indicadores", "planoAcao"]);

function textoLimpo(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textoOuNull(value: unknown): string | null {
  const texto = textoLimpo(value);
  return texto ? texto : null;
}

export function filtrarCampos(raw: unknown, permitidos: CampoFormulario[]): CamposExtraidos {
  if (!isRecord(raw)) return {};
  const campos: CamposExtraidos = {};
  for (const campo of permitidos) {
    const valor = raw[campo];
    if (valor === null || valor === undefined) continue;
    if (campo === "classificacao") {
      if (valor === "Negócio" || valor === "Apoio" || valor === "Gestão") campos.classificacao = valor;
    } else if (campo === "problemas") {
      if (isRecord(valor)) campos.problemas = valor;
    } else if (campo === "etapas") {
      if (Array.isArray(valor)) {
        campos.etapas = valor.filter(isRecord).map((etapa, indice) => ({ ...etapa, ordem: indice + 1 }));
      }
    } else if (CAMPOS_LISTA.has(campo)) {
      if (Array.isArray(valor)) campos[campo] = valor.filter(isRecord);
    } else if (typeof valor === "string" && valor.trim()) {
      campos[campo] = valor.trim();
    }
  }
  return campos;
}

function juntar(...partes: Array<string | null | undefined>): string {
  return partes.map((parte) => parte?.trim()).filter(Boolean).join("\n\n");
}

function lerRespostas(raw: unknown): Array<{ perguntaId: string; texto: string; valor?: string }> {
  return (Array.isArray(raw) ? raw : [])
    .filter(isRecord)
    .map((item) => ({
      perguntaId: textoLimpo(item.perguntaId),
      texto: textoLimpo(item.texto).slice(0, MAX_TEXTO_RESPOSTA),
      valor: textoOuNull(item.valor) ?? undefined,
    }));
}

export function aplicarAvaliacao(roteiro: Roteiro, estado: EstadoRoteiro, raw: unknown): ResultadoTurno {
  const passoAtual = proximoPasso(roteiro, estado);
  if (passoAtual.tipo !== "pergunta") throw new HttpError(409, "A entrevista não está aguardando uma resposta.");
  const r = isRecord(raw) ? raw : {};
  const pergunta = passoAtual.pergunta;
  const adiantaveis = perguntasEmAberto(roteiro, estado, pergunta.id);
  const adiantadas = lerRespostas(r.outrasRespostas)
    .filter((item) => item.texto && adiantaveis.some((adiantavel) => adiantavel.id === item.perguntaId));
  // Campos de outras perguntas só mudam quando o Peter registrou aquela pergunta como adiantada.
  const perguntasAdiantadas = adiantaveis.filter((item) => adiantadas.some((adiantada) => adiantada.perguntaId === item.id));

  const registrado = registrarResposta(roteiro, estado, {
    perguntaId: pergunta.id,
    texto: textoLimpo(r.texto).slice(0, MAX_TEXTO_RESPOSTA),
    suficiente: r.suficiente === true,
    valor: textoOuNull(r.valor) ?? undefined,
    encerraRepeticao: r.encerraRepeticao === true,
  });
  // O que o entrevistado adiantou não é perguntado de novo. As atividades seguem
  // abertas, para a entrevista confirmar se há uma próxima quando chegar a vez delas.
  const novoEstado = aplicarRespostasExtraidas(roteiro, registrado, adiantadas, "entrevista", { encerrarRepeticao: false });

  const passo = descreverPasso(roteiro, novoEstado);
  const mesmaPergunta = passo.tipo === "pergunta" && passo.pergunta?.id === pergunta.id && r.suficiente !== true;
  const mensagem = mesmaPergunta
    ? juntar(textoLimpo(r.comentario), textoLimpo(r.aprofundamento) || passoAtual.texto)
    : juntar(textoLimpo(r.comentario), textoDoPasso(roteiro, novoEstado, passo, estado.etapaAtual));

  return {
    estado: novoEstado,
    passo,
    mensagem,
    campos: filtrarCampos(r.campos, camposDaAvaliacao(pergunta, perguntasAdiantadas)),
    alerta: textoOuNull(r.alerta),
    oportunidade: textoOuNull(r.oportunidade),
  };
}

export function aplicarConfirmacao(roteiro: Roteiro, estado: EstadoRoteiro, raw: unknown, respostaUsuario: string): ResultadoTurno {
  const passoAtual = proximoPasso(roteiro, estado);
  if (passoAtual.tipo !== "confirmar_etapa") throw new HttpError(409, "A entrevista não está aguardando confirmação.");
  const r = isRecord(raw) ? raw : {};
  const campos = filtrarCampos(r.campos, camposDaEtapa(passoAtual.etapa));
  const correcoes = (Array.isArray(r.correcoes) ? r.correcoes : []).filter(isRecord);
  const pedeAjuste = r.pedeAjuste === true || correcoes.length > 0;

  // Ajuste numa etapa com análise: a análise é refeita considerando o pedido.
  const base = passoAtual.etapa.acaoIA && pedeAjuste ? reabrirAnalise(roteiro, estado, respostaUsuario) : estado;

  // Com correção, o resumo é reapresentado; se a correção tornar aplicável uma
  // pergunta condicional (ex.: passou a existir aprovação), o motor a faz primeiro.
  const corrigido = correcoes.reduce<EstadoRoteiro>(
    (atual, item) => corrigirResposta(roteiro, atual, {
      perguntaId: textoLimpo(item.perguntaId),
      texto: textoLimpo(item.texto).slice(0, MAX_TEXTO_RESPOSTA * 4),
      valor: textoOuNull(item.valor) ?? undefined,
    }),
    base,
  );
  const confirmou = r.confirmou === true && !pedeAjuste;
  const novoEstado = confirmou ? confirmarEtapa(roteiro, corrigido) : corrigido;
  const passo = descreverPasso(roteiro, novoEstado);

  return {
    estado: novoEstado,
    passo,
    mensagem: juntar(textoLimpo(r.comentario), textoDoPasso(roteiro, novoEstado, passo, estado.etapaAtual)),
    campos,
    alerta: null,
    oportunidade: null,
  };
}

export function aplicarExtracao(
  roteiro: Roteiro,
  estado: EstadoRoteiro,
  raw: unknown,
  origem: Exclude<OrigemResposta, "entrevista">,
): ResultadoTurno {
  const r = isRecord(raw) ? raw : {};

  // Só a etapa em andamento e as seguintes: etapas já confirmadas não são reabertas.
  const etapasAbertas = new Set(etapasEmAberto(roteiro, estado).flatMap((etapa) => etapa.perguntas.map((pergunta) => pergunta.id)));
  const novoEstado = aplicarRespostasExtraidas(roteiro, estado, lerRespostas(r.respostas).filter((item) => etapasAbertas.has(item.perguntaId)), origem);
  const passo = descreverPasso(roteiro, novoEstado);

  return {
    estado: novoEstado,
    passo,
    mensagem: juntar(textoLimpo(r.comentario), textoDoPasso(roteiro, novoEstado, passo, 0)),
    campos: filtrarCampos(r.campos, camposEmAberto(roteiro, estado)),
    alerta: textoOuNull(r.alerta),
    oportunidade: textoOuNull(r.oportunidade),
  };
}

// ─── Operações sem IA ────────────────────────────────────────────────────────

export function iniciarTurno(roteiro: Roteiro, estado: EstadoRoteiro): ResultadoTurno {
  const passo = descreverPasso(roteiro, estado);
  return { estado, passo, mensagem: textoDoPasso(roteiro, estado, passo, 0), campos: {}, alerta: null, oportunidade: null };
}

// ─── Análises da IA (diagnóstico e plano) ───────────────────────────────────

function acaoPendente(roteiro: Roteiro, estado: EstadoRoteiro): AcaoIA {
  const passo = proximoPasso(roteiro, estado);
  if (passo.tipo !== "acao_ia") throw new HttpError(409, "A entrevista não está aguardando uma análise.");
  return passo.acao;
}

export function promptAnalise(persona: PersonaPeter, roteiro: Roteiro, estado: EstadoRoteiro): string {
  return `${cabecalho(persona)}\n\n${INSTRUCOES_POR_ACAO[acaoPendente(roteiro, estado)](roteiro, estado)}`;
}

export function schemaAnalise(roteiro: Roteiro, estado: EstadoRoteiro): object {
  return SCHEMA_POR_ACAO[acaoPendente(roteiro, estado)];
}

export function aplicarAnalise(roteiro: Roteiro, estado: EstadoRoteiro, raw: unknown): ResultadoTurno {
  const acao = acaoPendente(roteiro, estado);
  const diagnostico = acao === "diagnostico_as_is" ? normalizarDiagnostico(raw) : null;
  const plano = acao === "plano_melhoria" ? normalizarPlano(raw) : null;
  if (!diagnostico && !plano) throw new HttpError(502, "A análise do Peter veio incompleta. Tente novamente.");

  const novoEstado = concluirAcao(roteiro, estado, acao, diagnostico ?? plano);
  const passo = descreverPasso(roteiro, novoEstado);
  return {
    estado: novoEstado,
    passo,
    mensagem: textoDoPasso(roteiro, novoEstado, passo, novoEstado.etapaAtual),
    campos: plano ? camposDoPlano(plano) : {},
    alerta: null,
    oportunidade: null,
    analise: acao,
  };
}

// ─── Entrada do cliente ──────────────────────────────────────────────────────

export interface MensagemHistorico {
  role: "user" | "assistant";
  content: string;
}

export function sanitizarHistorico(raw: unknown): MensagemHistorico[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && item.content.trim())
    .slice(-MAX_HISTORICO)
    .map((item) => ({ role: item.role as MensagemHistorico["role"], content: (item.content as string).slice(0, MAX_TEXTO_RESPOSTA * 2) }));
}

export type ParteArquivo =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "high" | "low" | "auto" };

// Até 10 arquivos por envio; cada imagem vai com uma parte de texto que a identifica.
const MAX_PARTES_ARQUIVO = 20;
const MAX_TEXTO_PARTE = 50_000;
const MAX_IMAGEM_CHARS = 7_000_064;
const MAX_TOTAL_ARQUIVO = 20_000_000;

// Converte as partes enviadas pela tela (formato chat: text / image_url) para o
// formato da Responses API, validando tipo e tamanho.
export function validarArquivo(raw: unknown): ParteArquivo[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, "Envie ao menos um texto ou arquivo.");
  if (raw.length > MAX_PARTES_ARQUIVO) throw new HttpError(400, `Máximo de ${MAX_PARTES_ARQUIVO} partes por envio.`);
  const dataUrl = /^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/]+=*$/;
  let total = 0;
  const partes = raw.map((parte): ParteArquivo => {
    if (!isRecord(parte)) throw new HttpError(400, "Parte de arquivo inválida.");
    if (parte.type === "text") {
      const text = typeof parte.text === "string" ? parte.text.trim() : "";
      if (!text) throw new HttpError(400, "Parte de texto vazia.");
      if (text.length > MAX_TEXTO_PARTE) throw new HttpError(400, "Texto excede 50.000 caracteres.");
      total += text.length;
      return { type: "input_text", text };
    }
    if (parte.type === "image_url" && isRecord(parte.image_url)) {
      const url = parte.image_url.url;
      if (typeof url !== "string" || !dataUrl.test(url)) throw new HttpError(400, "Imagem deve ser PNG ou JPG em data URL.");
      if (url.length > MAX_IMAGEM_CHARS) throw new HttpError(400, "Imagem excede o tamanho máximo.");
      total += url.length;
      const detail = parte.image_url.detail;
      return { type: "input_image", image_url: url, ...(detail === "high" || detail === "low" || detail === "auto" ? { detail } : {}) };
    }
    throw new HttpError(400, `Tipo de parte inválido: ${String(parte.type)}`);
  });
  if (total > MAX_TOTAL_ARQUIVO) throw new HttpError(400, "O envio excede o tamanho máximo.");
  return partes;
}
