// Chat da tela inicial: o Peter responde com os dados da empresa (processos, documentos, Plano de
// Ação e Indicadores) e convida a mapear um processo quando faz sentido. Só consulta; não grava nada
// além da conversa. Usado pela edge function ai-peter-chat e testado no app.

import type { PersonaPeter } from "./roteiro-peter.ts";

export interface ProcessoContexto {
  id: string;
  nome: string;
  area: string;
  dono: string;
  status: string;
  objetivo: string;
  atualizadoEm: string;
}

export interface DetalheProcesso {
  id: string;
  gatilho: string;
  atividades: Array<{ atividade: string; responsavel: string; ferramenta: string }>;
  entradas: Array<{ fornecedor: string; entrada: string }>;
  saidas: Array<{ saida: string; cliente: string }>;
  diagnostico: string;
  maturidade: string;
  planoResumo: string;
}

export interface AcaoContexto {
  id: string;
  oque: string;
  quem: string;
  prazo: string | null;
  quandoTexto: string;
  status: string;
  processoId: string | null;
  origem: string;
}

export interface IndicadorContexto {
  id: string;
  nome: string;
  processoId: string | null;
  meta: string;
  responsavel: string;
  resultados: Array<{ periodo: string; valor: string; situacao: string }>;
}

export interface DocumentoContexto {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  status: string;
  revisao: string;
  processoId: string | null;
}

export interface ContextoEmpresa {
  hoje: string;
  processos: ProcessoContexto[];
  acoes: AcaoContexto[];
  indicadores: IndicadorContexto[];
  documentos: DocumentoContexto[];
  // Conteúdo dos documentos e detalhes dos processos mais ligados à pergunta.
  conteudos: Array<{ documentoId: string; texto: string }>;
  detalhes: DetalheProcesso[];
}

export type TipoAtalho = "processo" | "documento" | "acao" | "indicador" | "plano_de_acao" | "indicadores" | "processos" | "documentos";

export interface Atalho {
  tipo: TipoAtalho;
  id: string | null;
  rotulo: string;
}

export interface RespostaChat {
  resposta: string;
  atalhos: Atalho[];
  convite: { nomeProcesso: string } | null;
}

export const MAX_MENSAGEM_CHAT = 4_000;
export const MAX_HISTORICO_CHAT = 12;
export const MAX_CONTEUDO_DOCUMENTO = 6_000;
export const MAX_RELEVANTES = 2;

// Atalhos para os módulos, sem item específico.
const MODULOS: Record<string, { tipo: TipoAtalho; rotulo: string }> = {
  PLANO: { tipo: "plano_de_acao", rotulo: "Abrir Plano de Ação" },
  INDICADORES: { tipo: "indicadores", rotulo: "Abrir Indicadores" },
  PROCESSOS: { tipo: "processos", rotulo: "Abrir Processos" },
  DOCUMENTOS: { tipo: "documentos", rotulo: "Abrir Documentos" },
};

const ABERTA = new Set(["A fazer", "Em andamento"]);

const PALAVRAS_VAZIAS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma uns umas para por com sem que qual quais como onde quando quem sobre ao aos meu minha nosso nossa esse essa este esta isso isto ha tem ter ser sao foi esta estao processo processos documento documentos".split(" "),
);

export function termos(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9-]+/)
    .filter((palavra) => palavra.length >= 3 && !PALAVRAS_VAZIAS.has(palavra));
}

function pontuar(pergunta: string[], alvo: string): number {
  const palavras = new Set(termos(alvo));
  return pergunta.reduce((total, termo) => total + (palavras.has(termo) ? 1 : 0), 0);
}

// Os processos e documentos mais ligados à pergunta (e ao histórico recente), para mandar o conteúdo.
export function escolherRelevantes(
  pergunta: string,
  processos: ProcessoContexto[],
  documentos: DocumentoContexto[],
): { processos: string[]; documentos: string[] } {
  const busca = termos(pergunta);
  const codigos = new Set((pergunta.toUpperCase().match(/\b(?:PR|IT)-\d{3}\b/g) ?? []));
  const melhores = <T,>(itens: T[], pontos: (item: T) => number, id: (item: T) => string) =>
    itens
      .map((item) => ({ id: id(item), pontos: pontos(item) }))
      .filter((item) => item.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos)
      .slice(0, MAX_RELEVANTES)
      .map((item) => item.id);
  return {
    processos: melhores(processos, (processo) => pontuar(busca, `${processo.nome} ${processo.area}`), (processo) => processo.id),
    documentos: melhores(
      documentos,
      (documento) => (codigos.has(documento.codigo.toUpperCase()) ? 10 : 0) + pontuar(busca, `${documento.titulo} ${documento.codigo}`),
      (documento) => documento.id,
    ),
  };
}

