// Procedimento (PR/PA) e Instrução de Trabalho no padrão do Peter.
// - A estrutura e o manual de escrita vêm da tabela padroes_documento (padrão da empresa, senão o
//   da plataforma, senão o padrão genérico abaixo). O material da consultoria fica no banco.
// - O documento é escrito em duas frentes: o corpo (todas as seções, menos a descrição das
//   atividades) e a descrição, em lotes de atividades escritos em paralelo. Assim nenhuma atividade
//   fica de fora ("…continua") e a resposta não estoura o tempo da função.

import type { FontesDoProcedimento } from "./procedimento-fontes.ts";

export type TipoPadrao = "estrutura_pr" | "estrutura_it" | "manual_escrita" | "exemplo_atividade";

export interface PadraoProcedimento {
  estrutura: string;
  manual: string;
  // Uma atividade bem escrita, que mostra o nível de detalhe esperado.
  exemplo?: string;
  origem: "empresa" | "plataforma" | "padrao";
}

export const TIPOS_PROCEDIMENTO = ["Procedimento", "Procedimento Operacional Padrão", "Instrução de Trabalho"];

export function ehProcedimento(tipoDocumento: string): boolean {
  return TIPOS_PROCEDIMENTO.includes(tipoDocumento);
}

export const ESTRUTURA_PR_PADRAO = `1. OBJETIVO — por que o procedimento existe e o que ele garante.
1.1 RESULTADO ESPERADO — o que se obtém ao final do processo.
2. PROCESSO — processo, área responsável, dono do processo, áreas participantes e clientes do processo.
3. REQUISITOS DE NORMA — tabela | Norma | Requisito | com as normas e leis que exigem ou justificam o procedimento.
4. DOCUMENTOS COMPLEMENTARES — documentos, formulários, planilhas e sistemas consultados ou preenchidos, e o mapa BPMN do processo.
5. DEFINIÇÕES E SIGLAS — tabela | Termo ou sigla | Definição |.
6. RECURSOS — 6.1 Pessoas (cargos); 6.2 Sistemas e ferramentas; 6.3 Equipamentos e materiais.
7. RISCOS DO PROCESSO — tabela | Risco (e consequência) | Ação preventiva ou contingência | Responsável |.
8. DESCRIÇÃO — uma subseção por atividade ou grupo de atividades (8.1, 8.2…).
CONTROLE DE NÃO CONFORMIDADE — o que fazer quando o procedimento não for cumprido.
9. RESPONSABILIDADE — quem executa, quem treina e quem garante o cumprimento.
10. HISTÓRICO DE REVISÃO — tabela | Revisão | Data | Descrição da revisão |.
INDICADORES DO PROCESSO — tabela | Indicador | Registro | Fórmula | Meta | Periodicidade |.
CONTROLES-CHAVE — lista dos controles que garantem o resultado do processo.`;

export const ESTRUTURA_IT_PADRAO = `1. OBJETIVO — a tarefa que a instrução ensina e o resultado esperado.
2. APLICAÇÃO — cargo que executa e quando a instrução se aplica.
3. DOCUMENTOS E RECURSOS — documentos, sistemas, equipamentos, materiais e EPIs.
4. DEFINIÇÕES — termos e siglas usados.
5. DESCRIÇÃO — o passo a passo numerado (5.1, 5.2…).
6. CUIDADOS E RISCOS — o que pode dar errado e como evitar ou reagir.
7. HISTÓRICO DE REVISÃO — tabela | Revisão | Data | Descrição da revisão |.`;

export const MANUAL_PADRAO = `- Escreva para que um colaborador novo, depois de treinado, consiga executar o processo só com o documento.
- Em cada atividade: comece pela condição de entrada ("Diante de…", "Ao receber…"); diga quem faz pelo cargo, em 3ª pessoa ("O Analista de Faturamento deve…"); use verbo no infinitivo para a ação; diga o que fazer, como, onde e com qual sistema ou recurso.
- Escreva as decisões como condições: "Se houver divergência, …; caso contrário, …".
- Cite EPIs, organização (5S) e segurança quando a atividade pedir, de forma natural.
- Termine cada atividade com "Recursos utilizados:" e "Resultado esperado:".
- Seja direto: frases curtas, sem termos genéricos, sem repetir o óbvio.
- Responsabilidade: "O cumprimento deste procedimento é de responsabilidade dos colaboradores citados. A conscientização e o treinamento são de responsabilidade do dono do processo."`;

// Exemplo fictício do nível de detalhe esperado (a empresa pode trocar pelo seu, na aba "Exemplo de atividade").
export const EXEMPLO_ATIVIDADE_PADRAO = `### 8.3 – Conferir o pedido separado

Diante do pedido separado na área de conferência, o **Conferente** deve comparar cada item com o Espelho do Pedido, verificando código, descrição, quantidade e a condição da embalagem. A conferência deve ser feita por pessoa diferente de quem separou, mantendo a segunda verificação como controle do processo.

Se houver divergência, o Conferente deve separar o item divergente, interromper a liberação do pedido e comunicar o Separador para a correção; quando a divergência se repetir ou não puder ser corrigida no momento, deve registrar a ocorrência no formulário de não conformidade. Após a correção, o pedido deve ser conferido novamente antes de seguir. Caso não haja divergência, o Conferente deve assinar o Espelho do Pedido e encaminhá-lo, junto com os volumes, para a emissão da Nota Fiscal.

Durante a atividade, manter a bancada organizada, com os pedidos separados entre si, e descartar embalagens danificadas (5S).

**Recursos utilizados:** Espelho do Pedido, área de conferência e formulário de não conformidade.

**Resultado esperado:** pedido conferido item a item, com o Espelho assinado e as divergências corrigidas ou registradas, garantindo a rastreabilidade da conferência.`;

export interface LinhaPadrao {
  company_id: string | null;
  tipo: string;
  conteudo: string;
}

export function tipoDaEstrutura(tipoDocumento: string): TipoPadrao {
  return tipoDocumento === "Instrução de Trabalho" ? "estrutura_it" : "estrutura_pr";
}

// Padrão da empresa, senão o da plataforma, senão o genérico (cada parte separadamente).
export function escolherPadrao(linhas: LinhaPadrao[], companyId: string, tipoDocumento: string): PadraoProcedimento {
  const tipoEstrutura = tipoDaEstrutura(tipoDocumento);
  const escolher = (tipo: TipoPadrao) => {
    const daEmpresa = linhas.find((linha) => linha.tipo === tipo && linha.company_id === companyId && linha.conteudo.trim());
    const daPlataforma = linhas.find((linha) => linha.tipo === tipo && linha.company_id === null && linha.conteudo.trim());
    return daEmpresa ? { texto: daEmpresa.conteudo.trim(), origem: "empresa" as const } : daPlataforma ? { texto: daPlataforma.conteudo.trim(), origem: "plataforma" as const } : null;
  };
  const estrutura = escolher(tipoEstrutura);
  const manual = escolher("manual_escrita");
  const exemplo = escolher("exemplo_atividade");
  const partes = [estrutura, manual, exemplo];
  return {
    estrutura: estrutura?.texto ?? (tipoEstrutura === "estrutura_it" ? ESTRUTURA_IT_PADRAO : ESTRUTURA_PR_PADRAO),
    manual: manual?.texto ?? MANUAL_PADRAO,
    exemplo: exemplo?.texto ?? EXEMPLO_ATIVIDADE_PADRAO,
    origem: partes.some((parte) => parte?.origem === "empresa") ? "empresa" : partes.some(Boolean) ? "plataforma" : "padrao",
  };
}

export const MARCADOR_DESCRICAO = "{{DESCRICAO_DAS_ATIVIDADES}}";

// Dado da empresa nunca é inventado; conhecimento técnico pode ser proposto, marcado para validação.
export const REGRAS_DO_CONTEUDO = `## O QUE PODE E O QUE NÃO PODE (vale para todo o documento)
- DADO DA EMPRESA (quem faz, prazos, sistemas, quantidades, metas, nomes, documentos internos, locais): use somente o que está em "dadosDoProcesso". Nunca invente; o que faltar fica "[a definir]".
- CONHECIMENTO TÉCNICO: você pode e deve propor, marcando com "(sugerido pelo Peter — validar)":
  - as cláusulas da ISO 9001:2015 aplicáveis às atividades do processo (ex.: 8.5.1 controle da produção e da prestação do serviço, 8.5.2 identificação e rastreabilidade, 8.5.4 preservação, 8.6 liberação, 8.7 saídas não conformes, 7.5 informação documentada, 8.4 provedores externos, 9.1 monitoramento e medição, 10.2 não conformidade e ação corretiva), além das normas citadas na entrevista (estas sem a marca);
  - NRs, LGPD ou outras leis só quando a atividade claramente as envolve (movimentação de carga, dados pessoais etc.);
  - definições dos termos e siglas que aparecem nos dados;
  - EPIs e cuidados de segurança quando a atividade envolve risco físico.
- RECURSOS: monte a partir dos dados (cargos = responsáveis das atividades e raias do mapa; sistemas e documentos = ferramentas das atividades, documentos do mapa e respostas da entrevista).
- Nunca escreva links, endereços de arquivo ou marcadores como "link_to_download", "…", "[continua]" ou "etc.". O mapa BPMN é citado só pelo nome ("Mapa AS IS do processo <nome>").
- Tabelas em markdown, com cabeçalho.`;