// Referências curtas (P1, A3…) no lugar dos ids, para o modelo citar sem errar.
export function referencias(contexto: ContextoEmpresa): Map<string, Atalho> {
  const mapa = new Map<string, Atalho>();
  contexto.processos.forEach((item, indice) => mapa.set(`P${indice + 1}`, { tipo: "processo", id: item.id, rotulo: item.nome || "Processo sem nome" }));
  contexto.documentos.forEach((item, indice) => mapa.set(`D${indice + 1}`, { tipo: "documento", id: item.id, rotulo: [item.codigo, item.titulo].filter(Boolean).join(" · ") }));
  contexto.acoes.forEach((item, indice) => mapa.set(`A${indice + 1}`, { tipo: "acao", id: item.id, rotulo: item.oque }));
  contexto.indicadores.forEach((item, indice) => mapa.set(`I${indice + 1}`, { tipo: "indicador", id: item.id, rotulo: item.nome }));
  for (const [ref, modulo] of Object.entries(MODULOS)) mapa.set(ref, { ...modulo, id: null });
  return mapa;
}

function refDe(mapa: Map<string, Atalho>, tipo: TipoAtalho, id: string | null): string {
  if (!id) return "-";
  for (const [ref, atalho] of mapa) if (atalho.tipo === tipo && atalho.id === id) return ref;
  return "-";
}

function linha(...partes: Array<string | null | undefined>): string {
  return partes.filter((parte) => parte && parte.trim()).join(" | ");
}

export function textoDoContexto(contexto: ContextoEmpresa): string {
  const mapa = referencias(contexto);
  const processo = (id: string | null) => refDe(mapa, "processo", id);
  const blocos = [
    `HOJE: ${contexto.hoje}`,
    `## PROCESSOS (${contexto.processos.length})`,
    ...contexto.processos.map((item, indice) => `P${indice + 1}: ${linha(item.nome || "Sem nome", `área: ${item.area}`, `dono: ${item.dono}`, `status: ${item.status}`, item.objetivo && `objetivo: ${item.objetivo}`)}`),
    `## DOCUMENTOS (${contexto.documentos.length})`,
    ...contexto.documentos.map((item, indice) => `D${indice + 1}: ${linha(item.codigo, item.titulo, item.tipo, `status: ${item.status}`, `revisão: ${item.revisao}`, `processo: ${processo(item.processoId)}`)}`),
    `## PLANO DE AÇÃO (${contexto.acoes.length})`,
    ...contexto.acoes.map((item, indice) => {
      const atrasada = item.prazo && ABERTA.has(item.status) && item.prazo < contexto.hoje;
      return `A${indice + 1}: ${linha(item.oque, `quem: ${item.quem || "[a definir]"}`, `prazo: ${item.prazo ?? (item.quandoTexto || "[a definir]")}`, `status: ${item.status}${atrasada ? " (ATRASADA)" : ""}`, `processo: ${processo(item.processoId)}`, `origem: ${item.origem}`)}`;
    }),
    `## INDICADORES (${contexto.indicadores.length})`,
    ...contexto.indicadores.map((item, indice) => `I${indice + 1}: ${linha(item.nome, `meta: ${item.meta}`, `responsável: ${item.responsavel}`, `processo: ${processo(item.processoId)}`, item.resultados.length ? `resultados: ${item.resultados.map((resultado) => `${resultado.periodo} = ${resultado.valor} (${resultado.situacao})`).join("; ")}` : "sem resultados lançados")}`),
  ];
  for (const detalhe of contexto.detalhes) {
    blocos.push(
      `## DETALHES DE ${processo(detalhe.id)}`,
      linha(detalhe.gatilho && `início: ${detalhe.gatilho}`),
      ...detalhe.atividades.map((atividade, indice) => `${indice + 1}. ${linha(atividade.atividade, atividade.responsavel, atividade.ferramenta)}`),
      linha(detalhe.entradas.length ? `entradas: ${detalhe.entradas.map((item) => `${item.entrada} (de ${item.fornecedor || "?"})`).join("; ")}` : ""),
      linha(detalhe.saidas.length ? `saídas: ${detalhe.saidas.map((item) => `${item.saida} (para ${item.cliente || "?"})`).join("; ")}` : ""),
      linha(detalhe.diagnostico && `diagnóstico: ${detalhe.diagnostico}`, detalhe.maturidade && `maturidade: ${detalhe.maturidade}`),
      linha(detalhe.planoResumo && `processo otimizado (TO BE): ${detalhe.planoResumo}`),
    );
  }
  for (const conteudo of contexto.conteudos) {
    blocos.push(`## CONTEÚDO DE ${refDe(mapa, "documento", conteudo.documentoId)}`, conteudo.texto.slice(0, MAX_CONTEUDO_DOCUMENTO));
  }
  return blocos.filter((bloco) => bloco.trim()).join("\n");
}