// Documento já existente do processo (procedimento antigo, IT, manual), enviado na geração:
// fonte do "como fazer"; a ordem e os responsáveis continuam vindo do mapeamento.
export const REGRAS_DO_DOCUMENTO_DE_APOIO = `## DOCUMENTO DE APOIO ("documentoDeApoio", quando existir)
- É um documento que a empresa já usa para este processo. Use-o para detalhar COMO cada atividade é executada: telas, campos, verificações, critérios, registros, prazos e responsáveis citados nele.
- A sequência das atividades e os responsáveis vêm do mapeamento (atividades e mapaAsIs). Se o documento divergir do mapeamento, siga o mapeamento e registre a divergência em attention_points.
- Não copie trechos inteiros: reescreva no padrão deste procedimento.`;

// O manual pode vir de um prompt usado em outros contextos (entrevista, BPMN, relatórios): só a
// parte de redação e estrutura de documentos vale aqui.
export const COMO_USAR_O_MANUAL = `Do manual acima, use somente o que trata de redação, estrutura, cabeçalho e estilo de documentos (procedimentos e instruções). Ignore o que for de outros usos: pedidos para coletar dados ou fazer perguntas antes de responder, regras de mapa BPMN, diagnósticos, relatórios, análise crítica, transformação digital, mensagens finais, frases de recusa e regras de confidencialidade. Você está escrevendo o documento agora, com os dados fornecidos.`;

export const MAX_DOCUMENTO_DE_APOIO = 40_000;

// Documento de apoio enviado pela tela: só nome e texto (já extraído do PDF ou Word), com limite.
export function lerDocumentoDeApoio(raw: unknown): { nome: string; texto: string; cortado: boolean } | null {
  const dados = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const texto = typeof dados?.texto === "string" ? dados.texto.trim() : "";
  if (!texto) return null;
  const nome = typeof dados?.nome === "string" && dados.nome.trim() ? dados.nome.trim().slice(0, 200) : "documento de apoio";
  return { nome, texto: texto.slice(0, MAX_DOCUMENTO_DE_APOIO), cortado: texto.length > MAX_DOCUMENTO_DE_APOIO };
}

export function promptDoCorpo(padrao: PadraoProcedimento, temAtividades: boolean, hoje: string): string {
  return `## PADRÃO DE ESTRUTURA (siga esta ordem e estes títulos, numerados como no padrão)
${padrao.estrutura}

## MANUAL DE ESCRITA DA EMPRESA
${padrao.manual}

${COMO_USAR_O_MANUAL}

${REGRAS_DO_CONTEUDO}

## COMO MONTAR
- Título do documento: "<nome do processo>" (sem código; o código é dado ao salvar).
- ${temAtividades
    ? `Na seção de descrição das atividades, escreva o título da seção e, na linha seguinte, exatamente ${MARCADOR_DESCRICAO}, e nada mais nessa seção: as atividades são escritas à parte e entram nesse lugar.`
    : "Não há atividades registradas: escreva a descrição a partir do mapa e da entrevista."}
- Riscos: use os riscos do diagnóstico, os riscos registrados e as respostas "O que dá errado" e "Erros e retrabalho"; a contingência e o responsável vêm dos dados ou ficam "[a definir]".
- Indicadores: a lista "indicadores"; registro e meta ausentes ficam "[a definir]".
- Histórico de revisão: uma linha "00 | ${hoje} | Emissão inicial do procedimento".
- Controles-chave: os controles que aparecem nos dados (conferências, aprovações, registros, prazos).
- Em attention_points, liste o que o revisor deve conferir: cada "[a definir]", cada "[detalhar: …]" e cada "(sugerido pelo Peter — validar)".

${REGRAS_DO_DOCUMENTO_DE_APOIO}`;
}

// ─── Descrição das atividades, em lotes ─────────────────────────────────────

export const TAMANHO_DO_LOTE = 8;

export function lotesDeAtividades(total: number, tamanho = TAMANHO_DO_LOTE): Array<{ de: number; ate: number }> {
  const lotes: Array<{ de: number; ate: number }> = [];
  for (let de = 1; de <= total; de += tamanho) lotes.push({ de, ate: Math.min(total, de + tamanho - 1) });
  return lotes;
}

export const SCHEMA_ATIVIDADES = {
  type: "object",
  additionalProperties: false,
  properties: {
    subsecoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          titulo: { type: "string" },
          atividades: { type: "array", items: { type: "integer" } },
          texto: { type: "string" },
        },
        required: ["titulo", "atividades", "texto"],
      },
    },
  },
  required: ["subsecoes"],
};

export function promptDasAtividades(padrao: PadraoProcedimento, lote: { de: number; ate: number }, total: number): string {
  return `Você é o Peter e escreve a seção de DESCRIÇÃO das atividades de um procedimento, no padrão abaixo. Esta seção é a parte mais importante do documento: ela precisa permitir que um colaborador novo, depois de treinado, execute cada atividade só com o texto.

## MANUAL DE ESCRITA DA EMPRESA
${padrao.manual}

${COMO_USAR_O_MANUAL}

${REGRAS_DO_CONTEUDO}

${REGRAS_DO_DOCUMENTO_DE_APOIO}

## NÍVEL DE DETALHE EXIGIDO EM CADA SUBSEÇÃO
Escreva de 2 a 4 parágrafos, com texto descritivo completo, nunca genérico, contendo:
1. Condição de entrada: o que dispara a atividade ("Diante de…", "Ao receber…").
2. Quem executa: o cargo em negrito, em 3ª pessoa ("O **Analista de Faturamento** deve…").
3. Como executar, passo a passo: onde (sistema, tela, local), o que consultar, preencher, conferir ou assinar, e em qual documento.
4. Controles e verificações: o que deve ser checado antes de seguir e o critério de "está certo".
5. Decisões e exceções: cada caminho com o que fazer ("Se …, …; caso contrário, …"), quem é comunicado e o que é registrado (use as decisões do mapa e as respostas de decisões, aprovação negada, exceções e "O que dá errado").
6. Segurança e organização (EPIs, 5S) quando a atividade envolver movimentação, armazenagem ou risco físico.
7. Feche com "**Recursos utilizados:** …" e "**Resultado esperado:** …", dizendo também o que garante a rastreabilidade.
Proibido: frases vagas como "realizar a atividade", "conforme necessário", "feito pelo responsável", "gerenciar o processo" ou só repetir o nome da atividade.
Quando um detalhe concreto não estiver nos dados (tela, campo, prazo, critério), não invente: escreva o que se sabe e marque o ponto com "[detalhar: <o que falta>]".

## EXEMPLO DO NÍVEL DE DETALHE ESPERADO (imite o formato e a profundidade; não copie os dados)
${padrao.exemplo || EXEMPLO_ATIVIDADE_PADRAO}

## SUA PARTE
- O processo tem ${total} atividades (lista "atividades" em "dadosDoProcesso", campo "ordem"). Escreva SOMENTE as atividades de ordem ${lote.de} a ${lote.ate}, todas, na ordem.
- Cada subseção descreve uma atividade; junte duas ou mais só quando forem passos curtos e inseparáveis do mesmo cargo. Em "atividades", as ordens que a subseção cobre. Nenhuma ordem de ${lote.de} a ${lote.ate} pode ficar de fora.
- "titulo": a ação no infinitivo (ex.: "Conferir mercadorias separadas"), sem número.
- "texto": em markdown, sem título, com o nível de detalhe acima.
- Use o mapa (mapaAsIs) para a ordem, o responsável e os caminhos; use as respostas da entrevista e o documento de apoio para os detalhes, prazos e regras.
- Descreva o processo como é feito hoje; melhorias planejadas não entram.`;
}

export interface SubsecaoAtividade {
  titulo: string;
  atividades: number[];
  texto: string;
}