export function promptChat(persona: PersonaPeter, contexto: ContextoEmpresa, primeiraResposta: boolean): string {
  return `${persona.identidade}

## SEU PAPEL NESTA TELA
Você é a tela inicial da plataforma Peter. Responde perguntas sobre os processos, documentos, Plano de Ação e Indicadores da empresa, e ajuda com dúvidas gerais de gestão por processos, ISO 9001 e melhoria contínua.

## REGRAS
- Sobre a empresa, use SOMENTE os dados abaixo. Nunca invente processo, documento, ação, indicador, número, nome ou data. Se a informação não estiver nos dados, diga que ela não está cadastrada.
- Dúvidas gerais (o que é um SIPOC, o que a ISO pede): responda com conhecimento geral e deixe claro que é orientação geral, não dado da empresa.
- Você só consulta. Se pedirem para criar, mudar ou excluir algo, explique que isso é feito na tela correspondente e ofereça o atalho.
- "ATRASADA" já vem calculado nos dados; não refaça contas de data.
- Respostas curtas e diretas, em português do Brasil, em markdown simples (listas quando ajudar). Cite itens pelo nome, nunca pela referência (P1, A2…).
${persona.regras ? `\n## REGRAS DA EMPRESA\n${persona.regras}\n` : ""}${persona.orientacoesEmpresa ? `\n## ORIENTAÇÕES DA EMPRESA\n${persona.orientacoesEmpresa}\n` : ""}
## ATALHOS
Em "atalhos", liste até 4 referências dos itens citados na resposta (P1, D2, A3, I4) ou dos módulos (PLANO, INDICADORES, PROCESSOS, DOCUMENTOS), com um rótulo curto (ex.: "Abrir COOPERA - Pós-vendas"). Use só referências que existem nos dados.

## CONVITE PARA MAPEAR
Marque "convidarMapear.ativo" = true ${primeiraResposta ? "nesta resposta (é a primeira da conversa) e " : ""}quando o assunto for um processo que não está na lista, que está só "Em entrevista" ou de que faltam dados para responder. Nesse caso, termine a resposta com um convite curto para mapear o processo com você. Em "nomeProcesso", o nome do processo em questão, se souber; senão, "". Fora desses casos, false.

## DADOS DA EMPRESA
${textoDoContexto(contexto)}`;
}

export const SCHEMA_CHAT = {
  type: "object",
  additionalProperties: false,
  properties: {
    resposta: { type: "string" },
    atalhos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { ref: { type: "string" }, rotulo: { type: "string" } },
        required: ["ref", "rotulo"],
      },
    },
    convidarMapear: {
      type: "object",
      additionalProperties: false,
      properties: { ativo: { type: "boolean" }, nomeProcesso: { type: "string" } },
      required: ["ativo", "nomeProcesso"],
    },
  },
  required: ["resposta", "atalhos", "convidarMapear"],
};

function registro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

function texto(valor: unknown, limite = 4_000): string {
  return typeof valor === "string" ? valor.trim().slice(0, limite) : "";
}

// Só ficam os atalhos que apontam para itens reais do contexto.
export function lerRespostaChat(raw: unknown, contexto: ContextoEmpresa): RespostaChat {
  const dados = registro(raw);
  const mapa = referencias(contexto);
  const vistos = new Set<string>();
  const atalhos = (Array.isArray(dados.atalhos) ? dados.atalhos : []).flatMap((item) => {
    const ref = texto(registro(item).ref, 20).toUpperCase();
    const alvo = mapa.get(ref);
    if (!alvo || vistos.has(ref)) return [];
    vistos.add(ref);
    return [{ ...alvo, rotulo: texto(registro(item).rotulo, 80) || alvo.rotulo }];
  }).slice(0, 4);
  const convite = registro(dados.convidarMapear);
  return {
    resposta: texto(dados.resposta, 12_000) || "Não consegui montar uma resposta. Pode perguntar de outro jeito?",
    atalhos,
    convite: convite.ativo === true ? { nomeProcesso: texto(convite.nomeProcesso, 200) } : null,
  };
}

export function tituloDaConversa(mensagem: string): string {
  const limpo = mensagem.replace(/\s+/g, " ").trim();
  return limpo.length > 60 ? `${limpo.slice(0, 57)}…` : limpo || "Nova conversa";
}

export function sanitizarHistoricoChat(raw: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  return (Array.isArray(raw) ? raw : [])
    .map(registro)
    .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.conteudo === "string")
    .slice(-MAX_HISTORICO_CHAT)
    .map((item) => ({ role: item.role as "user" | "assistant", content: texto(item.conteudo, MAX_MENSAGEM_CHAT * 2) }));
}