// Sinais de texto cortado pela IA: "[continua por 25 etapas]" ou uma linha só com reticências.
const TRUNCADO = /\[\s*continua|\(\s*continua|\bcontinua por \d+|^\s*(?:\.\.\.|…)\s*$/im;

export function lerSubsecoes(raw: unknown): SubsecaoAtividade[] {
  const lista = (raw && typeof raw === "object" ? (raw as { subsecoes?: unknown }).subsecoes : null);
  return (Array.isArray(lista) ? lista : []).flatMap((item) => {
    const dados = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const titulo = typeof dados.titulo === "string" ? dados.titulo.trim().replace(/^\d+(\.\d+)*\s*[–-]?\s*/, "") : "";
    const texto = typeof dados.texto === "string" ? dados.texto.trim() : "";
    const atividades = Array.isArray(dados.atividades) ? dados.atividades.filter((valor): valor is number => Number.isInteger(valor)) : [];
    return titulo && texto && !TRUNCADO.test(texto) ? [{ titulo, atividades, texto }] : [];
  });
}

// Ordens do lote que nenhuma subseção cobre.
export function atividadesFaltando(subsecoes: SubsecaoAtividade[], lote: { de: number; ate: number }): number[] {
  const cobertas = new Set(subsecoes.flatMap((subsecao) => subsecao.atividades));
  const faltando: number[] = [];
  for (let ordem = lote.de; ordem <= lote.ate; ordem += 1) if (!cobertas.has(ordem)) faltando.push(ordem);
  return faltando;
}

// Atividade que a IA não descreveu nem na segunda tentativa: entra com os dados do mapeamento,
// para o procedimento nunca sair incompleto (e o revisor é avisado).
export function subsecaoDosDados(atividade: FontesDoProcedimento["atividades"][number]): SubsecaoAtividade {
  const quem = atividade.responsavel || "[a definir]";
  const recurso = atividade.ferramentaOuDocumento || "[a definir]";
  return {
    titulo: atividade.atividade,
    atividades: [atividade.ordem],
    texto: `O **${quem}** deve ${atividade.atividade.charAt(0).toLowerCase()}${atividade.atividade.slice(1)}.\n\n**Recursos utilizados:** ${recurso}.\n\n**Resultado esperado:** [a definir].`,
  };
}

// Número da seção de descrição (ex.: "8" em "## 8 – DESCRIÇÃO"), para numerar 8.1, 8.2…
function numeroDaSecao(markdown: string, posicao: number): string {
  const antes = markdown.slice(0, posicao).split("\n").reverse();
  const titulo = antes.find((linha) => /^#{1,6}\s/.test(linha));
  return titulo?.match(/^#{1,6}\s*(\d+(?:\.\d+)*)/)?.[1] ?? "";
}

export function montarDescricao(subsecoes: SubsecaoAtividade[], numero: string): string {
  return subsecoes
    .map((subsecao, indice) => `### ${numero ? `${numero}.${indice + 1} – ` : `${indice + 1}. `}${subsecao.titulo}\n\n${subsecao.texto}`)
    .join("\n\n");
}

// Põe a descrição no lugar do marcador; sem o marcador, logo após o título da seção de descrição
// ou, em último caso, no fim do documento.
export function inserirDescricao(corpo: string, subsecoes: SubsecaoAtividade[]): string {
  const posicao = corpo.indexOf(MARCADOR_DESCRICAO);
  if (posicao >= 0) {
    return corpo.replace(MARCADOR_DESCRICAO, montarDescricao(subsecoes, numeroDaSecao(corpo, posicao)));
  }
  const titulo = corpo.match(/^#{1,6}\s*(\d+(?:\.\d+)*)?\.?\s*[–-]?\s*descri[çc][ãa]o[^\n]*$/im);
  if (titulo && titulo.index !== undefined) {
    const fim = titulo.index + titulo[0].length;
    return `${corpo.slice(0, fim)}\n\n${montarDescricao(subsecoes, titulo[1] ?? "")}${corpo.slice(fim)}`;
  }
  return `${corpo}\n\n## DESCRIÇÃO DAS ATIVIDADES\n\n${montarDescricao(subsecoes, "")}`;
}

// Links e marcadores que a IA às vezes inventa ("[Mapa](link_to_download_bpmn)").
export function semLinksInventados(markdown: string): string {
  return markdown.replace(/\[([^\]]+)\]\((?!https?:\/\/)[^)]*\)/g, "$1");
}
